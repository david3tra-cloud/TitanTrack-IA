/**
 * Validación de sesión real de Supabase en Edge Functions y control de acceso al piloto.
 * Utiliza supabase.auth.getUser() con el JWT del cliente, que valida la firma
 * y expiración del token contra el proyecto de Supabase. No requiere service_role.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface SessionUser {
  userId: string;
  email?: string;
}

export async function validateSession(
  req: Request
): Promise<SessionUser | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const jwt = authHeader.substring(7).trim();
  if (!jwt) {
    return null;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return null;
  }

  return {
    userId: data.user.id,
    email: data.user.email,
  };
}

/**
 * Restricción de piloto en el servidor:
 * - Lee la variable de entorno AI_PILOT_USER_IDS (lista de UUIDs separados por comas).
 * - Comprueba exclusivamente contra el userId verificado de la sesión.
 * - Si la configuración está ausente o vacía: acceso denegado (falla seguro).
 * - No confía nunca en correos ni identificadores enviados en el body.
 */
export function isPilotUserAllowed(userId: string): boolean {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return false;
  }

  const pilotUsersEnv = Deno.env.get('AI_PILOT_USER_IDS');
  if (!pilotUsersEnv || !pilotUsersEnv.trim()) {
    return false;
  }

  const allowedIds = pilotUsersEnv
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  return allowedIds.includes(userId.trim().toLowerCase());
}
