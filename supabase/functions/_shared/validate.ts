/**
 * Validación de entradas y respuestas para Edge Functions de IA.
 * Límites aplicados antes de llamar al proveedor.
 */

const MAX_BODY_BYTES = 100_000;
const MAX_WORKOUTS = 50;
const MAX_EXERCISES_PER_WORKOUT = 30;
const MAX_SETS_PER_EXERCISE = 20;
const MAX_STRING_LENGTH = 500;

const VALID_CATEGORIES = ['strength', 'recovery', 'nutrition', 'technique'];
const VALID_MODES = ['basic', 'pro_plan'];

export interface ValidationError extends Error {
  status: number;
  code: string;
}

export class ValidationErrorImpl extends Error implements ValidationError {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
    this.code = code;
  }
}

function requireString(
  value: unknown,
  field: string,
  maxLen = MAX_STRING_LENGTH,
  status = 400
): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationErrorImpl(
      `Campo requerido: ${field}`,
      status,
      status === 502 ? 'invalid_provider_response' : 'invalid_input'
    );
  }
  if (value.length > maxLen) {
    throw new ValidationErrorImpl(
      `Campo demasiado largo: ${field}`,
      status,
      status === 502 ? 'invalid_provider_response' : 'invalid_input'
    );
  }
  return value;
}

function validateString(
  value: unknown,
  field: string,
  maxLen = MAX_STRING_LENGTH
): string {
  if (typeof value !== 'string') {
    throw new ValidationErrorImpl(`Campo inválido: ${field}`, 400, 'invalid_input');
  }
  if (value.length > maxLen) {
    throw new ValidationErrorImpl(`Campo demasiado largo: ${field}`, 400, 'invalid_input');
  }
  return value;
}

function validateOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new ValidationErrorImpl(`Campo booleano inválido: ${field}`, 400, 'invalid_input');
  }
  return value;
}

function requireNumberRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
  status = 400
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationErrorImpl(
      `Campo numérico inválido: ${field}`,
      status,
      status === 502 ? 'invalid_provider_response' : 'invalid_input'
    );
  }
  if (value < min || value > max) {
    throw new ValidationErrorImpl(
      `Campo fuera de rango: ${field}`,
      status,
      status === 502 ? 'invalid_provider_response' : 'invalid_input'
    );
  }
  return value;
}

function requireArrayLength(
  value: unknown,
  field: string,
  min: number,
  max: number,
  status = 400
): any[] {
  if (!Array.isArray(value)) {
    throw new ValidationErrorImpl(
      `Campo debe ser array: ${field}`,
      status,
      status === 502 ? 'invalid_provider_response' : 'invalid_input'
    );
  }
  if (value.length < min || value.length > max) {
    throw new ValidationErrorImpl(
      `Array fuera de rango: ${field}`,
      status,
      status === 502 ? 'invalid_provider_response' : 'invalid_input'
    );
  }
  return value;
}
export interface ValidatedWorkout {
  id: string;
  date: string;
  name: string;
  exercises: Array<{
    id: string;
    name: string;
    category: string;
    sets: Array<{ id: string; reps: number; weight: number; completed?: boolean; restTime?: string }>;
  }>;
}

export interface ValidatedProfile {
  displayName: string;
  plan: string;
  sex: string;
  goal: string;
  level: string;
  weightKg?: number | null;
  heightCm?: number | null;
  trainingDaysPerWeek?: number | null;
  sessionMinutes?: number | null;
  preferredStyle: string;
  equipment: string[];
  limitations: string;
  measurements: Record<string, unknown>;
}

export interface ValidatedRecommendationRequest {
  workouts: ValidatedWorkout[];
  profile: ValidatedProfile;
}

export interface ValidatedRoutineRequest {
  daysPerWeek: string;
  objective: string;
  level: string;
  equipment?: string;
  mode: 'basic' | 'pro_plan';
  sessionMinutes?: number;
}

export function validateBodySize(bodyText: string): void {
  const byteLength = new TextEncoder().encode(bodyText).length;
  if (byteLength > MAX_BODY_BYTES) {
    throw new ValidationErrorImpl('Cuerpo demasiado grande', 413, 'payload_too_large');
  }
}

