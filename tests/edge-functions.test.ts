/**
 * Pruebas unitarias para Edge Functions de TitanTrack.
 * Ejecutar con: deno test --allow-net --allow-env
 * Estas pruebas no llaman al proveedor de IA real. Simulan respuestas.
 */

import { assertEquals } from 'https://deno.land/std@0.223.0/assert/mod.ts';
import { corsCheck, corsOptionsResponse, isAllowedOrigin } from '../supabase/functions/_shared/cors.ts';
import { validateSession, isPilotUserAllowed } from '../supabase/functions/_shared/auth.ts';
import { ClosedRateLimiter, RateLimiterNotConfiguredError } from '../supabase/functions/_shared/rate-limit.ts';
import { GroqClientError } from '../supabase/functions/_shared/groq-client.ts';
import { ValidationErrorImpl, validateRoutineResponse } from '../supabase/functions/_shared/validate.ts';
import { handler as recommendationsHandler } from '../supabase/functions/groq-recommendations/index.ts';
import { handler as routineHandler } from '../supabase/functions/groq-routine/index.ts';

// Configuración predeterminada de entorno para permitir el usuario de pruebas mockeado (user-123)
Deno.env.set('AI_PILOT_USER_IDS', 'user-123');

// ==============================
// Mocks de dependencias
// ==============================

interface SessionMock {
  userId: string;
  email?: string;
}

const mockValidateSession = (shouldBeAuthenticated: boolean) => {
  return async (_req: Request): Promise<SessionMock | null> => {
    if (!shouldBeAuthenticated) return null;
    return { userId: 'user-123', email: 'test@test.com' };
  };
};

interface GroqCall {
  messages: Array<{ role: string; content: string }>;
}

const createMockCallGroq = ({
  shouldThrowTimeout = false,
  shouldReturnInvalid = false,
  validResponse = '',
}: {
  shouldThrowTimeout?: boolean;
  shouldReturnInvalid?: boolean;
  validResponse?: string;
}) => {
  const state = { callCount: 0 };
  const calls: GroqCall[] = [];

  const mockCallGroq = async (messages: Array<{ role: string; content: string }>): Promise<string> => {
    state.callCount++;
    calls.push({ messages });

    if (shouldThrowTimeout) {
      throw new GroqClientError({
        status: 504,
        message: 'Tiempo de espera agotado al contactar con el proveedor de IA',
      });
    }

    if (shouldReturnInvalid) {
      throw new GroqClientError({
        status: 502,
        message: 'Respuesta inesperada del proveedor de IA',
      });
    }

    return validResponse;
  };

  return { mockCallGroq, get callCount() { return state.callCount; }, calls };
};

class MockRateLimiterAllow {
  async check(_userId: string, _functionName: string) {
    return { allowed: true, remaining: 9, resetAt: new Date(Date.now() + 86400000) };
  }
}

class MockRateLimiterDeny {
  async check(_userId: string, _functionName: string) {
    return { allowed: false, remaining: 0, resetAt: new Date(Date.now() + 86400000) };
  }
}

class MockRateLimiterThrow {
  async check(_userId: string, _functionName: string) {
    throw new RateLimiterNotConfiguredError();
  }
}

function createRateLimiterSpy(allowed = true) {
  let callCount = 0;
  class RateLimiterSpy {
    async check(_userId: string, _functionName: string) {
      callCount++;
      return {
        allowed,
        remaining: allowed ? 9 : 0,
        resetAt: new Date(Date.now() + 86400000),
      };
    }
  }
  return { RateLimiter: RateLimiterSpy, get callCount() { return callCount; } };
}

