/**
 * Pruebas unitarias para ServerRateLimiter con contrato RPC unificado y clasificacion estricta.
 *
 * Estas pruebas simulan el cliente RPC (this.supabase.rpc) en memoria.
 * No usan --allow-net: ninguna peticion de red real.
 * NOTA: No afirman haber probado la base de datos SQL ni concurrencia real,
 * las cuales quedan pendientes de ejecucion en un entorno de Supabase autorizado.
 */

import {
  assertEquals,
  assertRejects,
  assertThrows,
} from 'https://deno.land/std@0.223.0/assert/mod.ts';
import {
  ServerRateLimiter,
  RateLimiterNotConfiguredError,
  getNextUtcMidnight,
  parseStrictUtcTimestamp,
} from '../supabase/functions/_shared/server-rate-limit.ts';

function makeRpcMock(responses: Array<{ data?: unknown; error?: unknown }>) {
  let callIndex = 0;
  const calls: Array<{ fn: string; params: Record<string, unknown> }> = [];

  const rpc = async (fn: string, params: Record<string, unknown>) => {
    calls.push({ fn, params });
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return response;
  };

  return { rpc, calls };
}

// ============================================================================
// 1. Contrato unificado y flujo normal
// ============================================================================

Deno.test(
  'ServerRateLimiter: consumo permitido devuelve allowed true, remaining y resetAt validos',
  async () => {
    const mock = makeRpcMock([
      {
        data: {
          allowed: true,
          remaining: 9,
          reset_at: '2026-11-02T00:00:00Z',
        },
        error: null,
      },
    ]);
    const limiter = new ServerRateLimiter({ rpc: mock.rpc });

    const result = await limiter.check('user-123', 'groq-recommendations');

    assertEquals(result.allowed, true);
    assertEquals(result.remaining, 9);
    assertEquals(result.resetAt.toISOString(), '2026-11-02T00:00:00.000Z');
    assertEquals(mock.calls.length, 1);
    assertEquals(mock.calls[0].fn, 'ai_consume_quota');
    assertEquals(mock.calls[0].params.p_user_id, 'user-123');
    assertEquals(mock.calls[0].params.p_function_name, 'groq-recommendations');
  }
);

Deno.test(
  'ServerRateLimiter: funcion groq-routine recibe contrato de servidor y lo propaga',
  async () => {
    const mock = makeRpcMock([
      {
        data: {
          allowed: true,
          remaining: 4,
          reset_at: '2026-11-02T00:00:00Z',
        },
        error: null,
      },
    ]);
    const limiter = new ServerRateLimiter({ rpc: mock.rpc });

    const result = await limiter.check('user-123', 'groq-routine');

    assertEquals(result.allowed, true);
    assertEquals(result.remaining, 4);
    assertEquals(result.resetAt.toISOString(), '2026-11-02T00:00:00.000Z');
  }
);

// ============================================================================
// 2. Clasificacion estricta de cuota agotada vs errores de infraestructura
// ============================================================================

Deno.test(
  'ServerRateLimiter: codigo 42900 con cualquier mensaje clasifica como cuota agotada',
  async () => {
    // Caso a: 42900 con mensaje estandar
    const mock1 = makeRpcMock([
      { data: null, error: { code: '42900', message: 'Cuota agotada para la funcion en la ventana actual' } },
    ]);
    const limiter1 = new ServerRateLimiter({ rpc: mock1.rpc });
    const res1 = await limiter1.check('user-123', 'groq-recommendations');

    assertEquals(res1.allowed, false);
    assertEquals(res1.remaining, 0);
    assertEquals(res1.resetAt instanceof Date, true);

    // Caso a.2: 42900 con mensaje completamente diferente o en ingles
    const mock2 = makeRpcMock([
      { data: null, error: { code: '42900', message: 'Rate limit exceeded: user quota reached' } },
    ]);
    const limiter2 = new ServerRateLimiter({ rpc: mock2.rpc });
    const res2 = await limiter2.check('user-123', 'groq-recommendations');

    assertEquals(res2.allowed, false);
    assertEquals(res2.remaining, 0);
  }
);

