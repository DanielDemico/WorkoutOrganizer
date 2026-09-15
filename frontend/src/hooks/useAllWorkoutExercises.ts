import { useEffect, useState } from 'react';
import { listWorkouts, getWorkout } from '../api/workouts';
import { useI18n } from '../i18n';
import type { WorkoutExercise } from '../types';

export interface WorkoutExerciseWithSource extends WorkoutExercise {
  workoutNome: string;
}

interface UseAllWorkoutExercisesResult {
  exercises: WorkoutExerciseWithSource[] | null;
  error: string | null;
}

// Aggregates exercises across every workout the user has, tagging each with the
// workout it came from. Used by modules (calendário, muscle-use) that need a
// cross-workout view instead of a single workout's detail.
export function useAllWorkoutExercises(): UseAllWorkoutExercisesResult {
  const [exercises, setExercises] = useState<WorkoutExerciseWithSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { lang, t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    setExercises(null);
    setError(null);

    listWorkouts()
      .then((workouts) => Promise.all(workouts.map((w) => getWorkout(w.workoutId))))
      .then((details) => {
        if (cancelled) return;
        const all = details.flatMap((detail) =>
          detail.exercises.map((we) => ({ ...we, workoutNome: detail.nome })),
        );
        setExercises(all);
      })
      .catch(() => {
        if (!cancelled) setError(t.workouts.loadError);
      });

    return () => {
      cancelled = true;
    };
    // Switching languages invalidates every exercise name already in memory, so the
    // fetch reruns instead of the page being reloaded (spec 004 §9.3).
  }, [lang, t]);

  return { exercises, error };
}