function createRequest(
  method: string,
  origin: string | null,
  body?: unknown,
  token?: string
): Request {
  const headers: Record<string, string> = {};
  if (origin) headers['Origin'] = origin;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  return new Request('https://aziowzwhizjytzcqfent.supabase.co/functions/v1/test', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

Deno.test('CORS: origen permitido devuelve null en corsCheck', () => {
  const result = corsCheck('http://localhost:3001');
  assertEquals(result, null);
});

Deno.test('CORS: origen permitido de Vercel devuelve null en corsCheck', () => {
  const result = corsCheck('https://titantrack-clean.vercel.app');
  assertEquals(result, null);
});

Deno.test('CORS: origen no permitido devuelve Response 403', () => {
  const result = corsCheck('https://sitio-malicioso.com');
  assertEquals(result instanceof Response, true);
  if (result instanceof Response) {
    assertEquals(result.status, 403);
  }
});

Deno.test('CORS: origen nulo devuelve Response 403', () => {
  const result = corsCheck(null);
  assertEquals(result instanceof Response, true);
  if (result instanceof Response) {
    assertEquals(result.status, 403);
  }
});

Deno.test('Rate limiter: ClosedRateLimiter siempre rechaza', async () => {
  const limiter = new ClosedRateLimiter();
  let threw = false;
  try {
    await limiter.check('user-123', 'groq-recommendations');
  } catch (err) {
    threw = err instanceof RateLimiterNotConfiguredError;
  }
  assertEquals(threw, true);
});

Deno.test('Auth: validateSession sin token devuelve null', async () => {
  const req = createRequest('POST', 'http://localhost:3001', { workouts: [], profile: {} });
  const session = await validateSession(req);
  assertEquals(session, null);
});

Deno.test('Auth: validateSession con token inválido devuelve null', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = Deno.env.get('SUPABASE_URL');
  const originalAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  let fetchCalls = 0;

  try {
    Deno.env.set('SUPABASE_URL', 'https://supabase-auth.test');
    Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');
    globalThis.fetch = async () => {
      fetchCalls++;
      return new Response(JSON.stringify({ message: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const req = createRequest(
      'POST',
      'http://localhost:3001',
      { workouts: [], profile: {} },
      'invalid-test-token'
    );
    const session = await validateSession(req);

    assertEquals(session, null);
    assertEquals(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) Deno.env.delete('SUPABASE_URL');
    else Deno.env.set('SUPABASE_URL', originalUrl);
    if (originalAnonKey === undefined) Deno.env.delete('SUPABASE_ANON_KEY');
    else Deno.env.set('SUPABASE_ANON_KEY', originalAnonKey);
  }
});

Deno.test('groq-recommendations: sin sesión devuelve 401', async () => {
  const mock = createMockCallGroq({ validResponse: '[]' });
  const limiter = createRateLimiterSpy();
  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [],
    profile: { displayName: '', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });
  const res = await recommendationsHandler(req, {
    validateSession: mockValidateSession(false),
    callGroq: mock.mockCallGroq,
    RateLimiter: limiter.RateLimiter,
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, 'No autorizado');
  assertEquals(limiter.callCount, 0);
  assertEquals(mock.callCount, 0);
});

Deno.test('groq-routine: sin sesión devuelve 401', async () => {
  const mock = createMockCallGroq({ validResponse: JSON.stringify({ name: 'x', description: 'x', exercises: [] }) });
  const limiter = createRateLimiterSpy();
  const req = createRequest('POST', 'http://localhost:3001', { daysPerWeek: '3', objective: 'test', level: 'intermedio' });
  const res = await routineHandler(req, {
    validateSession: mockValidateSession(false),
    callGroq: mock.mockCallGroq,
    RateLimiter: limiter.RateLimiter,
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, 'No autorizado');
  assertEquals(limiter.callCount, 0);
  assertEquals(mock.callCount, 0);
});

Deno.test('groq-recommendations: origen no permitido devuelve 403', async () => {
  const req = createRequest('POST', 'https://sitio-malicioso.com', { workouts: [], profile: {} });
  const res = await recommendationsHandler(req);
  assertEquals(res.status, 403);
});

Deno.test('groq-routine: origen no permitido devuelve 403', async () => {
  const req = createRequest('POST', 'https://sitio-malicioso.com', { daysPerWeek: '3', objective: 'test', level: 'intermedio' });
  const res = await routineHandler(req);
  assertEquals(res.status, 403);
});

Deno.test('groq-recommendations: cuerpo inválido devuelve 400', async () => {
  const req = createRequest('POST', 'http://localhost:3001', 'no-es-json');
  const res = await recommendationsHandler(req);
  assertEquals(res.status, 400);
});

Deno.test('groq-routine: entrada inválida con usuario autenticado devuelve 400', async () => {
  const req = createRequest('POST', 'http://localhost:3001', { daysPerWeek: 'abc', objective: 'test', level: 'intermedio' });
  const res = await routineHandler(req, {
    validateSession: mockValidateSession(true),
  });
  assertEquals(res.status, 400);
});

Deno.test('groq-recommendations: rate limiter cerrado bloquea antes de Groq', async () => {
  const limiter = new ClosedRateLimiter();
  let threw = false;
  try {
    await limiter.check('user-123', 'groq-recommendations');
  } catch (err) {
    threw = err instanceof RateLimiterNotConfiguredError;
  }
  assertEquals(threw, true);
});

Deno.test('groq-recommendations: body inválido (no workouts) devuelve 400', async () => {
  const req = createRequest('POST', 'http://localhost:3001', { profile: {} });
  const res = await recommendationsHandler(req);
  assertEquals(res.status, 400);
});

Deno.test('groq-routine: días fuera de rango con usuario autenticado devuelve 400', async () => {
  const req = createRequest('POST', 'http://localhost:3001', { daysPerWeek: '0', objective: 'test', level: 'intermedio' });
  const res = await routineHandler(req, {
    validateSession: mockValidateSession(true),
  });
  assertEquals(res.status, 400);
});

Deno.test('groq-recommendations: entrada mal formada devuelve 400 antes de cuota y Groq', async () => {
  const mock = createMockCallGroq({ validResponse: '[]' });
  const limiter = createRateLimiterSpy();
  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [{ id: 'w1', date: '2024-01-01', name: 'Pecho', exercises: [{ id: 'e1', name: 'Press', category: 'fuerza', sets: [{ id: 's1', reps: '10', weight: 20 }] }] }],
    profile: { displayName: '', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const res = await recommendationsHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: limiter.RateLimiter,
  });

  assertEquals(res.status, 400);
  assertEquals(limiter.callCount, 0);
  assertEquals(mock.callCount, 0);
});

Deno.test('groq-routine: días inválidos y modo desconocido se rechazan antes de cuota y Groq', async () => {
  const invalidRequests = [
    { daysPerWeek: '3abc', objective: 'test', level: 'intermedio' },
    { daysPerWeek: '3.5', objective: 'test', level: 'intermedio' },
    { daysPerWeek: '0', objective: 'test', level: 'intermedio' },
    { daysPerWeek: '8', objective: 'test', level: 'intermedio' },
    { daysPerWeek: '3 días', objective: 'test', level: 'intermedio', mode: 'unknown' },
  ];

  for (const body of invalidRequests) {
    const mock = createMockCallGroq({ validResponse: '{}' });
    const limiter = createRateLimiterSpy();
    const req = createRequest('POST', 'http://localhost:3001', body);
    const res = await routineHandler(req, {
      validateSession: mockValidateSession(true),
      callGroq: mock.mockCallGroq,
      RateLimiter: limiter.RateLimiter,
    });

    assertEquals(res.status, 400);
    assertEquals(limiter.callCount, 0);
    assertEquals(mock.callCount, 0);
  }
});

Deno.test('ambos handlers rechazan cuerpos multibyte mayores de 100.000 bytes', async () => {
  const oversizedText = 'ñ'.repeat(50001);
  const recommendationsBody = {
    workouts: [],
    profile: { displayName: oversizedText, plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  };
  const routineBody = { daysPerWeek: '3 días', objective: oversizedText, level: 'intermedio' };

  for (const [handlerFn, body] of [
    [recommendationsHandler, recommendationsBody],
    [routineHandler, routineBody],
  ] as const) {
    const mock = createMockCallGroq({ validResponse: '[]' });
    const limiter = createRateLimiterSpy();
    const req = createRequest('POST', 'http://localhost:3001', body);
    const serializedBody = JSON.stringify(body);
    assertEquals(serializedBody.length < 100_000, true);
    assertEquals(new TextEncoder().encode(serializedBody).length > 100_000, true);

    const res = await handlerFn(req, {
      validateSession: mockValidateSession(true),
      callGroq: mock.mockCallGroq,
      RateLimiter: limiter.RateLimiter,
    });

    assertEquals(res.status, 413);
    assertEquals(limiter.callCount, 0);
    assertEquals(mock.callCount, 0);
  }
});

Deno.test('groq-recommendations: body válido sin sesión devuelve 401', async () => {
  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [],
    profile: { displayName: 'test', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} }
  });
  const res = await recommendationsHandler(req);
  assertEquals(res.status, 401);
});

Deno.test('groq-routine: body válido sin sesión devuelve 401', async () => {
  const req = createRequest('POST', 'http://localhost:3001', {
    daysPerWeek: '3', objective: 'test', level: 'intermedio'
  });
  const res = await routineHandler(req);
  assertEquals(res.status, 401);
});

Deno.test('GroqClientError: mensaje genérico sin filtrar detalles internos', () => {
  const err = new GroqClientError({ status: 502, message: 'Error del proveedor de IA (502)' });
  assertEquals(err.info.status, 502);
  assertEquals(err.info.message, 'Error del proveedor de IA (502)');
  assertEquals(err.info.message.includes('Bearer'), false);
  assertEquals(err.info.message.includes('sk_'), false);
});

// ==============================
// Pruebas de cuota agotada y rechazos sin llamar a Groq
// ==============================

Deno.test('groq-recommendations: cuota agotada devuelve 429 y no llama a Groq', async () => {
  const mock = createMockCallGroq({ validResponse: '[]' });

  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [],
    profile: { displayName: 'test', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const res = await recommendationsHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterDeny,
  });

  assertEquals(res.status, 429);
  assertEquals(mock.callCount, 0);
});

Deno.test('groq-routine: cuota agotada devuelve 429 y no llama a Groq', async () => {
  const mock = createMockCallGroq({
    validResponse: JSON.stringify({ name: 'x', description: 'x', exercises: [] }),
  });

  const req = createRequest('POST', 'http://localhost:3001', {
    daysPerWeek: '3',
    objective: 'test',
    level: 'intermedio',
  });

  const res = await routineHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterDeny,
  });

  assertEquals(res.status, 429);
  assertEquals(mock.callCount, 0);
});

