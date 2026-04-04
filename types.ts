export interface Set {
  id: string;
  reps: number;
  weight: number;
  completed?: boolean;
  restTime?: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  sets: Set[];
}

export interface Workout {
  id: string;
  date: string;
  name: string;
  exercises: Exercise[];
}

export type RecommendationCategory =
  | 'strength'
  | 'recovery'
  | 'nutrition'
  | 'technique';

export interface Recommendation {
  title: string;
  description: string;
  category: RecommendationCategory;
}

export interface RoutineExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restTime: string;
}

export interface Routine {
  id: string;
  name: string;
  description?: string;
  exercises: RoutineExercise[];
}

export interface WeightRecord {
  id: string;
  date: string;
  weight: number;
}

export type UserPlan = 'free' | 'pro' | 'infinity';

export type UserSex = 'male' | 'female' | 'other' | '';

export type UserGoal =
  | 'muscle_gain'
  | 'fat_loss'
  | 'strength'
  | 'recomposition'
  | 'health'
  | '';

export type UserLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | '';

export type TrainingStyle =
  | 'full_body'
  | 'upper_lower'
  | 'push_pull_legs'
  | 'body_part_split'
  | 'functional'
  | '';

export interface UserMeasurements {
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  armCm?: number;
  thighCm?: number;
}

export interface UserProfile {
  displayName: string;
  plan: UserPlan;

  sex: UserSex;
  birthYear?: number;
  heightCm?: number;
  weightKg?: number;
  goal: UserGoal;

  level: UserLevel;
  trainingDaysPerWeek?: number;
  sessionMinutes?: number;
  preferredStyle: TrainingStyle;
  equipment: string[];
  limitations: string;

  measurements: UserMeasurements;
}

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  plan: UserPlan;
}

export interface StoredAuthUser extends AuthUser {
  password: string;
}

export enum View {
  DASHBOARD = 'dashboard',
  LOG = 'log',
  PROGRESS = 'progress',
  RECS = 'recommendations',
  ROUTINES = 'routines',
  WEIGHT = 'weight',
  EXERCISES = 'exercises'
}