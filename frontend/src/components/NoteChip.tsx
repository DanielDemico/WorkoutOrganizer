import { useI18n } from '../i18n';
import type { ExerciseNote } from '../api/completions';

interface NoteChipProps {
  note: ExerciseNote;
  onOpen: () => void;
}

// The reminder of how the last session went, sitting on the card of the exercise it belongs to.
// The number is the *heaviest* weight of the note, not the last set nor the average: it is the
// one people say out loud ("I did 60") and the only one that answers "can I go up?" at a glance
// (spec 006 §6.5).
export function NoteChip({ note, onOpen }: NoteChipProps) {
  const { t } = useI18n();
  const heaviest = note.sets.length > 0 ? Math.max(...note.sets) : null;

  return (
    <button
      type="button"
      className="exercise-card-note-chip"
      aria-label={heaviest === null ? t.notes.chipEmpty : t.notes.chip(heaviest)}
      // The whole card is the conclusion target, so tapping the chip must not open the veil —
      // the same guard the gif toggle and the steps <details> already use.
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      <span aria-hidden="true">🗒</span>
      {heaviest !== null && <span aria-hidden="true">{heaviest}</span>}
    </button>
  );
}