Deno.test('groq-routine: pro_plan sigue bloqueado antes de cuota y Groq', async () => {
  const mock = createMockCallGroq({
    validResponse: JSON.stringify({ name: 'x', description: 'x', exercises: [] }),
  });
  const limiter = createRateLimiterSpy();
  const req = createRequest('POST', 'http://localhost:3001', {
    daysPerWeek: '3 días',
    objective: 'test',
    level: 'intermedio',
    mode: 'pro_plan',
  });

  const res = await routineHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: limiter.RateLimiter,
  });

  assertEquals(res.status, 403);
  assertEquals(limiter.callCount, 0);
  assertEquals(mock.callCount, 0);
});

// ==============================
// Pruebas de errores del proveedor (timeout y respuesta inválida)
// ==============================

Deno.test('groq-recommendations: timeout del proveedor devuelve 504', async () => {
  const mock = createMockCallGroq({ shouldThrowTimeout: true });

  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [],
    profile: { displayName: 'test', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const res = await recommendationsHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterAllow,
  });

  assertEquals(res.status, 504);
  const body = await res.json();
  assertEquals(body.error, 'Tiempo de espera agotado al contactar con el proveedor de IA');
  assertEquals(mock.callCount, 1);
});

Deno.test('groq-routine: timeout del proveedor devuelve 504', async () => {
  const mock = createMockCallGroq({ shouldThrowTimeout: true });

  const req = createRequest('POST', 'http://localhost:3001', {
    daysPerWeek: '3',
    objective: 'test',
    level: 'intermedio',
  });

  const res = await routineHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterAllow,
  });

  assertEquals(res.status, 504);
  const body = await res.json();
  assertEquals(body.error, 'Tiempo de espera agotado al contactar con el proveedor de IA');
  assertEquals(mock.callCount, 1);
});

