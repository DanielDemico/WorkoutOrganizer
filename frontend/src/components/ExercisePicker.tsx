import { useEffect, useState } from 'react';
import { getMuscleGroups, searchExercises, type MuscleGroupOption } from '../api/exercises';
import { useI18n } from '../i18n';
import type { Exercise } from '../types';
import { ExerciseMedia } from './ExerciseMedia';
import { Spinner } from './Feedback';

const PAGE_SIZE = 20;

interface ExercisePickerProps {
  dayLabel: string;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}

export function ExercisePicker({ dayLabel, onClose, onSelect }: ExercisePickerProps) {
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupOption[]>([]);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<Exercise[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lang, t } = useI18n();

  useEffect(() => {
    getMuscleGroups()
      .then(setMuscleGroups)
      .catch(() => setMuscleGroups([]));
  }, [lang]);

  // Any filter change starts back at page 1 (the previous page may no longer exist).
  useEffect(() => {
    setPage(1);
  }, [search, muscleGroup]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const timeout = setTimeout(
      () => {
        searchExercises({ search, muscleGroup, page, pageSize: PAGE_SIZE })
          .then((res) => {
            if (cancelled) return;
            setResults(res.items);
            setTotalPages(res.totalPages);
            setTotalCount(res.totalCount);
          })
          .catch(() => {
            if (!cancelled) setError(t.picker.searchError);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      search ? 300 : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // lang belongs here: the results carry translated names (spec 004 §9.3).
  }, [search, muscleGroup, page, lang, t]);

  return (
    <div className="sheet-overlay" role="dialog" aria-modal="true" aria-label={t.picker.dialogLabel(dayLabel)}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>{t.picker.heading(dayLabel)}</h2>
          <button type="button" className="icon-btn" aria-label={t.common.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="picker-filters">
          <input
            className="input"
            type="search"
            placeholder={t.picker.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <select
            className="input select"
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value)}
            aria-label={t.picker.groupFilter}
          >
            <option value="">{t.picker.allGroups}</option>
            {/* value stays the English key the API filters on; only the label is translated. */}
            {muscleGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="field-error">{error}</p>}

        <div className="sheet-results">
          {loading && (
            <div className="sheet-loading">
              <Spinner />
            </div>
          )}

          {!loading && results.length === 0 && <p className="empty-state-subtitle">{t.picker.noResults}</p>}

          {!loading &&
            results.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                className="exercise-pick-row"
                onClick={() => onSelect(exercise)}
              >
                <div className="exercise-pick-thumb">
                  <ExerciseMedia exercise={exercise} size="sm" interactive={false} />
                </div>
                <div className="exercise-pick-info">
                  <span className="exercise-pick-name">{exercise.name}</span>
                  <span className="exercise-pick-meta">
                    {[exercise.muscleGroup, exercise.equipment].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="exercise-pick-add">+</span>
              </button>
            ))}
        </div>

        {!loading && totalPages > 1 && (
          <div className="pagination-bar">
            <button
              type="button"
              className="btn btn-small btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t.picker.previous}
            </button>
            <span className="pagination-label">
              {t.picker.pagination(page, totalPages, totalCount)}
            </span>
            <button
              type="button"
              className="btn btn-small btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t.picker.next}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
