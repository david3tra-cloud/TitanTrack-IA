import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');

test('Edge routine pilot sends all selected groups and keeps the result as a preview', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    VITE_AI_ROUTINE_PILOT: process.env.VITE_AI_ROUTINE_PILOT,
  };
  const tempEnvDir = await mkdtemp(path.join(os.tmpdir(), 'titantrack-vite-test-'));
  process.env.VITE_SUPABASE_URL = 'https://fake-project.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'offline-fake-anon-key';
  process.env.VITE_AI_ROUTINE_PILOT = 'true';

  const calls = [];
  let responseStatus = 200;
  let rejectFetch = false;
  let supabaseClient;
  let originalGetSession;
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      hasAuthorization: new Headers(init?.headers).has('Authorization'),
      body: JSON.parse(String(init?.body)),
    });
    if (rejectFetch) throw new TypeError('simulated offline network failure');
    return new Response(
      JSON.stringify(
        responseStatus === 200
          ? {
              id: 'routine-preview-id',
              name: 'Rutina ficticia en español',
              description: 'Vista previa',
              exercises: [{
                id: 'exercise-preview-id',
                name: 'Press de banca',
                sets: 3,
                reps: '8-10',
                restTime: '60 segundos',
              }],
            }
          : { error: 'controlled fake error' }
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
      data: { session: { access_token: 'offline.fake.access-token' } },
      error: null,
    });
    const service = await server.ssrLoadModule('/services/aiService.edge.ts');
    const componentModule = await server.ssrLoadModule('/components/RoutinesView.tsx');
    assert.equal(componentModule.isRoutinePilotEnabled(true, false, undefined, 'http://localhost:3001', true), false);
    assert.equal(componentModule.isRoutinePilotEnabled(true, false, 'false', 'http://localhost:3001', true), false);
    assert.equal(componentModule.isRoutinePilotEnabled(false, false, 'true', 'http://localhost:3001', true), false);
    assert.equal(componentModule.isRoutinePilotEnabled(true, false, 'true', 'http://localhost:3000', true), false);
    assert.equal(componentModule.isRoutinePilotEnabled(false, true, 'true', 'https://titantrack-clean.vercel.app', true), true);
    assert.equal(componentModule.isRoutinePilotEnabled(false, true, 'true', 'https://preview-titantrack.vercel.app', true), false);
    assert.equal(componentModule.isRoutinePilotEnabled(false, true, 'true', 'https://titantrack-clean.vercel.app.evil.test', true), false);
    assert.equal(componentModule.isRoutinePilotEnabled(false, true, 'true', 'https://titantrack-clean.vercel.app', false), false);

    const requestParams = {
      objective: 'Fuerza general',
      level: 'Principiante',
      focuses: ['chest', 'back', 'core'],
      equipment: 'Mancuernas',
      mode: 'basic',
      sessionMinutes: 45,
    };
    const result = await service.generateRoutineGroq({
      ...requestParams,
    });

    assert.deepEqual(result, {
      id: 'routine-preview-id',
      name: 'Rutina ficticia en español',
      description: 'Vista previa',
      exercises: [{
        id: 'exercise-preview-id',
        name: 'Press de banca',
        sets: 3,
        reps: '8-10',
        restTime: '60 segundos',
      }],
    });
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      'https://aziowzwhizjytzcqfent.supabase.co/functions/v1/groq-routine'
    );
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].hasAuthorization, true);
    assert.deepEqual(calls[0].body, requestParams);

    responseStatus = 502;
    await assert.rejects(
      service.generateRoutineGroq(requestParams),
      /controlled fake error/
    );
    rejectFetch = true;
    await assert.rejects(
      service.generateRoutineGroq(requestParams),
      TypeError
    );
    assert.equal(calls.length, 3);

    const component = await readFile(
      path.join(root, 'components', 'RoutinesView.tsx'),
      'utf8'
    );
    assert.match(component, /from '\.\.\/services\/aiService\.edge'/);
    assert.doesNotMatch(component, /from '\.\.\/services\/aiService'/);
    assert.match(component, /import\.meta\.env\.DEV === true/);
    assert.match(component, /import\.meta\.env\.PROD === true/);
    assert.match(component, /import\.meta\.env\.VITE_AI_ROUTINE_PILOT/);
    assert.match(component, /window\.location\.origin/);
    assert.match(component, /isAiPilotEnabled\(isDevelopment, isProduction, pilotFlag, origin, isLoggedIn\)/);

    const basicHandlerStart = component.indexOf('const handleAiGenerateBasic');
    const saveHandlerStart = component.indexOf('const handleSavePilotRoutine', basicHandlerStart);
    const proHandlerStart = component.indexOf('const handleAiGeneratePro');
    const basicHandler = component.slice(basicHandlerStart, saveHandlerStart);
    assert.ok(basicHandlerStart >= 0 && proHandlerStart > basicHandlerStart);
    assert.match(basicHandler, /!routinePilotEnabled/);
    assert.match(basicHandler, /routinePilotRequestInFlight\.current/);
    assert.match(basicHandler, /if \(!window\.confirm\(/);
    assert.ok(
      basicHandler.indexOf('window.confirm(') <
        basicHandler.indexOf('generateRoutineGroq({')
    );
    assert.match(basicHandler, /objective: aiObjective/);
    assert.match(basicHandler, /level: aiLevel/);
    assert.match(basicHandler, /focuses: aiFocuses/);
    assert.match(basicHandler, /equipment: aiEquipment\.trim\(\)/);
    assert.match(basicHandler, /mode: 'basic'/);
    assert.match(basicHandler, /sessionMinutes: parsedSessionMinutes/);
    assert.match(basicHandler, /routinePilotRequestInFlight\.current = true/);
    assert.match(basicHandler, /finally\s*\{\s*routinePilotRequestInFlight\.current = false/);
    assert.doesNotMatch(basicHandler, /onSaveRoutine|setActiveTab\('list'\)/);
    assert.match(component, /Vista previa de la rutina generada; no se ha guardado/);
    assert.match(component, /const handleSavePilotRoutine = async/);
    assert.match(component, /setPilotRoutine\(newRoutine\)/);
    assert.match(component, /No se pudo completar la prueba de rutina/);
    assert.match(component, /aria-pressed=\{isSelected\}/);
    assert.match(component, /toggleRoutineFocus\(current, focus\)/);
    assert.match(component, /Puedes elegir varios grupos musculares/);
    assert.equal((component.match(/generateRoutineGroq\(/g) ?? []).length, 1);

    const proHandler = component.slice(proHandlerStart, component.indexOf('const isWeeklyPlan'));
    assert.match(proHandler, /const handleAiGeneratePro = \(\) => undefined;/);
    assert.doesNotMatch(proHandler, /generateRoutineGroq|onSaveRoutine/);
    assert.match(component, /onClick=\{handleAiGeneratePro\}\s+disabled\s+/);
    assert.match(component, /Plan semanal IA no disponible todavía/);
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