Deno.test(
  'ServerRateLimiter: codigo P0001 con texto Cuota agotada lanza error (no es 429)',
  async () => {
    // Caso b: P0001 no debe clasificarse como cuota agotada aunque el texto coincida
    const mock = makeRpcMock([
      { data: null, error: { code: 'P0001', message: 'Error en BD: Cuota agotada en transaccion' } },
    ]);
    const limiter = new ServerRateLimiter({ rpc: mock.rpc });

    await assertRejects(
      async () => {
        await limiter.check('user-123', 'groq-recommendations');
      },
      Error,
      'Error de consumo de cuota'
    );
  }
);

Deno.test(
  'ServerRateLimiter: error sin codigo con texto Cuota agotada lanza error (no es 429)',
  async () => {
    // Caso c: error sin campo code no debe admitirse como cuota agotada
    const mock = makeRpcMock([
      { data: null, error: { message: 'Fallo general: Cuota agotada por timeout' } },
    ]);
    const limiter = new ServerRateLimiter({ rpc: mock.rpc });

    await assertRejects(
      async () => {
        await limiter.check('user-123', 'groq-recommendations');
      },
      Error,
      'Error de consumo de cuota'
    );
  }
);

Deno.test(
  'ServerRateLimiter: error inesperado de base de datos (50000) lanza excepcion (no cuota agotada)',
  async () => {
    const mock = makeRpcMock([
      {
        data: null,
        error: { code: '50000', message: 'error interno de base de datos' },
      },
    ]);
    const limiter = new ServerRateLimiter({ rpc: mock.rpc });

    await assertRejects(
      async () => {
        await limiter.check('user-123', 'groq-recommendations');
      },
      Error,
      'Error de consumo de cuota'
    );
  }
);

Deno.test(
  'ServerRateLimiter: excepcion de transporte propaga error (no cuota agotada)',
  async () => {
    const mock = makeRpcMock([]);
    mock.rpc = async () => {
      throw new Error('conexion rechazada');
    };
    const limiter = new ServerRateLimiter({ rpc: mock.rpc });

    await assertRejects(
      async () => {
        await limiter.check('user-123', 'groq-recommendations');
      },
      Error,
      'conexion rechazada'
    );
  }
);

Deno.test(
  'ServerRateLimiter: funcion desconocida de la RPC (42704) lanza error especifico',
  async () => {
    const mock = makeRpcMock([
      {
        data: null,
        error: { code: '42704', message: 'Funcion de IA desconocida' },
      },
    ]);
    const limiter = new ServerRateLimiter({ rpc: mock.rpc });

    await assertRejects(
      async () => {
        await limiter.check('user-123', 'funcion-inexistente');
      },
      Error,
      'Función de IA desconocida'
    );
  }
);

Deno.test(
  'ServerRateLimiter: argumento invalido de la RPC (22P02) lanza error especifico',
  async () => {
    const mock = makeRpcMock([
      { data: null, error: { code: '22P02', message: 'invalid input syntax' } },
    ]);
    const limiter = new ServerRateLimiter({ rpc: mock.rpc });

    await assertRejects(
      async () => {
        await limiter.check('user-123', 'groq-recommendations');
      },
      Error,
      'Argumentos inválidos'
    );
  }
);

Deno.test(
  'ServerRateLimiter: configuracion ausente falla de forma segura',
  () => {
    const originalUrl = Deno.env.get('SUPABASE_URL');
    const originalKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    try {
      Deno.env.delete('SUPABASE_URL');
      Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
      assertThrows(() => {
        new ServerRateLimiter();
      }, RateLimiterNotConfiguredError);
    } finally {
      if (originalUrl === undefined) {
        Deno.env.delete('SUPABASE_URL');
      } else {
        Deno.env.set('SUPABASE_URL', originalUrl);
      }
      if (originalKey === undefined) {
        Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
      } else {
        Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', originalKey);
      }
    }
  }
);

// ============================================================================
// 3. Validacion estricta de tipos y contrato (sin coerciones permisivas)
// ============================================================================

