import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { localeTag } from '../i18n/lang';
import type { ExerciseNote } from '../api/completions';

/** Server ceiling too — a sanity limit, not a training rule (spec 006 §5.2). */
const MAX_SETS = 20;

/** Rows a brand-new sheet starts with when `series` cannot say how many sets there are. */
const DEFAULT_SETS = 3;

// `series` is the initial suggestion, never the authority: it is NULL in 21 of the 24 rows in
// the database, and the 3 that have a value use a legacy format the API would now reject. Only
// the `NxM` the ExerciseDetailModal writes today can be parsed (spec 006 §3.3).
function parseSetCount(series: string | null): number | null {
  const match = /^(\d+)x\d+$/.exec(series?.trim() ?? '');
  if (!match) return null;
  const sets = Number(match[1]);
  return sets >= 1 && sets <= MAX_SETS ? sets : null;
}

// 'YYYY-MM-DD' built as a local date: new Date('2026-09-01') is parsed as UTC and renders as
// the 31st for anyone west of Greenwich.
function formatLongDate(date: string, locale: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(
    new Date(year, month - 1, day),
  );
}

function initialWeights(initial: ExerciseNote | null, series: string | null): string[] {
  if (initial && initial.sets.length > 0) return initial.sets.map((w) => String(w));
  return Array(parseSetCount(series) ?? DEFAULT_SETS).fill('');
}

interface NoteSheetProps {
  exerciseName: string;
  series: string | null;
  /** The note being edited, or null for the sheet that opens right after concluding. */
  initial: ExerciseNote | null;
  /** A note from a past date is read-only: correcting it needs a history screen (spec 006 §9). */
  readOnly: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (text: string | null, sets: { weight: number }[]) => void;
  onDelete?: () => void;
}

// The sheet that opens after an exercise is concluded, and again when its chip is tapped. The
// exercise is *already* done when this opens — closing it any which way never undoes that, and
// the sheet does not need to say so because the card behind it already shows the ✓ (spec 006 §6.3).
export function NoteSheet({
  exerciseName,
  series,
  initial,
  readOnly,
  saving,
  onClose,
  onSave,
  onDelete,
}: NoteSheetProps) {
  const { lang, t } = useI18n();
  const [text, setText] = useState(initial?.text ?? '');
  const [weights, setWeights] = useState<string[]>(() => initialWeights(initial, series));
  const [error, setError] = useState<string | null>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  const isEmpty = text.trim() === '' && weights.every((w) => w.trim() === '');

  // Esc and the overlay go inert once something is typed, so the only way out of a filled sheet
  // is Save — otherwise the Skip/Save rule below would be decorative and a stray tap outside
  // would throw the typing away (spec 006 §6.3).
  useEffect(() => {
    if (!readOnly && (!isEmpty || saving)) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readOnly, isEmpty, saving, onClose]);

  const dismissable = readOnly || (isEmpty && !saving);

  const setWeight = (index: number, value: string) => {
    setWeights((prev) => prev.map((w, i) => (i === index ? value : w)));
    setError(null);
  };

  // The label is the position, so removing a row renumbers everything below it on the spot —
  // there is nothing to renumber in state because the index *is* the set number.
  const removeWeight = (index: number) => {
    setWeights((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const addWeight = () => setWeights((prev) => (prev.length >= MAX_SETS ? prev : [...prev, '']));

  const handleSave = () => {
    const sets: { weight: number }[] = [];

    for (const raw of weights) {
      const trimmed = raw.trim();
      // A blank row is not an error: it is dropped, and the numbering sent is that of the rows
      // that were filled in (spec 006 §6.2).
      if (trimmed === '') continue;

      const weight = Number(trimmed.replace(',', '.'));
      if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) {
        setError(t.notes.weightError);
        return;
      }
      sets.push({ weight });
    }

    setError(null);
    onSave(text.trim() === '' ? null : text.trim(), sets);
  };

  return (
    <div className="sheet-overlay" onClick={dismissable ? onClose : undefined}>
      <div
        className="sheet notes-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />

        <div className="notes-heading">
          <p className="notes-exercise">{exerciseName}</p>
          <h2 id="note-sheet-title" className="notes-title">
            {readOnly && initial
              ? t.notes.lastTime(formatLongDate(initial.date, localeTag(lang)))
              : t.notes.title}
          </h2>
        </div>

        <div className="notes-body">
          <label className="field">
            <span>{t.notes.textLabel}</span>
            {readOnly ? (
              <p className="notes-readonly-text">{initial?.text || '—'}</p>
            ) : (
              <textarea
                className="input textarea"
                value={text}
                rows={3}
                placeholder={t.notes.textPlaceholder}
                onChange={(event) => setText(event.target.value)}
              />
            )}
          </label>

          <div className="field">
            <span>{t.notes.weightLabel}</span>

            {weights.length === 0 && readOnly && <p className="notes-readonly-text">—</p>}

            {weights.map((weight, index) => (
              // The index is the key on purpose: these rows have no identity of their own, and
              // the set number is exactly the position.
              <div className="note-set-row" key={index}>
                <span className="note-set-label">{t.notes.setLabel(index + 1)}</span>
                {readOnly ? (
                  <span className="note-set-value">
                    {weight} {t.notes.unit}
                  </span>
                ) : (
                  <>
                    <input
                      className="input note-set-input"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={1000}
                      step={0.5}
                      value={weight}
                      aria-label={t.notes.setLabel(index + 1)}
                      onChange={(event) => setWeight(index, event.target.value)}
                    />
                    <span className="note-set-unit">{t.notes.unit}</span>
                    <button
                      type="button"
                      className="note-set-remove"
                      aria-label={t.notes.removeSet(index + 1)}
                      onClick={() => removeWeight(index)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </>
                )}
              </div>
            ))}

            {/* Removing without being able to add back is a one-way door, and `series` is null
                for most exercises — so a sheet that starts at 3 rows has to be able to reach 5. */}
            {!readOnly && weights.length < MAX_SETS && (
              <button type="button" className="btn btn-ghost btn-small note-add-set" onClick={addWeight}>
                {t.notes.addSet}
              </button>
            )}
          </div>

          {error && <p className="field-error">{error}</p>}
        </div>

        {readOnly ? (
          <div className="confirm-actions">
            <button ref={firstButtonRef} type="button" className="btn btn-secondary" onClick={onClose}>
              {t.common.close}
            </button>
            {onDelete && (
              <button type="button" className="btn btn-danger" onClick={onDelete} disabled={saving}>
                {t.notes.delete}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Exactly one of the two is ever live, so the way out always tells the truth about
                what it will do: Skip with text typed would silently bin it, and Save with
                everything blank would write the empty note §4.2 forbids. */}
            <div className="confirm-actions">
              <button
                ref={firstButtonRef}
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={!isEmpty || saving}
              >
                {t.notes.skip}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isEmpty || saving}
              >
                {t.notes.save}
              </button>
            </div>
            {onDelete && (
              <button
                type="button"
                className="btn btn-ghost btn-small notes-delete"
                onClick={onDelete}
                disabled={saving}
              >
                {t.notes.delete}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
