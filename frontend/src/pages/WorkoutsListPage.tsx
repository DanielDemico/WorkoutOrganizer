import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteWorkout, listWorkouts } from '../api/workouts';
import { ApiError } from '../api/client';
import type { Workout } from '../types';
import { useI18n } from '../i18n';
import { TopBar } from '../components/TopBar';
import { DeleteWorkoutModal } from '../components/DeleteWorkoutModal';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';

export default function WorkoutsListPage() {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    listWorkouts()
      .then((data) => {
        if (!cancelled) setWorkouts(data);
      })
      .catch(() => {
        if (!cancelled) setError(t.workouts.loadError);
      });
    return () => {
      cancelled = true;
    };
    // Workout names are typed by the user and never translated, so only the error copy
    // depends on the language here.
  }, [t]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { workoutId } = pendingDelete;

    setDeleting(true);
    setError(null);
    try {
      await deleteWorkout(workoutId);
      dropFromList(workoutId);
    } catch (err) {
      // 404 means it is already gone — another tab, another device. Keeping the row on screen
      // would be a lie, so it leaves the list exactly like a successful delete (spec 005 §4.3).
      if (err instanceof ApiError && err.status === 404) dropFromList(workoutId);
      else setError(t.workouts.deleteError);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  // Removed locally instead of refetching: the server answered 204 and has nothing to add, and
  // a refetch would flash the whole list over one row.
  function dropFromList(workoutId: number) {
    setWorkouts((current) => current?.filter((w) => w.workoutId !== workoutId) ?? null);
  }

  return (
    <div className="app-shell">
      <TopBar
        title={t.workouts.title}
        menu
        action={
          <Link to="/treino/novo?import=true" className="btn btn-small btn-secondary topbar-import-btn">
            ✨ {t.workouts.importWorkout}
          </Link>
        }
      />

      <main className="container">
        {error && <ErrorBanner message={error} />}

        {!workouts && !error && (
          <div className="page-loading">
            <Spinner />
          </div>
        )}

        {workouts && workouts.length === 0 && (
          <EmptyState title={t.workouts.emptyTitle} subtitle={t.workouts.emptySubtitle} />
        )}

        {workouts && workouts.length > 0 && (
          <ul className="workout-list">
            {workouts.map((workout) => (
              // The row is the flex container and the link is only part of it: a <button>
              // inside an <a> is invalid HTML and the click would navigate too (spec 005 §4.1).
              <li key={workout.workoutId} className="workout-row">
                <Link to={`/treino/${workout.workoutId}`} className="workout-card">
                  <span className="workout-card-name">{workout.nome}</span>
                  <span className="workout-card-chevron">›</span>
                </Link>
                <button
                  type="button"
                  className="workout-row-delete"
                  // Without the name, a screen reader announces a list of indistinguishable
                  // "Delete" buttons.
                  aria-label={t.workouts.delete(workout.nome)}
                  onClick={() => setPendingDelete(workout)}
                >
                  <span aria-hidden="true">🗑</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {pendingDelete && (
        <DeleteWorkoutModal
          workout={pendingDelete}
          deleting={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      <Link to="/treino/novo" className="fab" aria-label={t.workouts.create}>
        +
      </Link>
    </div>
  );
}
