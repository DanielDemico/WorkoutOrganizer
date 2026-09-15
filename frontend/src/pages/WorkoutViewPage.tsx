import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getWorkout } from '../api/workouts';
import {
  deleteExerciseNote,
  getLatestNotes,
  getWorkoutCompletions,
  markExerciseDone,
  putExerciseNote,
  type ExerciseNote,
} from '../api/completions';
import {
  WEEK_DAYS,
  exerciseDisplayName,
  type WeekDay,
  type WorkoutDetail,
  type WorkoutExercise,
} from '../types';
import { useI18n } from '../i18n';
import { getWeekDates, getWeekStart, msUntilNextMidnight } from '../lib/weekCycle';
import { TopBar } from '../components/TopBar';
import { ExerciseCardInfo } from '../components/ExerciseCardInfo';
import { CelebrationModal } from '../components/CelebrationModal';
import { NoteChip } from '../components/NoteChip';
import { NoteSheet } from '../components/NoteSheet';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';

interface OpenNoteSheet {
  exercise: WorkoutExercise;
  date: string;
  initial: ExerciseNote | null;
  readOnly: boolean;
}

// Recomputes at midnight so the "current week" (and therefore which date each weekday
// tab points at) rolls over on its own — see specs/0001-ciclo-semanal/spec.md §5.
function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const timer = setTimeout(() => setToday(new Date()), msUntilNextMidnight(today));
    return () => clearTimeout(timer);
  }, [today]);

  return today;
}

