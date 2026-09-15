import { useState } from 'react';
import { mediaUrl } from '../api/client';
import { useI18n } from '../i18n';
import type { Exercise } from '../types';

type MediaMode = 'image' | 'gif';

interface ExerciseMediaProps {
  exercise: Exercise;
  size?: 'sm' | 'lg';
  /** Set false inside an already-clickable row (e.g. the exercise picker) to avoid nesting <button>s. */
  interactive?: boolean;
}

export function ExerciseMedia({ exercise, size = 'lg', interactive = true }: ExerciseMediaProps) {
  const [mode, setMode] = useState<MediaMode>('image');
  const { t } = useI18n();

  const imageUrl = mediaUrl(exercise.image);
  const gifUrl = mediaUrl(exercise.gifUrl);
  const hasBoth = Boolean(imageUrl && gifUrl);
  const src = (mode === 'gif' ? gifUrl : imageUrl) ?? gifUrl ?? imageUrl;

  return (
    <div className={`exercise-media exercise-media-${size}`}>
      {src ? (
        <img src={src} alt={exercise.name} loading="lazy" />
      ) : (
        <div className="exercise-media-placeholder">{t.media.none}</div>
      )}

      {hasBoth && interactive && (
        <div className="media-toggle" role="tablist" aria-label={t.media.toggle}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'image'}
            className={mode === 'image' ? 'active' : ''}
            onClick={(e) => {
              e.stopPropagation();
              setMode('image');
            }}
          >
            {t.media.photo}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'gif'}
            className={mode === 'gif' ? 'active' : ''}
            onClick={(e) => {
              e.stopPropagation();
              setMode('gif');
            }}
          >
            {t.media.gif}
          </button>
        </div>
      )}
    </div>
  );
}
