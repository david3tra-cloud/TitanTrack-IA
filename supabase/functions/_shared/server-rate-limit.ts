/**
 * Rate limiter real basado en Supabase RPC (service_role).
 *
 * Los handlers utilizan ServerRateLimiter; la RPC y sus secretos deben estar
 * configurados en el entorno de servidor para consumir cuota.
 *
 * Diseño exclusivamente de servidor:
 * - EXECUTE de ai_consume_quota solo para service_role.
 * - authenticated y anon no tienen EXECUTE.
 * - La Edge Function valida la sesión del usuario antes de llamar a la RPC.
 * - El user_id procede exclusivamente de la sesión validada (JWT de Supabase Auth).
 * - service_role se usa solo en el servidor para consumir cuota.
 * - La clave service_role nunca llega al frontend.
 * - SQL es la única autoridad de admisión y límites; no hay un segundo
 *   rechazo local tras el consumo autorizado en el servidor.
 *
 * Clasificación de errores:
 * - Cuota agotada: ÚNICAMENTE código estable '42900'.
 * - Errores de infraestructura, BD (ej. P0001) o mensajes sin código fallan de forma segura
 *   lanzando error interno, sin presentarse falsamente como HTTP 429.
 *
 * Operaciones Premium:
 * - No se habilitan operaciones premium; los handlers mantienen el bloqueo
 *   de mode === 'pro_plan'.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimiter {
  check(userId: string, functionName: string): Promise<RateLimitResult>;
}

export class RateLimiterNotConfiguredError extends Error {
  constructor() {
    super(
      'Rate limiter no configurado: se requiere despliegue externo y secreto de servidor'
    );
    this.name = 'RateLimiterNotConfiguredError';
  }
}

/**
 * Calcula con precisión determinista el próximo inicio de día UTC (00:00:00.000Z),
 * sin ignorar minutos, segundos ni milisegundos.
 */
export function getNextUtcMidnight(from: Date = new Date()): Date {
  return new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  );
}

// Formato canónico devuelto por la función SQL: YYYY-MM-DDTHH:MI:SSZ
const UTC_ISO_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

/**
 * Valida de forma estricta que la cadena cumpla exactamente el formato
 * YYYY-MM-DDTHH:MM:SSZ y represente una fecha de calendario real (sin fechas imposibles).
 * No realiza comparaciones con el reloj local para evitar falsos rechazos por desfase leve.
 */
export function parseStrictUtcTimestamp(value: unknown): Date {
  if (typeof value !== 'string') {
    throw new Error('Respuesta inválida de la RPC: reset_at debe ser una cadena');
  }

  const match = value.match(UTC_ISO_REGEX);
  if (!match) {
    throw new Error(
      'Respuesta inválida de la RPC: reset_at no cumple el formato esperado YYYY-MM-DDTHH:MM:SSZ'
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));

  // Validación de coherencia del calendario real (evita fechas imposibles como 2026-02-31 o 2026-11-31)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    throw new Error(
      'Respuesta inválida de la RPC: reset_at representa una fecha calendario imposible'
    );
  }

  return date;
}

/**
 * Implementación real que llama a la función SQL ai_consume_quota.
 * Requiere:
 * - SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY como secretos de Edge Function.
 * - Tabla public.ai_usage y función public.ai_consume_quota desplegadas en SQL.
 *
 * Nunca se importa en el frontend.
 */
export class ServerRateLimiter implements RateLimiter {
  private supabase: any;

  constructor(clientOrOptions?: any) {
    // Permite inyectar un cliente RPC simulado (o real) para pruebas sin
    // credenciales de producción. Se aceptan varias formas:
    //   new ServerRateLimiter(client)
    //   new ServerRateLimiter({ rpc })
    //   new ServerRateLimiter({ supabase: client })
    //   new ServerRateLimiter({ client })
    let injected: any = undefined;
    if (clientOrOptions) {
      if (typeof clientOrOptions.rpc === 'function') {
        injected = clientOrOptions;
      } else if (
        clientOrOptions.supabase &&
        typeof clientOrOptions.supabase.rpc === 'function'
      ) {
        injected = clientOrOptions.supabase;
      } else if (
        clientOrOptions.client &&
        typeof clientOrOptions.client.rpc === 'function'
      ) {
        injected = clientOrOptions.client;
      }
    }

    if (injected) {
      this.supabase = injected;
      return;
    }

    // Ruta de producción: valida configuración y falla de forma segura.
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new RateLimiterNotConfiguredError();
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async check(
    userId: string,
    functionName: string
  ): Promise<RateLimitResult> {
    const { data, error } = await (this.supabase as any).rpc(
      'ai_consume_quota',
      { p_user_id: userId, p_function_name: functionName }
    );

    if (error) {
      // Traducción de errores de la RPC a respuestas controladas
      // Cuota agotada: ÚNICAMENTE código estable '42900'
      if (error.code === '42900') {
        return {
          allowed: false,
          remaining: 0,
          resetAt: getNextUtcMidnight(),
        };
      }
      if (error.code === '42704') {
        throw new Error('Función de IA desconocida');
      }
      if (error.code === '22P02') {
        throw new Error('Argumentos inválidos');
      }
      // Errores de transporte, base de datos (ej. P0001, 50000) o sin código
      // fallan de forma segura sin presentarse falsamente como cuota agotada (HTTP 429)
      throw new Error('Error de consumo de cuota');
    }

    // Validación estricta del contrato devuelto por la RPC
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Respuesta inválida de la RPC: formato no es un objeto');
    }

    if (typeof (data as any).allowed !== 'boolean' || (data as any).allowed !== true) {
      throw new Error('Respuesta inválida de la RPC: allowed debe ser true cuando no hay error');
    }

    const remaining = (data as any).remaining;
    // Validación estricta: tipo number entero no negativo, sin coerción de strings/booleanos
    if (
      typeof remaining !== 'number' ||
      !Number.isInteger(remaining) ||
      remaining < 0
    ) {
      throw new Error('Respuesta inválida de la RPC: remaining debe ser un entero no negativo');
    }

    // Validación estricta de formato y calendario real para reset_at
    const resetAt = parseStrictUtcTimestamp((data as any).reset_at);

    // SQL es la autoridad de admisión: habiéndose admitido y consumido en BD,
    // se devuelve el resultado sin un segundo rechazo local.
    return {
      allowed: true,
      remaining,
      resetAt,
    };
  }
}

// Límites por función de referencia informativa (valores del piloto aprobados)
// NOTA: La autoridad de admisión y del límite reside exclusivamente en la RPC SQL.
// Esta constante se mantiene como referencia informativa local.
export const SERVER_LIMITS = {
  'groq-recommendations': 10,
  'groq-routine': 5,
  windowHours: 24,
};
