/**
 * Límite de consumo por usuario.
 *
 * ESTE MÓDULO IMPLEMENTA FALLO CERRADO. Mientras no exista un almacén
 * compartido y atómico (tabla en Supabase con UPDATE ... RETURNING), ninguna
 * petición debe llegar al proveedor de IA.
 *
 * - ClosedRateLimiter: rechaza siempre con un error claro. Se usa en producción
 *   hasta que se implemente el rate limiter real.
 * - MockRateLimiter: solo para pruebas unitarias. Nunca se usa como fallback
 *   real en el servidor.
 */

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
      'Rate limiter no configurado: se requiere un almacén atómico compartido antes de permitir llamadas a IA'
    );
    this.name = 'RateLimiterNotConfiguredError';
  }
}

export class ClosedRateLimiter implements RateLimiter {
  async check(_userId: string, _functionName: string): Promise<RateLimitResult> {
    throw new RateLimiterNotConfiguredError();
  }
}

export const PROPOSED_LIMITS = {
  recommendationsPerDay: 10,
  routinesPerDay: 5,
  windowHours: 24,
};
