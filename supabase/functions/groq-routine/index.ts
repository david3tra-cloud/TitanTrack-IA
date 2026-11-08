/**
 * Edge Function: groq-routine
 * Proxy de generación de rutina IA.
 * Contrato conservado: recibe RoutineParams y devuelve Routine.
 * El handler está separado de Deno.serve para poder importarlo en pruebas.
 */

import { corsCheck, corsOptionsResponse } from '../_shared/cors.ts';
import { validateSession, isPilotUserAllowed } from '../_shared/auth.ts';
import { callGroq, GroqClientError } from '../_shared/groq-client.ts';
import { ServerRateLimiter, RateLimiterNotConfiguredError } from '../_shared/server-rate-limit.ts';
import {
  validateBodySize,
  validateRoutineRequest,
  validateRoutineResponse,
  ValidationErrorImpl,
  type ValidatedRoutineRequest,
} from '../_shared/validate.ts';
import { ROUTINE_FOCUSES } from '../../../shared/routine.ts';

const ALLOWED_ORIGINS: Record<string, string> = {
  'http://localhost:3001': 'http://localhost:3001',
  'https://titantrack-clean.vercel.app': 'https://titantrack-clean.vercel.app',
} as const;

function allowedOriginHeader(origin: string | null): string {
  return origin && origin in ALLOWED_ORIGINS ? ALLOWED_ORIGINS[origin] : '';
}

type HandlerDeps = {
  validateSession?: typeof validateSession;
  callGroq?: typeof callGroq;
  RateLimiter?: new () => { check(userId: string, functionName: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> };
  isPilotUserAllowed?: typeof isPilotUserAllowed;
};

// Operaciones premium bloqueadas hasta que exista autorización de servidor verificada.
// No se confía en plan ni mode enviados por el cliente.
const PREMIUM_OPERATIONS_BLOCKED = true;

function buildPrompt(req: ValidatedRoutineRequest): string {
  const outputFormat = `Devuelve SOLO un JSON con estas claves exactas:
{
  "name": "string",
  "description": "string",
  "exercises": [
    { "name": "string", "sets": number, "reps": "string", "restTime": "string" }
  ]
}
No traduzcas ni cambies las claves JSON. Todo el texto visible de los valores debe estar en español: nombre y descripción de la rutina, nombres de ejercicios e indicaciones de repeticiones y descanso.`;

  if (req.mode === 'pro_plan') {
    return `Eres un entrenador personal especializado en planificación de entrenamiento.
Crea un plan de entrenamiento de gimnasio con estos parámetros:
- Días por semana: ${req.daysPerWeek}
- Objetivo principal: ${req.objective}
- Nivel: ${req.level}
- Equipamiento: ${req.equipment || 'ninguno especificado'}
- Duración de sesión: ${req.sessionMinutes ?? 60} minutos

${outputFormat}

MODO PLAN SEMANAL: El plan debe cubrir exactamente ${req.daysPerWeek} días. Usa días en español (Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo) y en orden.`;
  }

  return `Eres un entrenador personal especializado en planificación de entrenamiento.
Crea UNA sola sesión de gimnasio, sin dividirla en días, con estos parámetros:
- Objetivo principal: ${req.objective}
- Nivel: ${req.level}
- Equipamiento: ${req.equipment || 'ninguno especificado'}
- Duración de la sesión: ${req.sessionMinutes ?? 60} minutos
- Grupos musculares o enfoques seleccionados: ${ROUTINE_FOCUSES
    .filter((option) => req.focuses.includes(option.value))
    .map((option) => option.label)
    .join(', ')}

Representa cada uno de los grupos seleccionados con al menos un ejercicio adecuado. Reparte el volumen de toda la sesión entre los grupos elegidos, sin repetir el volumen completo por grupo.
Diseña la sesión tomando como referencia orientativa unas 20 series de trabajo totales para toda la sesión, con un margen aproximado de 17 a 23 en conjunto. Cuenta las series sumando las series de cada ejercicio; 20 series no significa 20 ejercicios ni 20 series por grupo. Ajusta la propuesta para que sea coherente con los parámetros y no conviertas ese margen en una condición rígida.
Incluye únicamente ejercicios reales en la lista "exercises". No añadas encabezados de días como ejercicios ni crees una división semanal. Si se seleccionó Cuerpo completo, úsalo como enfoque exclusivo de la sesión.

${outputFormat}`;
}

function errorResponse(
  message: string,
  status: number,
  origin: string | null
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOriginHeader(origin),
    },
  });
}