Deno.test('groq-recommendations: respuesta inválida del proveedor devuelve 502', async () => {
  const mock = createMockCallGroq({ shouldReturnInvalid: true });

  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [],
    profile: { displayName: 'test', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const res = await recommendationsHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterAllow,
  });

  assertEquals(res.status, 502);
  const body = await res.json();
  assertEquals(body.error, 'Respuesta inesperada del proveedor de IA');
  assertEquals(mock.callCount, 1);
});

Deno.test('groq-routine: respuesta inválida del proveedor devuelve 502', async () => {
  const mock = createMockCallGroq({ shouldReturnInvalid: true });

  const req = createRequest('POST', 'http://localhost:3001', {
    daysPerWeek: '3',
    objective: 'test',
    level: 'intermedio',
  });

  const res = await routineHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterAllow,
  });

  assertEquals(res.status, 502);
  const body = await res.json();
  assertEquals(body.error, 'Respuesta inesperada del proveedor de IA');
  assertEquals(mock.callCount, 1);
});

Deno.test('groq-recommendations: esquema inválido de Groq devuelve 502 controlado', async () => {
  const providerText = JSON.stringify([
    { title: 'raw-provider-content', description: 'desc', category: 'unknown' },
  ]);
  const mock = createMockCallGroq({ validResponse: providerText });
  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [],
    profile: { displayName: '', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const res = await recommendationsHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterAllow,
  });

  assertEquals(res.status, 502);
  const body = await res.json();
  assertEquals(body.error, 'Respuesta inesperada del proveedor de IA');
  assertEquals(JSON.stringify(body).includes(providerText), false);
  assertEquals(mock.callCount, 1);
});

Deno.test('groq-routine: esquema inválido de Groq devuelve 502 controlado', async () => {
  const invalidProviderResponses = [
    { name: 'raw-provider-content', description: 'desc', exercises: [] },
    {
      name: 'raw-provider-content',
      description: 'desc',
      exercises: [{ name: 'Press', sets: 2.5, reps: '10', restTime: '60s' }],
    },
    {
      name: 'raw-provider-content',
      description: 'desc',
      exercises: [{ name: 'Press', sets: 101, reps: '10', restTime: '60s' }],
    },
  ];

  for (const invalidResponse of invalidProviderResponses) {
    const providerText = JSON.stringify(invalidResponse);
    const mock = createMockCallGroq({ validResponse: providerText });
    const req = createRequest('POST', 'http://localhost:3001', {
      daysPerWeek: '3',
      objective: 'test',
      level: 'intermedio',
    });

    const res = await routineHandler(req, {
      validateSession: mockValidateSession(true),
      callGroq: mock.mockCallGroq,
      RateLimiter: MockRateLimiterAllow,
    });

    assertEquals(res.status, 502);
    const body = await res.json();
    assertEquals(body.error, 'Respuesta inesperada del proveedor de IA');
    assertEquals(JSON.stringify(body).includes(providerText), false);
    assertEquals(mock.callCount, 1);
  }
});

