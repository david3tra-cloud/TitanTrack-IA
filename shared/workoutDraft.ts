import type { Exercise } from '../types.ts';

export const LEGACY_WORKOUT_DRAFT_KEY = 'titan_active_workout';
const WORKOUT_DRAFT_KEY_PREFIX = 'titan_active_workout';

export interface WorkoutDraft {
  ownerId: string | null;
  name: string;
  exercises: Exercise[];
  totalSeconds: number;
}

export interface WorkoutDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const getWorkoutDraftStorageKey = (userId: string | null): string =>
  userId === null
    ? `${WORKOUT_DRAFT_KEY_PREFIX}:guest`
    : `${WORKOUT_DRAFT_KEY_PREFIX}:user:${encodeURIComponent(userId)}`;

export const readWorkoutDraft = (
  storage: Pick<WorkoutDraftStorage, 'getItem'>,
  userId: string | null
): WorkoutDraft | null => {
  const raw = storage.getItem(getWorkoutDraftStorageKey(userId));
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('ownerId' in parsed) ||
      parsed.ownerId !== userId ||
      !('name' in parsed) ||
      typeof parsed.name !== 'string' ||
      !('exercises' in parsed) ||
      !Array.isArray(parsed.exercises) ||
      !('totalSeconds' in parsed) ||
      typeof parsed.totalSeconds !== 'number'
    ) {
      return null;
    }

    return parsed as WorkoutDraft;
  } catch (error) {
    console.error('No se pudo leer el borrador de entrenamiento:', error);
    return null;
  }
};

export const createWorkoutDraftWriter = (
  storage: Pick<WorkoutDraftStorage, 'setItem'>,
  userId: string | null
) => {
  const key = getWorkoutDraftStorageKey(userId);

  return (draft: Omit<WorkoutDraft, 'ownerId'>): void => {
    storage.setItem(key, JSON.stringify({ ...draft, ownerId: userId }));
  };
};

export const removeWorkoutDraft = (
  storage: Pick<WorkoutDraftStorage, 'removeItem'>,
  userId: string | null
): void => {
  storage.removeItem(getWorkoutDraftStorageKey(userId));
};

export const hasUnownedLegacyWorkoutDraft = (
  storage: Pick<WorkoutDraftStorage, 'getItem'>
): boolean => {
  const raw = storage.getItem(LEGACY_WORKOUT_DRAFT_KEY);
  return raw !== null && raw.trim().length > 0;
};

export const discardUnownedLegacyWorkoutDraft = (
  storage: Pick<WorkoutDraftStorage, 'removeItem'>
): void => {
  storage.removeItem(LEGACY_WORKOUT_DRAFT_KEY);
};

export const canSaveWorkoutDraft = (
  draftOwnerId: string | null,
  activeUserId: string | null
): boolean => draftOwnerId !== null && draftOwnerId === activeUserId;
