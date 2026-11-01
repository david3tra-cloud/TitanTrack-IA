/**
 * CORS centralizado para Edge Functions de TitanTrack.
 * Solo se admiten dos orígenes exactos. Nunca se devuelve un comodín ni se
 * refleja el origen del request cuando no está permitido.
 */

const ALLOWED_ORIGINS: Record<string, string> = {
  'http://localhost:3001': 'http://localhost:3001',
  'https://titantrack-clean.vercel.app': 'https://titantrack-clean.vercel.app',
} as const;

export type AllowedOrigin = keyof typeof ALLOWED_ORIGINS;

export function isAllowedOrigin(origin: string | null): origin is AllowedOrigin {
  return origin !== null && origin in ALLOWED_ORIGINS;
}

export function allowedOriginHeader(origin: string | null): string {
  return isAllowedOrigin(origin) ? ALLOWED_ORIGINS[origin] : '';
}

export function corsOptionsResponse(origin: string | null): Response {
  const allowed = isAllowedOrigin(origin);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (allowed) {
    headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS[origin];
  }
  return new Response(null, {
    status: allowed ? 204 : 403,
    headers,
  });
}

export function corsCheck(origin: string | null): Response | null {
  if (!isAllowedOrigin(origin)) {
    return new Response(
      JSON.stringify({ error: 'Origen no permitido' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
  return null;
}