// ==============================
// Pruebas de contador: rechazos no llaman a Groq
// ==============================

Deno.test('Contador: rechazo por sesión ausente no llama a Groq', async () => {
  const mock = createMockCallGroq({ validResponse: '[]' });

  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [],
    profile: { displayName: 'test', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const res = await recommendationsHandler(req, {
    validateSession: mockValidateSession(false),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterAllow,
  });

  assertEquals(res.status, 401);
  assertEquals(mock.callCount, 0);
});

Deno.test('Contador: rechazo por entrada inválida no llama a Groq', async () => {
  const mock = createMockCallGroq({ validResponse: '[]' });

  const req = createRequest('POST', 'http://localhost:3001', { profile: {} });

  const res = await recommendationsHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterAllow,
  });

  assertEquals(res.status, 400);
  assertEquals(mock.callCount, 0);
});

Deno.test('Contador: rechazo por origen no permitido no llama a Groq', async () => {
  const mock = createMockCallGroq({ validResponse: '[]' });

  const req = createRequest('POST', 'https://sitio-malicioso.com', {
    workouts: [],
    profile: { displayName: 'test', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const res = await recommendationsHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterAllow,
  });

  assertEquals(res.status, 403);
  assertEquals(mock.callCount, 0);
});

// ==============================
// Pruebas de flujo exitoso (usuario autenticado + entrada válida)
// ==============================

Deno.test('groq-recommendations: usuario autenticado + entrada válida devuelve 200 y contrato de salida', async () => {
  const mock = createMockCallGroq({
    validResponse: JSON.stringify([
      { title: 'Fuerza', description: 'Mejora tu press de banca', category: 'strength' },
      { title: 'Recuperación', description: 'Duerme 8 horas', category: 'recovery' },
    ]),
  });

  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [
      {
        id: 'w1',
        date: '2024-01-01',
        name: 'Pecho',
        exercises: [
          {
            id: 'e1',
            name: 'Press banca',
            category: 'fuerza',
            sets: [{ id: 's1', reps: 10, weight: 60 }],
          },
        ],
      },
    ],
    profile: {
      displayName: 'Test',
      plan: 'free',
      sex: '',
      goal: '',
      level: '',
      preferredStyle: '',
      equipment: [],
      limitations: '',
      measurements: {},
    },
  });

  const res = await recommendationsHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterAllow,
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(Array.isArray(body), true);
  assertEquals(body.length, 2);
  assertEquals(body[0].category, 'strength');
  assertEquals(body[0].title, 'Fuerza');
  assertEquals(body[0].description, 'Mejora tu press de banca');
  assertEquals(mock.callCount, 1);
});

Deno.test('groq-routine: usuario autenticado + entrada válida devuelve 200 y contrato de salida', async () => {
  const mock = createMockCallGroq({
    validResponse: JSON.stringify({
      name: 'Rutina prueba',
      description: 'Rutina de prueba',
      exercises: [
        { name: 'Press banca', sets: 4, reps: '6-8', restTime: '90s' },
      ],
    }),
  });

  const req = createRequest('POST', 'http://localhost:3001', {
    daysPerWeek: '3 días',
    objective: 'Crecimiento muscular',
    level: 'intermedio',
    equipment: '',
  });

  const res = await routineHandler(req, {
    validateSession: mockValidateSession(true),
    callGroq: mock.mockCallGroq,
    RateLimiter: MockRateLimiterAllow,
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.name, 'Rutina prueba');
  assertEquals(body.description, 'Rutina de prueba');
  assertEquals(Array.isArray(body.exercises), true);
  assertEquals(body.exercises.length, 1);
  assertEquals(typeof body.id, 'string');
  assertEquals(body.id.length > 0, true);
  assertEquals(typeof body.exercises[0].id, 'string');
  assertEquals(body.exercises[0].id.length > 0, true);
  assertEquals(body.exercises[0].name, 'Press banca');
  assertEquals(body.exercises[0].sets, 4);
  assertEquals(body.exercises[0].reps, '6-8');
  assertEquals(body.exercises[0].restTime, '90s');
  assertEquals(mock.calls[0].messages[0].content.includes('- Días por semana: 3'), true);
  assertEquals(mock.callCount, 1);
});

Deno.test('validateRoutineResponse: exige ejercicios y series enteras dentro del rango', () => {
  const validRoutine = validateRoutineResponse(JSON.stringify({
    name: 'Rutina válida',
    description: 'Prueba',
    exercises: [{ name: 'Press', sets: 4, reps: '8-10', restTime: '60s' }],
  }));
  assertEquals(validRoutine.exercises[0].sets, 4);

  const invalidProviderResponses = [
    { name: 'Rutina', description: 'Prueba', exercises: [] },
    {
      name: 'Rutina',
      description: 'Prueba',
      exercises: [{ name: 'Press', sets: 2.5, reps: '8-10', restTime: '60s' }],
    },
    {
      name: 'Rutina',
      description: 'Prueba',
      exercises: [{ name: 'Press', sets: 101, reps: '8-10', restTime: '60s' }],
    },
  ];

  for (const invalidResponse of invalidProviderResponses) {
    let caught: unknown;
    try {
      validateRoutineResponse(JSON.stringify(invalidResponse));
    } catch (error) {
      caught = error;
    }
    assertEquals(caught instanceof ValidationErrorImpl, true);
    if (caught instanceof ValidationErrorImpl) {
      assertEquals(caught.status, 502);
      assertEquals(caught.code, 'invalid_provider_response');
    }
  }
});

Deno.test('Auth: sesión inválida devuelve 401 sin consumir cuota ni llamar a Groq', async () => {
  const mock = createMockCallGroq({ validResponse: '[]' });
  const limiter = createRateLimiterSpy();
  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [],
    profile: { displayName: '', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  }, 'token-invalido');

  const res = await recommendationsHandler(req, {
    validateSession: mockValidateSession(false),
    callGroq: mock.mockCallGroq,
    RateLimiter: limiter.RateLimiter,
  });

  assertEquals(res.status, 401);
  assertEquals(limiter.callCount, 0);
  assertEquals(mock.callCount, 0);
});

