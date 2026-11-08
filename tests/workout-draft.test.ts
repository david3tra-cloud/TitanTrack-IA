import { assertEquals } from 'https://deno.land/std@0.223.0/assert/mod.ts';
import {
  canSaveWorkoutDraft,
  createWorkoutDraftWriter,
  discardUnownedLegacyWorkoutDraft,
  getWorkoutDraftStorageKey,
  hasUnownedLegacyWorkoutDraft,
  LEGACY_WORKOUT_DRAFT_KEY,
  readWorkoutDraft,
  type WorkoutDraftStorage
} from '../shared/workoutDraft.ts';

class MockStorage implements WorkoutDraftStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const draft = (name: string) => ({
  name,
  exercises: [],
  totalSeconds: 30
});

Deno.test('visitante -> usuario A: A no restaura el borrador del visitante', () => {
  const storage = new MockStorage();
  createWorkoutDraftWriter(storage, null)(draft('Visitante'));

  assertEquals(readWorkoutDraft(storage, 'user-a'), null);
  assertEquals(readWorkoutDraft(storage, null)?.name, 'Visitante');
});

Deno.test('usuario A -> cierre de sesión: el borrador de A no aparece como visitante', () => {
  const storage = new MockStorage();
  createWorkoutDraftWriter(storage, 'user-a')(draft('A'));

  assertEquals(readWorkoutDraft(storage, null), null);
  assertEquals(readWorkoutDraft(storage, 'user-a')?.name, 'A');
});

Deno.test('usuario A -> usuario B: la nueva cuenta solo carga su borrador', () => {
  const storage = new MockStorage();
  createWorkoutDraftWriter(storage, 'user-a')(draft('A'));
  createWorkoutDraftWriter(storage, 'user-b')(draft('B'));

  assertEquals(readWorkoutDraft(storage, 'user-b')?.name, 'B');
});

Deno.test('recargar con la misma identidad restaura el borrador propio', () => {
  const storage = new MockStorage();
  createWorkoutDraftWriter(storage, 'user-a')(draft('A'));

  assertEquals(readWorkoutDraft(storage, 'user-a')?.name, 'A');
});

Deno.test('los borradores de A y B permanecen independientes', () => {
  const storage = new MockStorage();
  createWorkoutDraftWriter(storage, 'user-a')(draft('A'));
  createWorkoutDraftWriter(storage, 'user-b')(draft('B'));

  assertEquals(readWorkoutDraft(storage, 'user-a')?.name, 'A');
  assertEquals(readWorkoutDraft(storage, 'user-b')?.name, 'B');
  assertEquals(getWorkoutDraftStorageKey('user-a') === getWorkoutDraftStorageKey('user-b'), false);
});

Deno.test('la clave antigua se avisa, no se migra y solo se elimina explícitamente', () => {
  const storage = new MockStorage();
  storage.setItem(LEGACY_WORKOUT_DRAFT_KEY, JSON.stringify(draft('Antiguo')));

  assertEquals(hasUnownedLegacyWorkoutDraft(storage), true);
  assertEquals(readWorkoutDraft(storage, 'user-a'), null);
  assertEquals(storage.getItem(LEGACY_WORKOUT_DRAFT_KEY) !== null, true);

  discardUnownedLegacyWorkoutDraft(storage);
  assertEquals(storage.getItem(LEGACY_WORKOUT_DRAFT_KEY), null);
  assertEquals(hasUnownedLegacyWorkoutDraft(new MockStorage()), false);
});

Deno.test('un autoguardado pendiente conserva la clave de su identidad original', () => {
  const storage = new MockStorage();
  const pendingWriteForA = createWorkoutDraftWriter(storage, 'user-a');
  const writeForB = createWorkoutDraftWriter(storage, 'user-b');

  writeForB(draft('B'));
  pendingWriteForA(draft('A pendiente'));

  assertEquals(readWorkoutDraft(storage, 'user-a')?.name, 'A pendiente');
  assertEquals(readWorkoutDraft(storage, 'user-b')?.name, 'B');
});

Deno.test('el guardado remoto exige que propietario e identidad activa coincidan', () => {
  assertEquals(canSaveWorkoutDraft('user-a', 'user-a'), true);
  assertEquals(canSaveWorkoutDraft('user-a', 'user-b'), false);
  assertEquals(canSaveWorkoutDraft('user-a', null), false);
  assertEquals(canSaveWorkoutDraft(null, null), false);
});
