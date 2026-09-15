import { apiFetch } from './client';
import type { Workout, WorkoutDetail, WorkoutExercise, WeekDay, WorkoutImportResponse } from '../types';

export const listWorkouts = () => apiFetch<Workout[]>('/api/workouts');

export const getWorkout = (id: number) => apiFetch<WorkoutDetail>(`/api/workouts/${id}`);

export const createWorkout = (nome: string) =>
  apiFetch<Workout>('/api/workouts', { method: 'POST', body: { nome } });

export const importWorkout = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<WorkoutImportResponse>('/api/workouts/import', {
    method: 'POST',
    body: formData,
  });
};

// Answers 204 and cascades to the workout's exercises and their completion history in the
// database, so there is nothing to read back (spec 005 §3.1).
export const deleteWorkout = (id: number) =>
  apiFetch<void>(`/api/workouts/${id}`, { method: 'DELETE' });

export interface AddExerciseInput {
  exerciseId: string;
  dia: WeekDay;
  series?: string;
  observacao?: string;
}

export const addExerciseToWorkout = (workoutId: number, input: AddExerciseInput) =>
  apiFetch<WorkoutExercise>(`/api/workouts/${workoutId}/exercises`, {
    method: 'POST',
    body: input,
  });

// Full replacement of the slot's content — exactly one of exerciseId/customName, and an
// omitted series/observacao clears it (spec 0011 §5). id, dia and ordem are untouched.
export interface UpdateExerciseInput {
  exerciseId?: string;
  customName?: string;
  series?: string;
  observacao?: string;
}

export const updateWorkoutExercise = (workoutId: number, workoutExerciseId: number, input: UpdateExerciseInput) =>
  apiFetch<WorkoutExercise>(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}`, {
    method: 'PUT',
    body: input,
  });

// 204; the server renumbers the rest of that day so ordem stays 1..N.
export const deleteWorkoutExercise = (workoutId: number, workoutExerciseId: number) =>
  apiFetch<void>(`/api/workouts/${workoutId}/exercises/${workoutExerciseId}`, { method: 'DELETE' });

export interface ExerciseOrder {
  workoutExerciseId: number;
  ordem: number;
}

// The whole day at once: `workoutExerciseIds` must be every slot of that day exactly once.
export const reorderWorkoutExercises = (workoutId: number, dia: WeekDay, workoutExerciseIds: number[]) =>
  apiFetch<ExerciseOrder[]>(`/api/workouts/${workoutId}/exercises/order`, {
    method: 'PUT',
    body: { dia, workoutExerciseIds },
  });