export async function handler(
  req: Request,
  deps: HandlerDeps = {}
): Promise<Response> {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return corsOptionsResponse(origin);
  }

  if (req.method !== 'POST') {
    return errorResponse('Método no permitido', 405, origin);
  }

  const corsError = corsCheck(origin);
  if (corsError) return corsError;

  // Leer y validar el cuerpo antes de autenticar y consumir cuota.
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return errorResponse('Cuerpo inválido', 400, origin);
  }

  let requestData: ValidatedRoutineRequest;
  try {
    validateBodySize(bodyText);
    requestData = validateRoutineRequest(JSON.parse(bodyText));
  } catch (err) {
    if (err instanceof ValidationErrorImpl) {
      return errorResponse(err.message, err.status, origin);
    }
    if (err instanceof SyntaxError) {
      return errorResponse('Cuerpo inválido', 400, origin);
    }
    return errorResponse('Error interno', 500, origin);
  }

  // Bloqueo explícito de operaciones premium (plan semanal / pro_plan)
  // sin autorización de servidor verificada. No se confía en plan ni mode
  // enviados por el cliente.
  if (PREMIUM_OPERATIONS_BLOCKED && requestData.mode === 'pro_plan') {
    return errorResponse(
      'Operación premium no autorizada: se requiere autorización de servidor verificada',
      403,
      origin
    );
  }

  const validateSessionFn = deps.validateSession ?? validateSession;
  const session = await validateSessionFn(req);
  if (!session) {
    return errorResponse('No autorizado', 401, origin);
  }

  // Restricción del piloto en servidor: comprueba exclusivamente el userId de la sesión validada
  const isPilotAllowedFn = deps.isPilotUserAllowed ?? isPilotUserAllowed;
  if (!isPilotAllowedFn(session.userId)) {
    return errorResponse('Acceso denegado: usuario no incluido en el piloto de IA', 403, origin);
  }

  // Rate limiter real de servidor (service_role) con inyección para pruebas
  const RateLimiterClass = deps.RateLimiter ?? ServerRateLimiter;
  let limitResult;
  try {
    const rateLimiter = new RateLimiterClass();
    limitResult = await rateLimiter.check(session.userId, 'groq-routine');
  } catch (err) {
    if (err instanceof RateLimiterNotConfiguredError) {
      return errorResponse('Servicio de IA no disponible temporalmente', 503, origin);
    }
    return errorResponse('Error interno', 500, origin);
  }

  if (!limitResult.allowed) {
    return errorResponse('Cuota de IA agotada', 429, origin);
  }

  const callGroqFn = deps.callGroq ?? callGroq;
  try {
    const prompt = buildPrompt(requestData);
    const content = await callGroqFn([{ role: 'user', content: prompt }]);
    const validatedRoutine = validateRoutineResponse(content);
    const routine = {
      id: Math.random().toString(36).slice(2, 11),
      name: validatedRoutine.name,
      description: validatedRoutine.description,
      exercises: validatedRoutine.exercises.map((exercise) => ({
        id: Math.random().toString(36).slice(2, 11),
        ...exercise,
      })),
    };

    return new Response(JSON.stringify(routine), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS[origin!],
      },
    });
  } catch (err) {
    if (err instanceof GroqClientError) {
      return errorResponse(err.info.message, err.info.status, origin);
    }
    if (err instanceof ValidationErrorImpl && err.status === 502) {
      return errorResponse('Respuesta inesperada del proveedor de IA', 502, origin);
    }
    return errorResponse('Error interno', 500, origin);
  }
}

if (import.meta.main) {
  Deno.serve((req) => handler(req));
}
