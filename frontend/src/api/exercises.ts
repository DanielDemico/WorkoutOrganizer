import { apiFetch } from './client';
import type { Exercise, ExerciseDetail, PagedResponse } from '../types';

export interface SearchExercisesParams {
  search?: string;
  muscleGroup?: string;
  page?: number;
  pageSize?: number;
}

export function searchExercises({
  search,
  muscleGroup,
  page = 1,
  pageSize = 20,
}: SearchExercisesParams = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search?.trim()) params.set('search', search.trim());
  if (muscleGroup?.trim()) params.set('muscleGroup', muscleGroup.trim());
  return apiFetch<PagedResponse<Exercise>>(`/api/exercises?${params.toString()}`);
}

/**
 * `value` is the raw English key sent back in `?muscleGroup=`; `label` is what the user reads.
 * They are separate because the column is both an identifier and display text — translating it
 * in place would make the filter compare "Peitoral" with `pectorals` (spec 004 §7.3).
 */
export interface MuscleGroupOption {
  value: string;
  label: string;
}

export function getMuscleGroups() {
  return apiFetch<MuscleGroupOption[]>('/api/exercises/muscle-groups');
}

export function getExerciseDetail(id: string) {
  return apiFetch<ExerciseDetail>(`/api/exercises/${id}`);
}
