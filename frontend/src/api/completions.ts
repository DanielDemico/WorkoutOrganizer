import { apiFetch } from './client';

export interface ExerciseCompletionResult {
  workoutExerciseId: number;
  date: string;
  feito: boolean;
  diaConcluido: boolean;
}

export interface ExerciseCompletionSummary {
  workoutExerciseId: number;
  date: string;
}

export interface CalendarDay {
  date: string;
  totalExercises: number;
  doneExercises: number;
  completo: boolean;
}

export const markExerciseDone = (workoutId: number, workoutExerciseId: number, date: string) =>
  apiFetch<ExerciseCompletionResult>(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}/completions`, {
    method: 'POST',
    body: { date },
  });

export const getWorkoutCompletions = (workoutId: number, start: string, end: string) =>
  apiFetch<ExerciseCompletionSummary[]>(
    `/api/workouts/${workoutId}/completions?start=${start}&end=${end}`,
  );

export const getMonthCalendar = (year: number, month: number) =>
  apiFetch<CalendarDay[]>(`/api/user-exercises/calendar?year=${year}&month=${month}`);

// What the user wrote about one execution (spec 006). It hangs off the completion, so it is
// addressed by workoutExerciseId + date — there is no note id to keep around.
export interface ExerciseNote {
  workoutExerciseId: number;
  date: string;
  text: string | null;
  /** Weights in kg, already ordered: the index is the set number. */
  sets: number[];
}

const notePath = (workoutId: number, workoutExerciseId: number, date: string) =>
  `/api/workouts/${workoutId}/exercises/${workoutExerciseId}/completions/${date}/note`;

// Answers 204 — and apiFetch turns that into undefined — when the note comes back empty, which
// the server reads as "delete it" (spec 006 §4.2). So undefined here means "there is no note".
export const putExerciseNote = (
  workoutId: number,
  workoutExerciseId: number,
  date: string,
  body: { text: string | null; sets: { weight: number }[] },
) =>
  apiFetch<ExerciseNote | undefined>(notePath(workoutId, workoutExerciseId, date), {
    method: 'PUT',
    body,
  });

export const deleteExerciseNote = (workoutId: number, workoutExerciseId: number, date: string) =>
  apiFetch<void>(notePath(workoutId, workoutExerciseId, date), { method: 'DELETE' });

export const getLatestNotes = (workoutId: number) =>
  apiFetch<ExerciseNote[]>(`/api/workouts/${workoutId}/notes/latest`);
