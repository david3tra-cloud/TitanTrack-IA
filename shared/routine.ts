export const ROUTINE_FOCUSES = [
  { value: 'full_body', label: 'Cuerpo completo' },
  { value: 'upper_body', label: 'Tren superior' },
  { value: 'lower_body', label: 'Tren inferior' },
  { value: 'chest', label: 'Pecho' },
  { value: 'back', label: 'Espalda' },
  { value: 'shoulders', label: 'Hombros' },
  { value: 'arms', label: 'Brazos' },
  { value: 'legs', label: 'Piernas' },
  { value: 'glutes', label: 'Glúteos' },
  { value: 'core', label: 'Core' },
] as const;

export type RoutineFocus = (typeof ROUTINE_FOCUSES)[number]['value'];

export function isRoutineFocus(value: unknown): value is RoutineFocus {
  return (
    typeof value === 'string' &&
    ROUTINE_FOCUSES.some((option) => option.value === value)
  );
}

export function toggleRoutineFocus(
  selected: RoutineFocus[],
  focus: RoutineFocus
): RoutineFocus[] {
  if (focus === 'full_body') {
    return selected.includes(focus) ? [] : [focus];
  }

  const withoutFullBody = selected.filter((item) => item !== 'full_body');
  return withoutFullBody.includes(focus)
    ? withoutFullBody.filter((item) => item !== focus)
    : [...withoutFullBody, focus];
}