Deno.test('ServerRateLimiter: respuesta RPC nula lanza excepcion', async () => {
  const mock = makeRpcMock([{ data: null, error: null }]);
  const limiter = new ServerRateLimiter({ rpc: mock.rpc });

  await assertRejects(async () => {
    await limiter.check('user-123', 'groq-recommendations');
  }, Error, 'Respuesta inválida de la RPC');
});

Deno.test(
  'ServerRateLimiter: respuesta RPC primitiva o array lanza excepcion',
  async () => {
    const mockPrimitive = makeRpcMock([{ data: 123, error: null }]);
    const limiter1 = new ServerRateLimiter({ rpc: mockPrimitive.rpc });

    await assertRejects(async () => {
      await limiter1.check('user-123', 'groq-recommendations');
    }, Error, 'Respuesta inválida de la RPC: formato no es un objeto');

    const mockArray = makeRpcMock([{ data: [{ allowed: true }], error: null }]);
    const limiter2 = new ServerRateLimiter({ rpc: mockArray.rpc });

    await assertRejects(async () => {
      await limiter2.check('user-123', 'groq-recommendations');
    }, Error, 'Respuesta inválida de la RPC: formato no es un objeto');
  }
);

Deno.test(
  'ServerRateLimiter: respuesta RPC con allowed invalido o no booleano lanza excepcion',
  async () => {
    const mockString = makeRpcMock([
      { data: { allowed: 'true', remaining: 10, reset_at: '2026-11-02T00:00:00Z' }, error: null },
    ]);
    const limiter1 = new ServerRateLimiter({ rpc: mockString.rpc });

    await assertRejects(async () => {
      await limiter1.check('user-123', 'groq-recommendations');
    }, Error, 'allowed debe ser true');

    const mockFalse = makeRpcMock([
      { data: { allowed: false, remaining: 10, reset_at: '2026-11-02T00:00:00Z' }, error: null },
    ]);
    const limiter2 = new ServerRateLimiter({ rpc: mockFalse.rpc });

    await assertRejects(async () => {
      await limiter2.check('user-123', 'groq-recommendations');
    }, Error, 'allowed debe ser true');
  }
);

Deno.test(
  'ServerRateLimiter: remaining como string o booleano lanza excepcion (no coercion con Number)',
  async () => {
    const mockString = makeRpcMock([
      { data: { allowed: true, remaining: '49', reset_at: '2026-11-02T00:00:00Z' }, error: null },
    ]);
    const limiter1 = new ServerRateLimiter({ rpc: mockString.rpc });

    await assertRejects(async () => {
      await limiter1.check('user-123', 'groq-recommendations');
    }, Error, 'remaining debe ser un entero no negativo');

    const mockBool = makeRpcMock([
      { data: { allowed: true, remaining: true, reset_at: '2026-11-02T00:00:00Z' }, error: null },
    ]);
    const limiter2 = new ServerRateLimiter({ rpc: mockBool.rpc });

    await assertRejects(async () => {
      await limiter2.check('user-123', 'groq-recommendations');
    }, Error, 'remaining debe ser un entero no negativo');
  }
);

Deno.test(
  'ServerRateLimiter: remaining negativo o decimal lanza excepcion',
  async () => {
    const mockNeg = makeRpcMock([
      { data: { allowed: true, remaining: -1, reset_at: '2026-11-02T00:00:00Z' }, error: null },
    ]);
    const limiter1 = new ServerRateLimiter({ rpc: mockNeg.rpc });

    await assertRejects(async () => {
      await limiter1.check('user-123', 'groq-recommendations');
    }, Error, 'remaining debe ser un entero no negativo');

    const mockFloat = makeRpcMock([
      { data: { allowed: true, remaining: 10.5, reset_at: '2026-11-02T00:00:00Z' }, error: null },
    ]);
    const limiter2 = new ServerRateLimiter({ rpc: mockFloat.rpc });

    await assertRejects(async () => {
      await limiter2.check('user-123', 'groq-recommendations');
    }, Error, 'remaining debe ser un entero no negativo');
  }
);

