/// <reference types="vite/client" />

/**
 * services/aiService.edge.ts
 * Cliente de Edge Functions de Supabase. Recomendaciones usa un payload
 * ficticio y explícito durante el piloto local.
 *
 * La generación de recomendaciones y rutinas usa Edge Functions.
 */

import { supabase } from '../src/lib/supabaseClient';
import type { Recommendation, Routine } from '../types';
import type { RoutineFocus } from '../shared/routine';

const FUNCTIONS_BASE =
  'https://aziowzwhizjytzcqfent.supabase.co/functions/v1';

async function getAccessToken(): Promise<string> {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      throw new EdgeRecommendationsError(401, 'No hay sesión válida de Supabase');
    }
    return session.access_token;
  } catch (error) {
    if (error instanceof EdgeRecommendationsError) throw error;
    throw new EdgeRecommendationsError(null, 'No se pudo comprobar la sesión.');
  }
}

export class EdgeRecommendationsError extends Error {
  constructor(
    public readonly status: number | null,
    message: string
  ) {
    super(message);
    this.name = 'EdgeRecommendationsError';
  }
}

type RoutineGenerationCommon = {
  objective: string;
  level: string;
  equipment?: string;
  sessionMinutes?: number;
};

type RoutineGenerationParams =
  | (RoutineGenerationCommon & {
      mode?: 'basic';
      focuses: RoutineFocus[];
      daysPerWeek?: string;
    })
  | (RoutineGenerationCommon & {
      mode: 'pro_plan';
      daysPerWeek: string;
      focus?: RoutineFocus;
    });

const SYNTHETIC_RECOMMENDATION_REQUEST = {
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
};

function isRecommendation(value: unknown): value is Recommendation {
  if (!value || typeof value !== 'object') return false;
  const recommendation = value as Record<string, unknown>;
  return (
    typeof recommendation.title === 'string' &&
    typeof recommendation.description === 'string' &&
    ['strength', 'recovery', 'nutrition', 'technique'].includes(
      recommendation.category as string
    )
  );
}

export async function getPersonalizedRecommendationsGroq(): Promise<Recommendation[]> {
  const accessToken = await getAccessToken();

  let response: Response;
  try {
    response = await fetch(`${FUNCTIONS_BASE}/groq-recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(SYNTHETIC_RECOMMENDATION_REQUEST),
    });
  } catch {
    throw new EdgeRecommendationsError(
      null,
      'No se pudo confirmar el resultado. No se reintentó la solicitud.'
    );
  }

  if (!response.ok) {
    throw new EdgeRecommendationsError(response.status, 'Error en Edge Function');
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new EdgeRecommendationsError(502, 'Respuesta no válida de Edge Function');
  }
  if (!Array.isArray(result) || !result.every(isRecommendation)) {
    throw new EdgeRecommendationsError(502, 'Respuesta no válida de Edge Function');
  }
  return result;
}

export async function generateRoutineGroq(params: RoutineGenerationParams): Promise<Routine> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${FUNCTIONS_BASE}/groq-routine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error || 'No se pudo generar la rutina');
  }

  return response.json();
}