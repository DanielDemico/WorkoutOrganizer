import { useState } from 'react';
import { ApiError } from '../api/client';
import { useI18n } from '../i18n';
import type { ExerciseDraft } from './ExerciseDetailModal';
import { Spinner } from './Feedback';

interface CustomExerciseSheetProps {
  initialName: string;
  initialSeries?: string;
  initialObservacao?: string;
  /** "Trocar exercício": opens the catalog picker with the current draft preserved. */
  onSwap: (draft: ExerciseDraft) => void;
  onClose: () => void;
  onConfirm: (customName: string, series: string | undefined, observacao: string) => Promise<void>;
}

// Edit form for a row the catalog does not have (spec 0010): free name, series and note. There
// is no technique reference to show, so this is the ExerciseDetailModal's form section alone,
// plus the name field and the way out into the catalog (spec 0011 §6.3).
export function CustomExerciseSheet({
  initialName,
  initialSeries,
  initialObservacao,
  onSwap,
  onClose,
  onConfirm,
}: CustomExerciseSheetProps) {
  const { t } = useI18n();
  const [initSets, initReps] = initialSeries ? initialSeries.split('x') : ['', ''];
  const [name, setName] = useState(initialName);
  const [sets, setSets] = useState(initSets || '');
  const [reps, setReps] = useState(initReps || '');
  const [observacao, setObservacao] = useState(initialObservacao || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSeries = () => {
    const s = sets.trim();
    const r = reps.trim();
    return s && r ? `${s}x${r}` : undefined;
  };

  const handleConfirm = async () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t.customExercise.needName);
      return;
    }
    if (sets.trim() && !reps.trim()) {
      setError(t.exerciseDetail.needReps);
      return;
    }
    if (reps.trim() && !sets.trim()) {
      setError(t.exerciseDetail.needSets);
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(trimmedName, currentSeries(), observacao.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.exerciseDetail.saveError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sheet-overlay" role="dialog" aria-modal="true" aria-label={t.customExercise.dialogLabel(initialName)}>
      <div className="sheet detail-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>{initialName}</h2>
          <button type="button" className="icon-btn" aria-label={t.common.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="detail-scroll">
          <p className="exercise-card-custom-badge" role="note">
            <span aria-hidden="true">⚠️</span> {t.exerciseCard.customBadge}
          </p>
          <p className="custom-sheet-hint">{t.customExercise.notInCatalog}</p>

          <button
            type="button"
            className="btn btn-small btn-secondary detail-swap-btn"
            onClick={() => onSwap({ series: currentSeries(), observacao: observacao.trim() })}
          >
            🔄 {t.exerciseDetail.swap}
          </button>

          <section className="detail-section detail-form">
            <label className="field">
              <span>{t.customExercise.nameLabel}</span>
              <input
                className="input"
                type="text"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <div className="series-inputs">
              <label className="field field-inline">
                <span>{t.exerciseDetail.sets}</span>
                <input
                  className="input input-series"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="4"
                  value={sets}
                  onChange={(e) => setSets(e.target.value)}
                />
              </label>
              <span className="series-separator">x</span>
              <label className="field field-inline">
                <span>{t.exerciseDetail.reps}</span>
                <input
                  className="input input-series"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="12"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              </label>
            </div>

            <label className="field">
              <span>{t.exerciseDetail.note}</span>
              <textarea
                className="input textarea"
                placeholder={t.exerciseDetail.notePlaceholder}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
              />
            </label>
          </section>

          {error && <p className="field-error">{error}</p>}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-add-exercise"
          onClick={handleConfirm}
          disabled={submitting}
        >
          {submitting ? <Spinner /> : t.exerciseDetail.save}
        </button>
      </div>
    </div>
  );
}
