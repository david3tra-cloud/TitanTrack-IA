/**
 * Edge Function: groq-recommendations
 * Proxy de recomendaciones IA (Coach IA).
 * Contrato conservado: recibe { workouts, profile } y devuelve Recommendation[].
 * El handler está separado de Deno.serve para poder importarlo en pruebas.
 */

import { corsCheck, corsOptionsResponse } from '../_shared/cors.ts';
import { validateSession, isPilotUserAllowed } from '../_shared/auth.ts';
import { callGroq, GroqClientError } from '../_shared/groq-client.ts';
import { ServerRateLimiter, RateLimiterNotConfiguredError } from '../_shared/server-rate-limit.ts';
import {
  validateBodySize,
  validateRecommendationRequest,
  validateRecommendationsResponse,
  ValidationErrorImpl,
  type ValidatedRecommendationRequest,
} from '../_shared/validate.ts';

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

function buildPrompt({ workouts, profile }: ValidatedRecommendationRequest): string {
  const historySummary = workouts
    .slice(-10)
    .map(
      (w) =>
        `${w.date} - ${w.exercises
          .map((e: any) => `${e.name} (${e.sets.length} series)`)
          .join(', ')}`
    )
    .join('\n');

  return `Eres un entrenador personal experto.
Analiza el siguiente PERFIL e historial de entrenamientos.
Devuelve SOLO un JSON con este formato exacto:
[
  {
    "title": "string",
    "description": "string",
    "category": "strength" | "recovery" | "nutrition" | "technique"
  }
]

Perfil:
${JSON.stringify(profile)}

Entrenamientos recientes:
${historySummary}
`;
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

  let requestData: ValidatedRecommendationRequest;
  try {
    validateBodySize(bodyText);
    requestData = validateRecommendationRequest(JSON.parse(bodyText));
  } catch (err) {
    if (err instanceof ValidationErrorImpl) {
      return errorResponse(err.message, err.status, origin);
    }
    if (err instanceof SyntaxError) {
      return errorResponse('Cuerpo inválido', 400, origin);
    }
    return errorResponse('Error interno', 500, origin);
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
    limitResult = await rateLimiter.check(session.userId, 'groq-recommendations');
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
    const recommendations = validateRecommendationsResponse(content);

    return new Response(JSON.stringify(recommendations), {
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
