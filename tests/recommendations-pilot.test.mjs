import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');

test('Edge recommendations uses the fake-only request and preserves controlled errors', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_AI_RECOMMENDATIONS_PILOT: process.env.VITE_AI_RECOMMENDATIONS_PILOT,
  };
  const tempEnvDir = await mkdtemp(path.join(os.tmpdir(), 'titantrack-vite-test-'));
  process.env.VITE_SUPABASE_URL = 'https://fake-project.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'offline-fake-anon-key';
  process.env.VITE_AI_RECOMMENDATIONS_PILOT = 'true';

  const calls = [];
  let responseStatus = 200;
  let rejectFetch = false;
  let supabaseClient;
  let originalGetSession;
  globalThis.fetch = async (input, init) => {
    if (rejectFetch) throw new TypeError('simulated offline network failure');
    calls.push({
      url: String(input),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    return new Response(
      JSON.stringify(
        responseStatus === 200
          ? [{ title: 'Consejo ficticio', description: 'Contenido de prueba', category: 'strength' }]
          : { error: 'internal provider details must not be surfaced' }
      ),
      { status: responseStatus, headers: { 'Content-Type': 'application/json' } }
    );
  };

  let server;
  try {
    server = await createServer({
      configFile: false,
      root,
      envDir: tempEnvDir,
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });
    ({ supabase: supabaseClient } = await server.ssrLoadModule(
      '/src/lib/supabaseClient.ts'
    ));
    originalGetSession = supabaseClient.auth.getSession;
    supabaseClient.auth.getSession = async () => ({
      data: {
        session: {
          access_token: 'offline.fake.access-token',
        },
      },
      error: null,
    });
    const service = await server.ssrLoadModule('/services/aiService.edge.ts');
    const componentModule = await server.ssrLoadModule('/components/Recommendations.tsx');
    assert.equal(componentModule.isRecommendationsPilotEnabled(true, false, 'true', 'http://localhost:3001', true), true);
    assert.equal(componentModule.isRecommendationsPilotEnabled(false, true, 'true', 'https://titantrack-clean.vercel.app', true), true);
    assert.equal(componentModule.isRecommendationsPilotEnabled(true, false, 'true', 'http://localhost:3000', true), false);
    assert.equal(componentModule.isRecommendationsPilotEnabled(false, true, 'true', 'https://preview-titantrack.vercel.app', true), false);
    assert.equal(componentModule.isRecommendationsPilotEnabled(false, true, 'true', 'https://titantrack-clean.vercel.app.evil.test', true), false);
    assert.equal(componentModule.isRecommendationsPilotEnabled(true, false, 'false', 'http://localhost:3001', true), false);
    assert.equal(componentModule.isRecommendationsPilotEnabled(false, true, 'true', 'https://titantrack-clean.vercel.app', false), false);

    const result = await service.getPersonalizedRecommendationsGroq();
    assert.deepEqual(result, [
      { title: 'Consejo ficticio', description: 'Contenido de prueba', category: 'strength' },
    ]);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://aziowzwhizjytzcqfent.supabase.co/functions/v1/groq-recommendations');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(calls[0].body, {
      workouts: [],
      profile: {
        displayName: 'Perfil ficticio de prueba',
        plan: 'free',
        sex: '',
        goal: 'Mejorar la fuerza general',
        level: 'principiante',
        weightKg: null,
        heightCm: null,
        trainingDaysPerWeek: 3,
        sessionMinutes: 45,
        preferredStyle: 'Entrenamiento general',
        equipment: ['Mancuernas'],
        limitations: 'Perfil sintético sin información de una persona real',
        measurements: {},
      },
    });
    assert.equal(calls[0].headers.has('Authorization'), true);
    assert.equal(calls[0].headers.get('Content-Type'), 'application/json');
    assert.equal(calls[0].headers.has('apikey'), false);
    assert.equal(calls[0].headers.has('x-client-info'), false);

    for (const status of [401, 403, 429, 500, 502, 503, 504]) {
      responseStatus = status;
      await assert.rejects(service.getPersonalizedRecommendationsGroq(), (error) => {
        assert.equal(error instanceof service.EdgeRecommendationsError, true);
        assert.equal(error.status, status);
        assert.equal(error.message.includes('internal provider details'), false);
        return true;
      });
    }

    rejectFetch = true;
    await assert.rejects(service.getPersonalizedRecommendationsGroq(), (error) => {
      assert.equal(error instanceof service.EdgeRecommendationsError, true);
      assert.equal(error.status, null);
      assert.equal(error.message.includes('No se reintentó'), true);
      return true;
    });

    const component = await readFile(
      path.join(root, 'components', 'Recommendations.tsx'),
      'utf8'
    );
    assert.match(component, /from '\.\.\/services\/aiService\.edge'/);
    assert.doesNotMatch(component, /from '\.\.\/services\/aiService'/);
    assert.doesNotMatch(component, /\buseEffect\b/);
    assert.match(component, /import\.meta\.env\.VITE_AI_RECOMMENDATIONS_PILOT/);
    assert.match(component, /import\.meta\.env\.DEV === true/);
    assert.match(component, /import\.meta\.env\.PROD === true/);
    assert.match(component, /window\.confirm\(/);
    assert.match(component, /!pilotEnabled \|\| !isLoggedIn \|\| requestInFlightRef\.current/);
    assert.match(component, /disabled=\{!pilotEnabled \|\| !isLoggedIn \|\| loading\}/);
    assert.match(component, /Esta prueba usa únicamente datos sintéticos/);
    assert.match(component, /no analiza tu historial ni tu perfil real/);
    assert.match(component, /no depende de tus entrenamientos registrados/);
    assert.doesNotMatch(component, /consejos personalizados/);
    assert.match(component, /if \(!pilotEnabled \|\| !isLoggedIn \|\| requestInFlightRef\.current\) return/);
    assert.match(component, /requestInFlightRef\.current = true/);
    assert.match(component, /finally\s*\{\s*requestInFlightRef\.current = false/);
    assert.ok(
      component.indexOf('if (!window.confirm(') <
        component.indexOf('getPersonalizedRecommendationsGroq();')
    );
    assert.match(component, /setPilotRecommendations\(recs\)/);
    assert.doesNotMatch(component, /setRecommendations\(recs\)/);
    assert.doesNotMatch(component, /generateRoutineGroq/);
    assert.doesNotMatch(component, /getPersonalizedRecommendationsGroq\(workouts/);
    assert.match(component, /Probar IA con datos ficticios/);
    assert.match(component, /Resultado de prueba con datos ficticios/);
    for (const message of [
      'La sesión no es válida o ha caducado.',
      'El acceso a esta prueba no está permitido.',
      'La cuota de IA está agotada.',
      'El servicio de IA no está disponible temporalmente.',
      'El proveedor de IA devolvió una respuesta no válida.',
      'La solicitud superó el tiempo de espera.',
      'No se pudo confirmar el resultado. No se reintentó la solicitud.',
    ]) {
      assert.ok(component.includes(message), `Missing controlled UI message: ${message}`);
    }
  } finally {
    if (supabaseClient && originalGetSession) {
      supabaseClient.auth.getSession = originalGetSession;
    }
    if (server) await server.close();
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(tempEnvDir, { recursive: true, force: true });
  }
});