Deno.test('CORS preflight: origen permitido devuelve 204', () => {
  const result = corsOptionsResponse('http://localhost:3001');
  assertEquals(result.status, 204);
});

Deno.test('CORS preflight: origen no permitido devuelve 403', () => {
  const result = corsOptionsResponse('https://sitio-malicioso.com');
  assertEquals(result.status, 403);
});

Deno.test('CORS: isAllowedOrigin devuelve true para localhost:3001', () => {
  assertEquals(isAllowedOrigin('http://localhost:3001'), true);
});

Deno.test('CORS: isAllowedOrigin devuelve true para Vercel', () => {
  assertEquals(isAllowedOrigin('https://titantrack-clean.vercel.app'), true);
});

Deno.test('CORS: isAllowedOrigin devuelve false para origen no permitido', () => {
  assertEquals(isAllowedOrigin('https://otro.com'), false);
});

Deno.test('CORS: isAllowedOrigin devuelve false para null', () => {
  assertEquals(isAllowedOrigin(null), false);
});

// ============================================================================
// Pruebas de restricción de piloto (AI_PILOT_USER_IDS)
// ============================================================================

Deno.test('Piloto: isPilotUserAllowed valida UUIDs en lista separada por comas', () => {
  const orig = Deno.env.get('AI_PILOT_USER_IDS');
  try {
    Deno.env.set('AI_PILOT_USER_IDS', '462dd84e-fbba-4181-a03d-2eadc3b0751d, user-abc');

    assertEquals(isPilotUserAllowed('462dd84e-fbba-4181-a03d-2eadc3b0751d'), true);
    assertEquals(isPilotUserAllowed('462DD84E-FBBA-4181-A03D-2EADC3B0751D'), true);
    assertEquals(isPilotUserAllowed('user-abc'), true);

    assertEquals(isPilotUserAllowed('otro-usuario-no-incluido'), false);
    assertEquals(isPilotUserAllowed(''), false);
    assertEquals(isPilotUserAllowed('   '), false);
  } finally {
    if (orig !== undefined) Deno.env.set('AI_PILOT_USER_IDS', orig);
    else Deno.env.delete('AI_PILOT_USER_IDS');
  }
});

Deno.test('Piloto: configuración ausente o vacía deniega acceso de forma segura', () => {
  const orig = Deno.env.get('AI_PILOT_USER_IDS');
  try {
    Deno.env.delete('AI_PILOT_USER_IDS');
    assertEquals(isPilotUserAllowed('462dd84e-fbba-4181-a03d-2eadc3b0751d'), false);

    Deno.env.set('AI_PILOT_USER_IDS', '');
    assertEquals(isPilotUserAllowed('462dd84e-fbba-4181-a03d-2eadc3b0751d'), false);

    Deno.env.set('AI_PILOT_USER_IDS', '   ');
    assertEquals(isPilotUserAllowed('462dd84e-fbba-4181-a03d-2eadc3b0751d'), false);
  } finally {
    if (orig !== undefined) Deno.env.set('AI_PILOT_USER_IDS', orig);
    else Deno.env.delete('AI_PILOT_USER_IDS');
  }
});

