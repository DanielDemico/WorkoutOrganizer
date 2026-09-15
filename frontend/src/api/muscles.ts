import { apiFetch } from './client';

/** One `body-muscles` SVG region and how hard the plan hits it. */
export interface MuscleIntensity {
  muscleId: string;
  points: number;
  intensity: number;
}

/** Score per dataset term, before it is exploded into SVG regions. */
export interface MuscleTermBreakdown {
  /** Join key with muscle_mapping — English, never translated (spec 004 §7.4). */
  term: string;
  label: string;
  primaryCount: number;
  secondaryCount: number;
  points: number;
  muscleIds: string[];
}

/** Known term with no anatomical region to paint (`cardiovascular system`). */
export interface IgnoredTerm {
  term: string;
  label: string;
  exerciseCount: number;
}

export interface MuscleUsage {
  totalExercises: number;
  maxPoints: number;
  muscles: MuscleIntensity[];
  breakdown: MuscleTermBreakdown[];
  ignored: IgnoredTerm[];
}

export const getMuscleUsage = () => apiFetch<MuscleUsage>('/api/user-exercises/muscle-usage');