export { MAX_BODY_BYTES };
export function validateRecommendationRequest(body: unknown): ValidatedRecommendationRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationErrorImpl('Cuerpo inválido', 400, 'invalid_input');
  }
  const raw = body as Record<string, unknown>;
  if (!Array.isArray(raw.workouts)) {
    throw new ValidationErrorImpl('workouts inválido', 400, 'invalid_input');
  }
  requireArrayLength(raw.workouts, 'workouts', 0, MAX_WORKOUTS);

  const workouts: ValidatedWorkout[] = raw.workouts.map((w: unknown) => {
    if (!w || typeof w !== 'object' || Array.isArray(w)) {
      throw new ValidationErrorImpl('Entrenamiento inválido', 400, 'invalid_input');
    }
    const wo = w as Record<string, unknown>;
    return {
      id: requireString(wo.id, 'workout.id'),
      date: requireString(wo.date, 'workout.date'),
      name: requireString(wo.name, 'workout.name'),
      exercises: (() => {
        const exs = requireArrayLength(wo.exercises, 'workout.exercises', 0, MAX_EXERCISES_PER_WORKOUT);
        return exs.map((e: unknown) => {
          if (!e || typeof e !== 'object' || Array.isArray(e)) {
            throw new ValidationErrorImpl('Ejercicio inválido', 400, 'invalid_input');
          }
          const ex = e as Record<string, unknown>;
          return {
            id: requireString(ex.id, 'exercise.id'),
            name: requireString(ex.name, 'exercise.name'),
            category: requireString(ex.category, 'exercise.category'),
            sets: (() => {
              const sets = requireArrayLength(ex.sets, 'exercise.sets', 0, MAX_SETS_PER_EXERCISE);
              return sets.map((s: unknown) => {
                if (!s || typeof s !== 'object' || Array.isArray(s)) {
                  throw new ValidationErrorImpl('Serie inválida', 400, 'invalid_input');
                }
                const st = s as Record<string, unknown>;
                return {
                  id: requireString(st.id, 'set.id'),
                  reps: requireNumberRange(st.reps, 'set.reps', 1, 1000),
                  weight: requireNumberRange(st.weight, 'set.weight', 0, 1000),
                  completed: validateOptionalBoolean(st.completed, 'set.completed'),
                  restTime: st.restTime === undefined ? undefined : requireString(st.restTime, 'set.restTime', 50),
                };
              });
            })(),
          };
        });
      })(),
    };
  });

  if (!raw.profile || typeof raw.profile !== 'object' || Array.isArray(raw.profile)) {
    throw new ValidationErrorImpl('Perfil inválido', 400, 'invalid_input');
  }
  const prof = raw.profile as Record<string, unknown>;
  if (
    !prof.measurements ||
    typeof prof.measurements !== 'object' ||
    Array.isArray(prof.measurements)
  ) {
    throw new ValidationErrorImpl('Campo inválido: profile.measurements', 400, 'invalid_input');
  }
  const profile: ValidatedProfile = {
    displayName: validateString(prof.displayName, 'profile.displayName'),
    plan: requireString(prof.plan, 'profile.plan'),
    sex: validateString(prof.sex, 'profile.sex'),
    goal: validateString(prof.goal, 'profile.goal'),
    level: validateString(prof.level, 'profile.level'),
    weightKg: prof.weightKg === null || prof.weightKg === undefined ? null : requireNumberRange(prof.weightKg, 'profile.weightKg', 0, 500),
    heightCm: prof.heightCm === null || prof.heightCm === undefined ? null : requireNumberRange(prof.heightCm, 'profile.heightCm', 0, 300),
    trainingDaysPerWeek: prof.trainingDaysPerWeek === null || prof.trainingDaysPerWeek === undefined ? null : requireNumberRange(prof.trainingDaysPerWeek, 'profile.trainingDaysPerWeek', 1, 7),
    sessionMinutes: prof.sessionMinutes === null || prof.sessionMinutes === undefined ? null : requireNumberRange(prof.sessionMinutes, 'profile.sessionMinutes', 1, 480),
    preferredStyle: validateString(prof.preferredStyle, 'profile.preferredStyle'),
    equipment: requireArrayLength(prof.equipment, 'profile.equipment', 0, 20).map((e) => requireString(e, 'equipment item')),
    limitations: validateString(prof.limitations, 'profile.limitations'),
    measurements: prof.measurements as Record<string, unknown>,
  };

  return { workouts, profile };
}
export function validateRoutineRequest(body: unknown): ValidatedRoutineRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationErrorImpl('Cuerpo inválido', 400, 'invalid_input');
  }
  const raw = body as Record<string, unknown>;
  const rawDaysPerWeek = raw.daysPerWeek;
  const daysMatch = typeof rawDaysPerWeek === 'string'
    ? rawDaysPerWeek.match(/^([1-7])(?: d[ií]as?)?$/i)
    : null;
  if (!daysMatch) {
    throw new ValidationErrorImpl('daysPerWeek fuera de rango (1-7)', 400, 'invalid_input');
  }
  const daysPerWeek = daysMatch[1];
  const objective = validateString(raw.objective, 'objective');
  const level = validateString(raw.level, 'level');
  let mode: 'basic' | 'pro_plan' = 'basic';
  if (raw.mode !== undefined) {
    if (typeof raw.mode !== 'string' || !VALID_MODES.includes(raw.mode)) {
      throw new ValidationErrorImpl('Modo inválido', 400, 'invalid_input');
    }
    mode = raw.mode as 'basic' | 'pro_plan';
  }
  let sessionMinutes: number | undefined;
  if (raw.sessionMinutes !== undefined && raw.sessionMinutes !== null) {
    sessionMinutes = requireNumberRange(raw.sessionMinutes, 'sessionMinutes', 1, 480);
  }
  let equipment: string | undefined;
  if (raw.equipment !== undefined && raw.equipment !== null) {
    equipment = validateString(raw.equipment, 'equipment');
  }
  return { daysPerWeek, objective, level, equipment, mode, sessionMinutes };
}