// ============================================================================
// 4. Validacion estricta del contrato temporal (parseStrictUtcTimestamp)
// ============================================================================

Deno.test('parseStrictUtcTimestamp: fecha valida en formato canonico parsea correctamente', () => {
  const d = parseStrictUtcTimestamp('2026-11-02T00:00:00Z');
  assertEquals(d.toISOString(), '2026-11-02T00:00:00.000Z');
  assertEquals(d.getUTCFullYear(), 2026);
  assertEquals(d.getUTCMonth(), 10);
  assertEquals(d.getUTCDate(), 2);
  assertEquals(d.getUTCHours(), 0);
  assertEquals(d.getUTCMinutes(), 0);
  assertEquals(d.getUTCSeconds(), 0);
});

Deno.test('parseStrictUtcTimestamp: fechas imposibles en calendario lanzan excepcion', () => {
  // 31 de febrero no existe en el calendario
  assertThrows(
    () => parseStrictUtcTimestamp('2026-02-31T00:00:00Z'),
    Error,
    'fecha calendario imposible'
  );

  // 31 de abril no existe (abril tiene 30 dias)
  assertThrows(
    () => parseStrictUtcTimestamp('2026-04-31T00:00:00Z'),
    Error,
    'fecha calendario imposible'
  );

  // 31 de noviembre no existe (noviembre tiene 30 dias)
  assertThrows(
    () => parseStrictUtcTimestamp('2026-11-31T00:00:00Z'),
    Error,
    'fecha calendario imposible'
  );

  // 29 de febrero en anio no bisiesto (2026 no es bisiesto)
  assertThrows(
    () => parseStrictUtcTimestamp('2026-02-29T00:00:00Z'),
    Error,
    'fecha calendario imposible'
  );
});

Deno.test('parseStrictUtcTimestamp: cadenas parseables por Date.parse que no cumplen el formato estricto lanzan excepcion', () => {
  // Con milisegundos (.000Z)
  assertThrows(
    () => parseStrictUtcTimestamp('2026-11-02T00:00:00.000Z'),
    Error,
    'no cumple el formato esperado'
  );

  // Con espacio en lugar de T
  assertThrows(
    () => parseStrictUtcTimestamp('2026-11-02 00:00:00Z'),
    Error,
    'no cumple el formato esperado'
  );

  // Con offset horario en lugar de Z
  assertThrows(
    () => parseStrictUtcTimestamp('2026-11-02T02:00:00+02:00'),
    Error,
    'no cumple el formato esperado'
  );

  // Solo fecha
  assertThrows(
    () => parseStrictUtcTimestamp('2026-11-02'),
    Error,
    'no cumple el formato esperado'
  );

  // Formato RFC2822
  assertThrows(
    () => parseStrictUtcTimestamp('Mon, 02 Nov 2026 00:00:00 GMT'),
    Error,
    'no cumple el formato esperado'
  );

  // No es string (null, number, etc.)
  assertThrows(
    () => parseStrictUtcTimestamp(null),
    Error,
    'debe ser una cadena'
  );
  assertThrows(
    () => parseStrictUtcTimestamp(123456789),
    Error,
    'debe ser una cadena'
  );
});

Deno.test(
  'ServerRateLimiter: reset_at con fecha imposible o formato no canonico rechaza peticion',
  async () => {
    const mockImpossible = makeRpcMock([
      { data: { allowed: true, remaining: 10, reset_at: '2026-02-31T00:00:00Z' }, error: null },
    ]);
    const limiter1 = new ServerRateLimiter({ rpc: mockImpossible.rpc });

    await assertRejects(async () => {
      await limiter1.check('user-123', 'groq-recommendations');
    }, Error, 'fecha calendario imposible');

    const mockNonCanonical = makeRpcMock([
      { data: { allowed: true, remaining: 10, reset_at: '2026-11-02T00:00:00.000Z' }, error: null },
    ]);
    const limiter2 = new ServerRateLimiter({ rpc: mockNonCanonical.rpc });

    await assertRejects(async () => {
      await limiter2.check('user-123', 'groq-recommendations');
    }, Error, 'no cumple el formato esperado');
  }
);

