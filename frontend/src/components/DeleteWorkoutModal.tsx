import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import type { Workout } from '../types';

interface DeleteWorkoutModalProps {
  workout: Workout;
  /** True while the DELETE is in flight — freezes both buttons so it cannot fire twice. */
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Confirmation for a destructive, irreversible action that also takes the completion history
// with it — something the user does not associate with the workout row they tapped (spec 005
// §4.2). Built on the same .sheet-overlay / .sheet pair as CelebrationModal and ExercisePicker
// so the app keeps one modal idiom.
export function DeleteWorkoutModal({ workout, deleting, onCancel, onConfirm }: DeleteWorkoutModalProps) {
  const { t } = useI18n();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus lands on Cancel: the destructive button is reachable but never the default.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    if (deleting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleting, onCancel]);

  return (
    <div className="sheet-overlay" onClick={deleting ? undefined : onCancel}>
      <div
        className="sheet confirm-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-workout-title"
        aria-describedby="delete-workout-body"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />

        {/* The modal was opened from a list, so it has to prove which row was tapped. */}
        <h2 id="delete-workout-title" className="confirm-title">
          {t.workouts.deleteTitle(workout.nome)}
        </h2>
        <p id="delete-workout-body" className="confirm-body">
          {t.workouts.deleteBody(workout.exerciseCount)}
        </p>

        <div className="confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={deleting}
          >
            {t.common.cancel}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={deleting}>
            {t.workouts.deleteConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