export function validateRecommendationsResponse(text: string): Array<{ title: string; description: string; category: string }> {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ValidationErrorImpl('Respuesta del proveedor no es JSON válido', 502, 'invalid_provider_response');
  }
  if (!Array.isArray(parsed)) {
    throw new ValidationErrorImpl('Respuesta del proveedor no es un array', 502, 'invalid_provider_response');
  }
  return parsed.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ValidationErrorImpl('Elemento de recomendación inválido', 502, 'invalid_provider_response');
    }
    const it = item as Record<string, unknown>;
    const title = requireString(it.title, 'recommendation.title', MAX_STRING_LENGTH, 502);
    const description = requireString(it.description, 'recommendation.description', MAX_STRING_LENGTH, 502);
    const category = requireString(it.category, 'recommendation.category', MAX_STRING_LENGTH, 502);
    if (!VALID_CATEGORIES.includes(category)) {
      throw new ValidationErrorImpl('Categoría inválida', 502, 'invalid_provider_response');
    }
    return { title, description, category };
  });
}

export function validateRoutineResponse(text: string): {
  name: string;
  description: string;
  exercises: Array<{ name: string; sets: number; reps: string; restTime: string }>;
} {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ValidationErrorImpl('Respuesta del proveedor no es JSON válido', 502, 'invalid_provider_response');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationErrorImpl('Respuesta del proveedor no es un objeto', 502, 'invalid_provider_response');
  }
  const obj = parsed as Record<string, unknown>;
  const name = requireString(obj.name, 'routine.name', MAX_STRING_LENGTH, 502);
  const description = requireString(obj.description, 'routine.description', MAX_STRING_LENGTH, 502);
  const exercisesRaw = requireArrayLength(obj.exercises, 'routine.exercises', 1, MAX_EXERCISES_PER_WORKOUT, 502);
  const exercises = exercisesRaw.map((ex: unknown) => {
    if (!ex || typeof ex !== 'object' || Array.isArray(ex)) {
      throw new ValidationErrorImpl('Ejercicio inválido', 502, 'invalid_provider_response');
    }
    const exObj = ex as Record<string, unknown>;
    const sets = requireNumberRange(exObj.sets, 'exercise.sets', 1, 100, 502);
    if (!Number.isInteger(sets)) {
      throw new ValidationErrorImpl('exercise.sets debe ser un entero', 502, 'invalid_provider_response');
    }
    return {
      name: requireString(exObj.name, 'exercise.name', MAX_STRING_LENGTH, 502),
      sets,
      reps: requireString(exObj.reps, 'exercise.reps', MAX_STRING_LENGTH, 502),
      restTime: requireString(exObj.restTime, 'exercise.restTime', MAX_STRING_LENGTH, 502),
    };
  });
  return { name, description, exercises };
}