// ============================================================================
// 5. SQL como autoridad de admision (sin segundo rechazo local ni desfasajes)
// ============================================================================

Deno.test(
  'ServerRateLimiter: limite de borde con remaining 0 tras consumo devuelve allowed true sin segundo rechazo',
  async () => {
    // Caso de borde: se consumio la ultima ficha disponible de la cuota en SQL (remaining = 0).
    // SQL autorizo la peticion. TypeScript NO debe rechazarla.
    const mock = makeRpcMock([
      {
        data: {
          allowed: true,
          remaining: 0,
          reset_at: '2026-11-02T00:00:00Z',
        },
        error: null,
      },
    ]);
    const limiter = new ServerRateLimiter({ rpc: mock.rpc });

    const result = await limiter.check('user-123', 'groq-recommendations');

    assertEquals(result.allowed, true);
    assertEquals(result.remaining, 0);
  }
);

Deno.test(
  'ServerRateLimiter: no hay rechazo local aunque servidor devuelva cuotas distintas a valores informativos locales',
  async () => {
    // Si la configuracion de servidor en SQL otorga 100 cuotas (desfase con SERVER_LIMITS local),
    // SQL es la autoridad de admision y TypeScript no aplica una segunda cota local.
    const mock = makeRpcMock([
      {
        data: {
          allowed: true,
          remaining: 95,
          reset_at: '2026-11-02T00:00:00Z',
        },
        error: null,
      },
    ]);
    const limiter = new ServerRateLimiter({ rpc: mock.rpc });

    const result = await limiter.check('user-123', 'groq-recommendations');

    assertEquals(result.allowed, true);
    assertEquals(result.remaining, 95);
  }
);

// ============================================================================
// 6. Reinicio determinista en inicio de dia UTC (getNextUtcMidnight)
// ============================================================================

Deno.test(
  'getNextUtcMidnight: calcula el siguiente dia UTC exacto a las 00:00:00.000Z',
  () => {
    const midday = new Date('2026-11-01T12:34:56.789Z');
    const next = getNextUtcMidnight(midday);

    assertEquals(next.toISOString(), '2026-11-02T00:00:00.000Z');
    assertEquals(next.getUTCHours(), 0);
    assertEquals(next.getUTCMinutes(), 0);
    assertEquals(next.getUTCSeconds(), 0);
    assertEquals(next.getUTCMilliseconds(), 0);
  }
);

Deno.test(
  'getNextUtcMidnight: comportamiento determinista 1ms antes de medianoche UTC',
  () => {
    const justBeforeMidnight = new Date('2026-11-01T23:59:59.999Z');
    const next = getNextUtcMidnight(justBeforeMidnight);

    assertEquals(next.toISOString(), '2026-11-02T00:00:00.000Z');
  }
);

Deno.test(
  'getNextUtcMidnight: comportamiento determinista 1ms despues de medianoche UTC',
  () => {
    const justAfterMidnight = new Date('2026-11-02T00:00:00.001Z');
    const next = getNextUtcMidnight(justAfterMidnight);

    assertEquals(next.toISOString(), '2026-11-03T00:00:00.000Z');
  }
);

Deno.test(
  'getNextUtcMidnight: comportamiento exacto en punto de medianoche UTC',
  () => {
    const exactMidnight = new Date('2026-11-02T00:00:00.000Z');
    const next = getNextUtcMidnight(exactMidnight);

    assertEquals(next.toISOString(), '2026-11-03T00:00:00.000Z');
  }
);

Deno.test(
  'getNextUtcMidnight: cambio de mes y cambio de anio (31 de diciembre)',
  () => {
    const newYearsEve = new Date('2026-12-31T23:59:59.999Z');
    const next = getNextUtcMidnight(newYearsEve);

    assertEquals(next.toISOString(), '2027-01-01T00:00:00.000Z');
  }
);
