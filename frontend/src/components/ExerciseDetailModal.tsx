import { useEffect, useState } from 'react';
import { getExerciseDetail } from '../api/exercises';
import { ApiError } from '../api/client';
import { useI18n } from '../i18n';
import type { Exercise, ExerciseDetail } from '../types';
import { ExerciseMedia } from './ExerciseMedia';
import { Spinner } from './Feedback';

// What the form holds at a given moment; handed out on "Trocar exercício" so the typed
// series/observação survive the swap (spec 0011 §6.3).
export interface ExerciseDraft {
  series?: string;
  observacao: string;
}

interface ExerciseDetailModalProps {
  exercise: Exercise;
  initialSeries?: string;
  initialObservacao?: string;
  /** "Salvar" in the edit flow; defaults to "Adicionar exercício". */
  confirmLabel?: string;
  /** Error shown when onConfirm rejects without an ApiError message. */
  errorLabel?: string;
  /** When set, a "Trocar exercício" button appears and receives the current draft. */
  onSwap?: (draft: ExerciseDraft) => void;
  onClose: () => void;
  onConfirm: (series: string | undefined, observacao: string) => Promise<void>;
}

export function ExerciseDetailModal({
  exercise,
  initialSeries,
  initialObservacao,
  confirmLabel,
  errorLabel,
  onSwap,
  onClose,
  onConfirm,
}: ExerciseDetailModalProps) {
  const [detail, setDetail] = useState<ExerciseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const [initSets, initReps] = initialSeries ? initialSeries.split('x') : ['', ''];
  const [sets, setSets] = useState(initSets || '');
  const [reps, setReps] = useState(initReps || '');
  const [observacao, setObservacao] = useState(initialObservacao || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { lang, t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    setLoadingDetail(true);

    getExerciseDetail(exercise.id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        /* the form still works without the technique reference */
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [exercise.id, lang]);

  const meta = [
    { label: t.exerciseDetail.category, value: exercise.category },
    { label: t.exerciseDetail.bodyPart, value: exercise.bodyPart },
    { label: t.exerciseDetail.muscleGroup, value: exercise.muscleGroup },
    { label: t.exerciseDetail.target, value: exercise.target },
    { label: t.exerciseDetail.equipment, value: exercise.equipment },
  ].filter((m) => m.value);

  const handleConfirm = async () => {
    setError(null);

    const setsTrimmed = sets.trim();
    const repsTrimmed = reps.trim();
    if (setsTrimmed && !repsTrimmed) {
      setError(t.exerciseDetail.needReps);
      return;
    }
    if (repsTrimmed && !setsTrimmed) {
      setError(t.exerciseDetail.needSets);
      return;
    }

    const series = setsTrimmed && repsTrimmed ? `${setsTrimmed}x${repsTrimmed}` : undefined;

    setSubmitting(true);
    try {
      await onConfirm(series, observacao.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (errorLabel ?? t.exerciseDetail.addError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sheet-overlay" role="dialog" aria-modal="true" aria-label={t.exerciseDetail.dialogLabel(exercise.name)}>
      <div className="sheet detail-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>{exercise.name}</h2>
          <button type="button" className="icon-btn" aria-label={t.common.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="detail-scroll">
          {onSwap && (
            <button
              type="button"
              className="btn btn-small btn-secondary detail-swap-btn"
              onClick={() => {
                const s = sets.trim();
                const r = reps.trim();
                onSwap({ series: s && r ? `${s}x${r}` : undefined, observacao: observacao.trim() });
              }}
            >
              🔄 {t.exerciseDetail.swap}
            </button>
          )}

          <ExerciseMedia exercise={exercise} />

          {meta.length > 0 && (
            <dl className="detail-meta-grid">
              {meta.map((m) => (
                <div key={m.label} className="detail-meta-item">
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {loadingDetail && (
            <div className="sheet-loading">
              <Spinner />
            </div>
          )}

          {!loadingDetail && detail?.instructions && (
            <section className="detail-section">
              <h3 className="detail-section-title">{t.exerciseDetail.instructions}</h3>
              <p className="detail-instructions">{detail.instructions}</p>
            </section>
          )}

          {!loadingDetail && detail && detail.instructionSteps.length > 0 && (
            <section className="detail-section">
              <h3 className="detail-section-title">{t.exerciseDetail.steps}</h3>
              <ol className="detail-steps">
                {detail.instructionSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </section>
          )}

          <section className="detail-section detail-form">
            <h3 className="detail-section-title">{t.exerciseDetail.formTitle}</h3>

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
          {submitting ? <Spinner /> : (confirmLabel ?? t.exerciseDetail.add)}
        </button>
      </div>
    </div>
  );
}
