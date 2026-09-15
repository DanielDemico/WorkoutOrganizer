import { useI18n } from '../i18n';

interface CelebrationModalProps {
  onClose: () => void;
}

// Shown once, when confirming an exercise finishes off the last pending one for the day
// (WorkoutViewPage acts on `diaConcluido` from the mark-done response).
export function CelebrationModal({ onClose }: CelebrationModalProps) {
  const { t } = useI18n();

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet celebration-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="celebration-emoji" aria-hidden="true">
          🎉
        </div>
        <h2 className="celebration-title">{t.celebration.title}</h2>
        <p className="celebration-subtitle">{t.celebration.subtitle}</p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {t.common.close}
        </button>
      </div>
    </div>
  );
}
