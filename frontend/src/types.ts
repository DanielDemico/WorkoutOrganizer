export interface User {
  id: number;
  name: string;
}

export interface Workout {
  workoutId: number;
  nome: string;
  userId: number;
  /** How many exercises the workout holds — what the delete confirmation counts (spec 005 §3.3). */
  exerciseCount: number;
}

export interface Exercise {
  id: string;
  name: string;
  category: string | null;
  bodyPart: string | null;
  equipment: string | null;
  muscleGroup: string | null;
  target: string | null;
  image: string | null;
  gifUrl: string | null;
}

export interface ExerciseDetail extends Exercise {
  instructions: string | null;
  instructionSteps: string[];
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

// Sunday-first, matching Date#getDay() (0 = domingo) and the weekly-cycle date math in lib/weekCycle.ts.
export const WEEK_DAYS = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
] as const;

export type WeekDay = (typeof WEEK_DAYS)[number];

// The day labels used to live here; they are display text and moved to the i18n
// dictionaries, keyed by these same invariant values (spec 004 §9.1).

// Either a catalog exercise (`exercise` set) or one the catalog does not have, kept under
// the name the user's sheet gave it (`customName` set, `exercise` null) — spec 0010 §5.
export interface WorkoutExercise {
  id: number;
  workoutId: number;
  exerciseId: string | null;
  customName: string | null;
  dia: WeekDay;
  ordem: number;
  series: string | null;
  observacao: string | null;
  exercise: ExerciseDetail | null;
}

export const exerciseDisplayName = (we: WorkoutExercise): string =>
  we.exercise?.name ?? we.customName ?? '';

export interface WorkoutDetail extends Workout {
  exercises: WorkoutExercise[];
}

export interface WorkoutImportResponse {
  workoutId: number;
  nome: string;
  userId: number;
  // Nothing is left pending: an item the catalog could not place arrives here as a
  // custom-named exercise, like any other row (spec 0010 §5).
  exercises: WorkoutExercise[];
  /** Set when the file was read as plain text because its own reader failed (spec 0009). */
  degradedReason?: string | null;
}
