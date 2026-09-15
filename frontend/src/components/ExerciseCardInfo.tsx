import { useState } from 'react';
import { mediaUrl } from '../api/client';
import { useI18n } from '../i18n';
import type { ExerciseDetail } from '../types';

interface ExerciseCardInfoProps {
  exercise: ExerciseDetail | null;
  customName?: string | null;
  series?: string | null;
  observacao?: string | null;
}

// Shared layout for an exercise assigned to a workout day: a toggle above the card flips
// between the gif (default) and the technical info (title + series, observação, instructions,
// a collapsed step-by-step, and muscles worked at the bottom with less emphasis). No static
// image is used here — only the gif.
//
// With `exercise` null the row is one the catalog does not have (spec 0010 §6.2): it shows the
// sheet's own name, the series and the note under a "fora do catálogo" badge, and nothing else —
// there is no gif, no technique and no muscle list to pretend about.
export function ExerciseCardInfo({ exercise, customName, series, observacao }: ExerciseCardInfoProps) {
  const [showGif, setShowGif] = useState(true);
  const { t } = useI18n();

  if (!exercise) {
    return (
      <div className="exercise-card-content exercise-card-custom">
        <h3 className="exercise-card-title">
          <span className="exercise-card-name">{customName}</span>
          {series && <span className="exercise-card-series">{series}</span>}
        </h3>
        <p className="exercise-card-custom-badge" role="note">
          <span aria-hidden="true">⚠️</span> {t.exerciseCard.customBadge}
        </p>
        {observacao && <p className="exercise-card-note">{observacao}</p>}
      </div>
    );
  }

  const gifUrl = mediaUrl(exercise.gifUrl);
  const muscles = [exercise.muscleGroup, exercise.target].filter(Boolean).join(' · ');

  return (
    <div className="exercise-card-content">
      <h3 className="exercise-card-title">
        <span className="exercise-card-name">{exercise.name}</span>
        {series && <span className="exercise-card-series">{series}</span>}
      </h3>

      <div className="exercise-card-view-toggle" role="tablist" aria-label={t.exerciseCard.viewToggle}>
        <button
          type="button"
          role="tab"
          aria-selected={showGif}
          className={showGif ? 'active' : ''}
          onClick={(e) => {
            e.stopPropagation();
            setShowGif(true);
          }}
        >
          {t.exerciseCard.gif}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!showGif}
          className={!showGif ? 'active' : ''}
          onClick={(e) => {
            e.stopPropagation();
            setShowGif(false);
          }}
        >
          {t.exerciseCard.details}
        </button>
      </div>

      <div className="exercise-card-flip">
        <div className={`exercise-card-flip-inner ${showGif ? '' : 'flipped'}`}>
          <div
            className={`exercise-card-face exercise-card-face-gif ${showGif ? '' : 'is-hidden-face'}`}
            aria-hidden={!showGif}
          >
            <div className="exercise-media exercise-media-lg">
              {gifUrl ? (
                <img src={gifUrl} alt={exercise.name} loading="lazy" />
              ) : (
                <div className="exercise-media-placeholder">{t.exerciseCard.noGif}</div>
              )}
            </div>
          </div>

          <div
            className={`exercise-card-face exercise-card-face-info ${showGif ? 'is-hidden-face' : ''}`}
            aria-hidden={showGif}
          >
            {observacao && <p className="exercise-card-note">{observacao}</p>}

            {exercise.instructions && <p className="exercise-card-instructions">{exercise.instructions}</p>}

            {exercise.instructionSteps.length > 0 && (
              <details className="exercise-card-steps" onClick={(e) => e.stopPropagation()}>
                <summary>{t.exerciseCard.steps(exercise.instructionSteps.length)}</summary>
                <ol>
                  {exercise.instructionSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </div>
      </div>

      {muscles && <p className="exercise-card-muscles">{muscles}</p>}
    </div>
  );
}