export default function WorkoutViewPage() {
  const { id } = useParams<{ id: string }>();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<WeekDay>('domingo');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  // A latch, not rendered state: nothing on screen depends on it until the note sheet closes.
  const pendingCelebration = useRef(false);
  const [noteSheet, setNoteSheet] = useState<OpenNoteSheet | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [latestNotes, setLatestNotes] = useState<Record<number, ExerciseNote>>({});
  const { lang, t } = useI18n();

  const today = useToday();
  const weekDates = useMemo(() => getWeekDates(getWeekStart(today)), [today]);
  const [doneByDate, setDoneByDate] = useState<Record<string, Set<number>>>({});

  // Keyed on the workout alone, not on the week: "latest" is deliberately without a date
  // cut-off, so rolling over at midnight does not change the answer (spec 006 §5.2).
  const reloadLatestNotes = useCallback(() => {
    if (!id) return;
    getLatestNotes(Number(id))
      .then((notes) => {
        setLatestNotes(Object.fromEntries(notes.map((note) => [note.workoutExerciseId, note])));
      })
      .catch(() => {
        // Non-fatal, like the completions below: the list still loads, just without chips.
      });
  }, [id]);

  useEffect(() => {
    reloadLatestNotes();
  }, [reloadLatestNotes]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getWorkoutCompletions(Number(id), weekDates[0], weekDates[6])
      .then((completions) => {
        if (cancelled) return;
        const byDate: Record<string, Set<number>> = {};
        for (const c of completions) {
          (byDate[c.date] ??= new Set()).add(c.workoutExerciseId);
        }
        setDoneByDate(byDate);
      })
      .catch(() => {
        // Non-fatal: the exercise list still loads, just without done/total badges.
      });

    return () => {
      cancelled = true;
    };
  }, [id, weekDates]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setWorkout(null);
    setError(null);
    setConfirmingId(null);

    getWorkout(Number(id))
      .then((data) => {
        if (!cancelled) setWorkout(data);
      })
      .catch(() => {
        if (!cancelled) setError(t.workoutView.loadError);
      });

    return () => {
      cancelled = true;
    };
    // Refetch on a language switch: the exercise text in this payload is localized
    // server-side (spec 004 §9.3).
  }, [id, lang, t]);

  // Lands on today's weekday by default (falling back to the first day that has exercises),
  // separate from the fetch above so it re-derives if the day rolls over at midnight.
  useEffect(() => {
    if (!workout) return;
    const todayDay = WEEK_DAYS[today.getDay()];
    const hasToday = workout.exercises.some((e) => e.dia === todayDay);
    const firstWithExercises = WEEK_DAYS.find((dia) => workout.exercises.some((e) => e.dia === dia));
    setSelectedDay(hasToday ? todayDay : (firstWithExercises ?? 'domingo'));
  }, [workout, today]);

  const selectedDate = weekDates[WEEK_DAYS.indexOf(selectedDay)];
  const doneIds = doneByDate[selectedDate] ?? new Set<number>();

  const dayExercises = useMemo(
    () =>
      workout
        ? workout.exercises.filter((e) => e.dia === selectedDay).sort((a, b) => a.ordem - b.ordem)
        : [],
    [workout, selectedDay],
  );

  const handleCardClick = (workoutExerciseId: number) => {
    if (doneIds.has(workoutExerciseId)) return;
    setConfirmingId((prev) => (prev === workoutExerciseId ? null : workoutExerciseId));
  };

  // The veil asks about one card, so it closes the way any transient overlay does — Esc, or a
  // tap anywhere outside the card. Neither existed on this page before (spec 006 §6.1).
  useEffect(() => {
    if (confirmingId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmingId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmingId]);

  const handleConfirm = async (exercise: WorkoutExercise) => {
    if (!id) return;
    setActionError(null);
    try {
      const result = await markExerciseDone(Number(id), exercise.id, selectedDate);
      setDoneByDate((prev) => {
        const next = new Set(prev[selectedDate] ?? []);
        next.add(exercise.id);
        return { ...prev, [selectedDate]: next };
      });
      setConfirmingId(null);
      // The conclusion is irrevocable in the gesture — it is already saved by the time the note
      // sheet opens, and closing that sheet any which way never undoes it (spec 006 §5.1).
      // The celebration waits for the sheet: confetti mid-typing is an interruption (§6.4).
      pendingCelebration.current = result.diaConcluido;
      setNoteSheet({ exercise, date: selectedDate, initial: null, readOnly: false });
    } catch {
      setActionError(t.workoutView.markError);
    }
  };

  const closeNoteSheet = useCallback(() => {
    setNoteSheet(null);
    if (pendingCelebration.current) {
      pendingCelebration.current = false;
      setCelebrating(true);
    }
  }, []);

  const handleSaveNote = async (text: string | null, sets: { weight: number }[]) => {
    if (!id || !noteSheet) return;
    setSavingNote(true);
    setActionError(null);
    try {
      const saved = await putExerciseNote(Number(id), noteSheet.exercise.id, noteSheet.date, {
        text,
        sets,
      });

      if (saved) {
        // The PUT answers with the stored note, so it replaces the map entry on the spot rather
        // than repainting the whole list through a refetch (spec 006 §6.6).
        setLatestNotes((prev) => ({ ...prev, [saved.workoutExerciseId]: saved }));
      } else {
        // 204: the note came back empty and the server deleted it. An older note may now be the
        // latest, and local state has no way of knowing which one — so this case asks.
        reloadLatestNotes();
      }
      closeNoteSheet();
    } catch {
      // The sheet stays open with the text intact: unlike the delete of spec 005, here the user
      // would lose what they typed (spec 006 §6.6).
      setActionError(t.notes.saveError);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!id || !noteSheet) return;
    setSavingNote(true);
    setActionError(null);
    try {
      await deleteExerciseNote(Number(id), noteSheet.exercise.id, noteSheet.date);
      reloadLatestNotes();
      closeNoteSheet();
    } catch {
      setActionError(t.notes.deleteError);
    } finally {
      setSavingNote(false);
    }
  };

  // Editable only when the note on screen is the one for the date being viewed — the "I saved it
  // and then noticed I typed 6 instead of 60" case. Older notes are read-only (spec 006 §6.5).
  const openNote = (exercise: WorkoutExercise, note: ExerciseNote) => {
    setConfirmingId(null);
    setNoteSheet({ exercise, date: note.date, initial: note, readOnly: note.date !== selectedDate });
  };

  const nextExercise = dayExercises.find((e) => !doneIds.has(e.id));

  return (
    <div className="app-shell">
      <TopBar title={workout?.nome ?? t.workoutView.fallbackTitle} back />

      <main className="container" onClick={() => setConfirmingId(null)}>
        {error && <ErrorBanner message={error} />}
        {actionError && <ErrorBanner message={actionError} />}

        {!workout && !error && (
          <div className="page-loading">
            <Spinner />
          </div>
        )}

        {workout && (
          <>
            <div className="day-tabs" role="tablist" aria-label={t.weekDays.picker}>
              {WEEK_DAYS.map((dia, i) => {
                const total = workout.exercises.filter((e) => e.dia === dia).length;
                const doneSet = doneByDate[weekDates[i]] ?? new Set<number>();
                const done = workout.exercises.filter((e) => e.dia === dia && doneSet.has(e.id)).length;
                const allDone = total > 0 && done === total;
                return (
                  <button
                    key={dia}
                    type="button"
                    role="tab"
                    aria-selected={selectedDay === dia}
                    className={`day-tab ${selectedDay === dia ? 'active' : ''}`}
                    onClick={() => setSelectedDay(dia)}
                  >
                    {t.weekDays.short[dia]}
                    {total > 0 && (
                      <span className={`day-tab-badge ${allDone ? 'all-done' : ''}`}>
                        {allDone ? '✓' : `${done}/${total}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <h2 className="day-title">{t.weekDays.full[selectedDay]}</h2>

            {dayExercises.length === 0 && (
              <EmptyState title={t.workoutView.emptyDayTitle} subtitle={t.workoutView.emptyDaySubtitle} />
            )}

            {dayExercises.length > 0 && (
              <ul className="exercise-list">
                {dayExercises.map((we) => {
                  const isDone = doneIds.has(we.id);
                  const isConfirming = confirmingId === we.id;
                  const isNext = !isDone && we.id === nextExercise?.id;
                  const note = latestNotes[we.id];

                  return (
                    <li
                      key={we.id}
                      className={[
                        'exercise-card',
                        we.exercise === null && 'custom',
                        isDone && 'done',
                        isNext && 'next',
                        isConfirming && 'confirming',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCardClick(we.id);
                      }}
                    >
                      {/* Hidden from assistive tech while the veil is up: the question is about
                          this card, and what is under the veil is not reachable (spec 006 §6.1). */}
                      <div className="exercise-card-body" aria-hidden={isConfirming}>
                        {isNext && <span className="exercise-card-badge">{t.workoutView.next}</span>}
                        <ExerciseCardInfo
                          exercise={we.exercise}
                          customName={we.customName}
                          series={we.series}
                          observacao={we.observacao}
                        />
                      </div>

                      {note && !isConfirming && (
                        <NoteChip note={note} onOpen={() => openNote(we, note)} />
                      )}

                      {/* A veil over the card, not a full-screen modal: the user has to keep
                          seeing which exercise is being asked about (spec 006 §6.1). */}
                      {isConfirming && (
                        <div className="exercise-card-veil">
                          <p className="veil-question">{t.workoutView.confirmQuestion}</p>
                          <div className="veil-actions">
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setConfirmingId(null)}
                            >
                              {t.common.no}
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleConfirm(we)}
                            >
                              {t.common.yes}
                            </button>
                          </div>
                        </div>
                      )}
                      {isDone && (
                        <span className="exercise-card-check" aria-label={t.common.done}>
                          ✓
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>

      {noteSheet && (
        <NoteSheet
          exerciseName={exerciseDisplayName(noteSheet.exercise)}
          series={noteSheet.exercise.series}
          initial={noteSheet.initial}
          readOnly={noteSheet.readOnly}
          saving={savingNote}
          onClose={closeNoteSheet}
          onSave={handleSaveNote}
          onDelete={noteSheet.initial ? handleDeleteNote : undefined}
        />
      )}

      {celebrating && <CelebrationModal onClose={() => setCelebrating(false)} />}
    </div>
  );
}