Deno.test('Piloto: usuario permitido alcanza el flujo siguiente (cuota y Groq)', async () => {
  const mock = createMockCallGroq({
    validResponse: JSON.stringify([{ title: 'Rec 1', description: 'Desc 1', category: 'strength' }]),
  });

  let rateLimiterCalled = false;
  class SpyRateLimiter {
    async check() {
      rateLimiterCalled = true;
      return { allowed: true, remaining: 9, resetAt: new Date() };
    }
  }

  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [],
    profile: { displayName: 'test', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const orig = Deno.env.get('AI_PILOT_USER_IDS');
  try {
    Deno.env.set('AI_PILOT_USER_IDS', '462dd84e-fbba-4181-a03d-2eadc3b0751d');

    const res = await recommendationsHandler(req, {
      validateSession: async () => ({ userId: '462dd84e-fbba-4181-a03d-2eadc3b0751d', email: 'pilot@test.com' }),
      callGroq: mock.mockCallGroq,
      RateLimiter: SpyRateLimiter as any,
    });

    assertEquals(res.status, 200);
    assertEquals(rateLimiterCalled, true);
    assertEquals(mock.callCount, 1);
  } finally {
    if (orig !== undefined) Deno.env.set('AI_PILOT_USER_IDS', orig);
    else Deno.env.delete('AI_PILOT_USER_IDS');
  }
});

Deno.test('Piloto: usuario no permitido devuelve 403, no consume cuota y no llama a Groq', async () => {
  const mock = createMockCallGroq({ validResponse: '[]' });

  let rateLimiterCalled = false;
  class SpyRateLimiter {
    async check() {
      rateLimiterCalled = true;
      return { allowed: true, remaining: 10, resetAt: new Date() };
    }
  }

  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [],
    profile: { displayName: 'test', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const orig = Deno.env.get('AI_PILOT_USER_IDS');
  try {
    Deno.env.set('AI_PILOT_USER_IDS', '462dd84e-fbba-4181-a03d-2eadc3b0751d');

    const res = await recommendationsHandler(req, {
      validateSession: async () => ({ userId: 'usuario-ajeno-no-autorizado', email: 'otro@test.com' }),
      callGroq: mock.mockCallGroq,
      RateLimiter: SpyRateLimiter as any,
    });

    assertEquals(res.status, 403);
    assertEquals(rateLimiterCalled, false);
    assertEquals(mock.callCount, 0);
    const data = await res.json();
    assertEquals(data.error.includes('piloto'), true);
  } finally {
    if (orig !== undefined) Deno.env.set('AI_PILOT_USER_IDS', orig);
    else Deno.env.delete('AI_PILOT_USER_IDS');
  }
});

Deno.test('Piloto: groq-routine devuelve 403, no consume cuota y no llama a Groq ante usuario no autorizado', async () => {
  const mock = createMockCallGroq({
    validResponse: JSON.stringify({ name: 'x', description: 'x', exercises: [] }),
  });

  let rateLimiterCalled = false;
  class SpyRateLimiter {
    async check() {
      rateLimiterCalled = true;
      return { allowed: true, remaining: 5, resetAt: new Date() };
    }
  }

  const req = createRequest('POST', 'http://localhost:3001', {
    daysPerWeek: '3',
    objective: 'test',
    level: 'intermedio',
  });

  const orig = Deno.env.get('AI_PILOT_USER_IDS');
  try {
    Deno.env.set('AI_PILOT_USER_IDS', '462dd84e-fbba-4181-a03d-2eadc3b0751d');

    const res = await routineHandler(req, {
      validateSession: async () => ({ userId: 'usuario-no-en-piloto', email: 'otro@test.com' }),
      callGroq: mock.mockCallGroq,
      RateLimiter: SpyRateLimiter as any,
    });

    assertEquals(res.status, 403);
    assertEquals(rateLimiterCalled, false);
    assertEquals(mock.callCount, 0);
  } finally {
    if (orig !== undefined) Deno.env.set('AI_PILOT_USER_IDS', orig);
    else Deno.env.delete('AI_PILOT_USER_IDS');
  }
});

Deno.test('Piloto: inyección de user_id o email en body no permite suplantar acceso (rechazo 403)', async () => {
  const mock = createMockCallGroq({ validResponse: '[]' });
  let rateLimiterCalled = false;
  class SpyRateLimiter {
    async check() {
      rateLimiterCalled = true;
      return { allowed: true, remaining: 10, resetAt: new Date() };
    }
  }

  // Intento malicioso: inyectar el UUID permitido en el body
  const req = createRequest('POST', 'http://localhost:3001', {
    user_id: '462dd84e-fbba-4181-a03d-2eadc3b0751d',
    userId: '462dd84e-fbba-4181-a03d-2eadc3b0751d',
    email: 'pilot@test.com',
    workouts: [],
    profile: { displayName: 'test', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const orig = Deno.env.get('AI_PILOT_USER_IDS');
  try {
    Deno.env.set('AI_PILOT_USER_IDS', '462dd84e-fbba-4181-a03d-2eadc3b0751d');

    // La sesión validada pertenece a un usuario no autorizado
    const res = await recommendationsHandler(req, {
      validateSession: async () => ({ userId: 'atacante-no-autorizado', email: 'attacker@test.com' }),
      callGroq: mock.mockCallGroq,
      RateLimiter: SpyRateLimiter as any,
    });

    // Debe ser rechazado porque se valida exclusivamente contra session.userId
    assertEquals(res.status, 403);
    assertEquals(rateLimiterCalled, false);
    assertEquals(mock.callCount, 0);
  } finally {
    if (orig !== undefined) Deno.env.set('AI_PILOT_USER_IDS', orig);
    else Deno.env.delete('AI_PILOT_USER_IDS');
  }
});

Deno.test('Piloto: usuario autorizado en sesión no es bloqueado aunque el body contenga otro identificador', async () => {
  const mock = createMockCallGroq({
    validResponse: JSON.stringify([{ title: 'Rec', description: 'Desc', category: 'strength' }]),
  });

  const req = createRequest('POST', 'http://localhost:3001', {
    user_id: 'otro-identificador-arbitrario',
    workouts: [],
    profile: { displayName: 'test', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const orig = Deno.env.get('AI_PILOT_USER_IDS');
  try {
    Deno.env.set('AI_PILOT_USER_IDS', '462dd84e-fbba-4181-a03d-2eadc3b0751d');

    const res = await recommendationsHandler(req, {
      validateSession: async () => ({ userId: '462dd84e-fbba-4181-a03d-2eadc3b0751d', email: 'pilot@test.com' }),
      callGroq: mock.mockCallGroq,
      RateLimiter: MockRateLimiterAllow,
    });

    assertEquals(res.status, 200);
    assertEquals(mock.callCount, 1);
  } finally {
    if (orig !== undefined) Deno.env.set('AI_PILOT_USER_IDS', orig);
    else Deno.env.delete('AI_PILOT_USER_IDS');
  }
});


Deno.test('ServerRateLimiter por defecto: falta de configuración en entorno falla de forma segura con 503', async () => {
  const mock = createMockCallGroq({ validResponse: '[]' });

  const req = createRequest('POST', 'http://localhost:3001', {
    workouts: [],
    profile: { displayName: 'test', plan: 'free', sex: '', goal: '', level: '', preferredStyle: '', equipment: [], limitations: '', measurements: {} },
  });

  const origUrl = Deno.env.get('SUPABASE_URL');
  const origKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const origPilot = Deno.env.get('AI_PILOT_USER_IDS');
  try {
    Deno.env.delete('SUPABASE_URL');
    Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    Deno.env.set('AI_PILOT_USER_IDS', 'user-123');

    // Sin inyectar RateLimiter: utiliza ServerRateLimiter por defecto
    const res = await recommendationsHandler(req, {
      validateSession: mockValidateSession(true),
      callGroq: mock.mockCallGroq,
    });

    // Falla de forma segura con 503 sin llamar a Groq
    assertEquals(res.status, 503);
    assertEquals(mock.callCount, 0);
    const data = await res.json();
    assertEquals(data.error.includes('no disponible temporalmente'), true);
  } finally {
    if (origUrl !== undefined) Deno.env.set('SUPABASE_URL', origUrl);
    else Deno.env.delete('SUPABASE_URL');
    if (origKey !== undefined) Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', origKey);
    else Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    if (origPilot !== undefined) Deno.env.set('AI_PILOT_USER_IDS', origPilot);
    else Deno.env.delete('AI_PILOT_USER_IDS');
  }
});

Deno.test('ServerRateLimiter por defecto en groq-routine: falta de configuración falla con 503', async () => {
  const mock = createMockCallGroq({
    validResponse: JSON.stringify({ name: 'x', description: 'x', exercises: [] }),
  });

  const req = createRequest('POST', 'http://localhost:3001', {
    daysPerWeek: '3',
    objective: 'test',
    level: 'intermedio',
  });

  const origUrl = Deno.env.get('SUPABASE_URL');
  const origKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const origPilot = Deno.env.get('AI_PILOT_USER_IDS');
  try {
    Deno.env.delete('SUPABASE_URL');
    Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    Deno.env.set('AI_PILOT_USER_IDS', 'user-123');

    // Sin inyectar RateLimiter: utiliza ServerRateLimiter por defecto
    const res = await routineHandler(req, {
      validateSession: mockValidateSession(true),
      callGroq: mock.mockCallGroq,
    });

    assertEquals(res.status, 503);
    assertEquals(mock.callCount, 0);
  } finally {
    if (origUrl !== undefined) Deno.env.set('SUPABASE_URL', origUrl);
    else Deno.env.delete('SUPABASE_URL');
    if (origKey !== undefined) Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', origKey);
    else Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
    if (origPilot !== undefined) Deno.env.set('AI_PILOT_USER_IDS', origPilot);
    else Deno.env.delete('AI_PILOT_USER_IDS');
  }
});
