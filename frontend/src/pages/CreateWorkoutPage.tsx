import { useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  createWorkout,
  addExerciseToWorkout,
  updateWorkoutExercise,
  deleteWorkoutExercise,
  reorderWorkoutExercises,
} from '../api/workouts';
import { ApiError } from '../api/client';
import {
  WEEK_DAYS,
  type WeekDay,
  type WorkoutExercise,
  type WorkoutImportResponse,
  type Exercise,
} from '../types';
import { useI18n } from '../i18n';
import { TopBar } from '../components/TopBar';
import { ExerciseCardInfo } from '../components/ExerciseCardInfo';
import { ExercisePicker } from '../components/ExercisePicker';
import { ExerciseDetailModal, type ExerciseDraft } from '../components/ExerciseDetailModal';
import { CustomExerciseSheet } from '../components/CustomExerciseSheet';
import { DocumentUploadDropzone } from '../components/DocumentUploadDropzone';
import { EmptyState, ErrorBanner } from '../components/Feedback';

// What the edit flow is holding while its sheets are open (spec 0011 §6.3). `exercise` is the
// catalog item the detail modal shows — the row's own one until "Trocar exercício" replaces it;
// null while the row is a custom-named one. `draft` carries typed series/observação across the
// custom → catalog transition, where the sheet is remounted.
interface EditState {
  row: WorkoutExercise;
  exercise: Exercise | null;
  draft: ExerciseDraft;
}

interface DragState {
  id: number;
  before: number[];
  // Latest order, kept beside the state so pointerup reads it even if no render ran since
  // the last move.
  order: number[];
}

const sameOrder = (a: number[], b: number[]) => a.length === b.length && a.every((id, i) => id === b[i]);

export default function CreateWorkoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const isImportInitial = new URLSearchParams(location.search).get('import') === 'true';
  const [creationMode, setCreationMode] = useState<'manual' | 'import'>(isImportInitial ? 'import' : 'manual');

  const [nome, setNome] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [workoutNome, setWorkoutNome] = useState('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [degradedReason, setDegradedReason] = useState<string | null>(null);
  // How many rows the import kept under the sheet's own name because the catalog had no
  // match. Counted once, at import time: it is a notice about what just happened, not a
  // live property of the list (spec 0010 §6.3).
  const [importedCustomCount, setImportedCustomCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<WeekDay>('segunda');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  // Which flow the picker is serving: a new row, or the swap inside an edit.
  const [pickerFor, setPickerFor] = useState<'add' | 'swap' | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  // Drag: the day's ids in the order on screen while a finger is down. Rendering sorts by it
  // instead of by `ordem`, so the list rearranges live and snaps back on failure by simply
  // dropping it (spec 0011 §6.4).
  const [dragOrder, setDragOrder] = useState<number[] | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const handleCreateWorkout = async () => {
    if (!nome.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const workout = await createWorkout(nome.trim());
      setWorkoutId(workout.workoutId);
      setWorkoutNome(workout.nome);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : t.createWorkout.createError);
    } finally {
      setCreating(false);
    }
  };

  const handleImportSuccess = (result: WorkoutImportResponse) => {
    setWorkoutId(result.workoutId);
    setWorkoutNome(result.nome);
    setExercises(result.exercises);
    setDegradedReason(result.degradedReason ?? null);
    setImportedCustomCount(result.exercises.filter((e) => e.exercise === null).length);

    const firstActiveDay = WEEK_DAYS.find((d) => result.exercises.some((e) => e.dia === d));
    if (firstActiveDay) {
      setSelectedDay(firstActiveDay);
    }
  };

  const handleConfirmAdd = async (series: string | undefined, observacao: string) => {
    if (!workoutId || !selectedExercise) return;
    const added = await addExerciseToWorkout(workoutId, {
      exerciseId: selectedExercise.id,
      dia: selectedDay,
      series,
      observacao: observacao || undefined,
    });
    setExercises((prev) => [...prev, added]);
    setSelectedExercise(null);
  };

  // ---- edit (spec 0011 §6.3)

  const startEdit = (row: WorkoutExercise) => {
    setEditing({
      row,
      exercise: row.exercise,
      draft: { series: row.series ?? undefined, observacao: row.observacao ?? '' },
    });
  };

  const replaceRow = (updated: WorkoutExercise) =>
    setExercises((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));

  const handleConfirmEditCatalog = async (series: string | undefined, observacao: string) => {
    if (!workoutId || !editing?.exercise) return;
    const updated = await updateWorkoutExercise(workoutId, editing.row.id, {
      exerciseId: editing.exercise.id,
      series,
      observacao: observacao || undefined,
    });
    replaceRow(updated);
    setEditing(null);
  };

  const handleConfirmEditCustom = async (customName: string, series: string | undefined, observacao: string) => {
    if (!workoutId || !editing) return;
    const updated = await updateWorkoutExercise(workoutId, editing.row.id, {
      customName,
      series,
      observacao: observacao || undefined,
    });
    replaceRow(updated);
    setEditing(null);
  };

  // "Trocar exercício": keep what was typed, open the picker on top of the sheet.
  const handleSwapRequest = (draft: ExerciseDraft) => {
    setEditing((prev) => (prev ? { ...prev, draft } : prev));
    setPickerFor('swap');
  };

  // ---- delete (spec 0011 §6.2)

  const handleDelete = async (row: WorkoutExercise) => {
    if (!workoutId) return;
    setActionError(null);
    try {
      await deleteWorkoutExercise(workoutId, row.id);
      // Mirror the server's renumbering so the next drag sends the right permutation.
      setExercises((prev) => {
        const rest = prev.filter((e) => e.id !== row.id);
        const day = rest.filter((e) => e.dia === row.dia).sort((a, b) => a.ordem - b.ordem);
        const ordemById = new Map(day.map((e, i) => [e.id, i + 1]));
        return rest.map((e) => (ordemById.has(e.id) ? { ...e, ordem: ordemById.get(e.id)! } : e));
      });
    } catch {
      setActionError(t.createWorkout.deleteError);
    }
  };

  // ---- reorder (spec 0011 §6.4)

  const persistOrder = async (ids: number[]) => {
    if (!workoutId) return;
    setActionError(null);
    try {
      const result = await reorderWorkoutExercises(workoutId, selectedDay, ids);
      const ordemById = new Map(result.map((r) => [r.workoutExerciseId, r.ordem]));
      setExercises((prev) => prev.map((e) => (ordemById.has(e.id) ? { ...e, ordem: ordemById.get(e.id)! } : e)));
    } catch {
      setActionError(t.createWorkout.reorderError);
    }
  };

  const dayExercises = useMemo(() => {
    const list = exercises.filter((e) => e.dia === selectedDay).sort((a, b) => a.ordem - b.ordem);
    if (dragOrder) list.sort((a, b) => dragOrder.indexOf(a.id) - dragOrder.indexOf(b.id));
    return list;
  }, [exercises, selectedDay, dragOrder]);

  const handleDragStart = (event: React.PointerEvent<HTMLButtonElement>, row: WorkoutExercise) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const before = dayExercises.map((e) => e.id);
    dragRef.current = { id: row.id, before, order: before };
    setDragId(row.id);
    setDragOrder(before);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || !listRef.current) return;

    // The dragged card lands after every other card whose midpoint the pointer has passed.
    let target = 0;
    const others: number[] = [];
    for (const li of listRef.current.querySelectorAll<HTMLLIElement>('li[data-id]')) {
      const id = Number(li.dataset.id);
      if (id === drag.id) continue;
      others.push(id);
      const rect = li.getBoundingClientRect();
      if (event.clientY > rect.top + rect.height / 2) target++;
    }
    const next = [...others.slice(0, target), drag.id, ...others.slice(target)];
    if (sameOrder(drag.order, next)) return;
    drag.order = next;
    setDragOrder(next);
  };

  const handleDragEnd = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    setDragOrder(null);
    setDragId(null);
    if (!sameOrder(drag.order, drag.before)) {
      void persistOrder(drag.order);
    }
  };

  const moveBy = (row: WorkoutExercise, delta: -1 | 1) => {
    const ids = dayExercises.map((e) => e.id);
    const from = ids.indexOf(row.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void persistOrder(ids);
  };

  // Step 1: choosing between manual name setup or document import
  if (!workoutId) {
    return (
      <div className="app-shell">
        <TopBar title={t.createWorkout.title} back />
        <main className="container">
          <div className="create-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={creationMode === 'manual'}
              className={`create-mode-tab ${creationMode === 'manual' ? 'active' : ''}`}
              onClick={() => setCreationMode('manual')}
            >
              ✍️ {t.createWorkout.tabManual}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={creationMode === 'import'}
              className={`create-mode-tab ${creationMode === 'import' ? 'active' : ''}`}
              onClick={() => setCreationMode('import')}
            >
              ✨ {t.createWorkout.tabImport}
            </button>
          </div>

          {creationMode === 'manual' && (
            <div className="manual-create-section">
              <label className="field">
                <span>{t.createWorkout.nameLabel}</span>
                <input
                  className="input"
                  type="text"
                  placeholder={t.createWorkout.namePlaceholder}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoFocus
                />
              </label>

              {createError && <p className="field-error">{createError}</p>}

              <button
                type="button"
                className="btn btn-primary"
                disabled={!nome.trim() || creating}
                onClick={handleCreateWorkout}
              >
                {creating ? t.createWorkout.creating : t.createWorkout.submit}
              </button>
            </div>
          )}

          {creationMode === 'import' && (
            <DocumentUploadDropzone onSuccess={handleImportSuccess} />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopBar
        title={workoutNome}
        action={
          <button type="button" className="btn btn-small btn-primary" onClick={() => navigate(`/treino/${workoutId}`)}>
            {t.createWorkout.finish}
          </button>
        }
      />

      <main className="container">
        <div className="day-tabs" role="tablist" aria-label={t.weekDays.picker}>
          {WEEK_DAYS.map((dia) => {
            const count = exercises.filter((e) => e.dia === dia).length;
            const customCount = exercises.filter((e) => e.dia === dia && e.exercise === null).length;
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
                {count > 0 && (
                  <span className={`day-tab-badge ${customCount > 0 ? 'badge-warning' : ''}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <h2 className="day-title">{t.weekDays.full[selectedDay]}</h2>

        {actionError && <ErrorBanner message={actionError} />}

        {degradedReason && (
          <p className="import-degraded-banner" role="status">
            <span aria-hidden="true">⚠️</span> {t.createWorkout.importDegradedNotice}
          </p>
        )}

        {importedCustomCount > 0 && (
          <p className="import-custom-banner" role="status">
            <span aria-hidden="true">⚠️</span> {t.createWorkout.importCustomNotice(importedCustomCount)}
          </p>
        )}

        {dayExercises.length === 0 && (
          <EmptyState title={t.createWorkout.emptyDayTitle} subtitle={t.createWorkout.emptyDaySubtitle} />
        )}

        {dayExercises.length > 0 && (
          <ul className="exercise-list" ref={listRef}>
            {dayExercises.map((we) => (
              <li
                key={we.id}
                data-id={we.id}
                className={[
                  'exercise-card',
                  'exercise-card-editable',
                  we.exercise === null && 'custom',
                  dragId === we.id && 'dragging',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {/* Controls belong to the creation card, not to ExerciseCardInfo: the day view
                    and the calendar keep the plain card (spec 0011 §6.1). */}
                <div className="exercise-card-toolbar">
                  <button
                    type="button"
                    className="icon-btn drag-handle"
                    aria-label={t.createWorkout.dragHandle}
                    title={t.createWorkout.dragHandle}
                    onPointerDown={(e) => handleDragStart(e, we)}
                    onPointerMove={handleDragMove}
                    onPointerUp={handleDragEnd}
                    onPointerCancel={handleDragEnd}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        moveBy(we, -1);
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        moveBy(we, 1);
                      }
                    }}
                  >
                    ⠿
                  </button>
                  <span className="exercise-card-toolbar-spacer" />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t.createWorkout.editExercise}
                    title={t.createWorkout.editExercise}
                    onClick={() => startEdit(we)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    aria-label={t.createWorkout.deleteExercise}
                    title={t.createWorkout.deleteExercise}
                    onClick={() => handleDelete(we)}
                  >
                    🗑
                  </button>
                </div>
                <ExerciseCardInfo
                  exercise={we.exercise}
                  customName={we.customName}
                  series={we.series}
                  observacao={we.observacao}
                />
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-add-exercise"
          onClick={() => setPickerFor('add')}
        >
          {t.createWorkout.addExercise}
        </button>
      </main>

      {/* Add flow */}
      {selectedExercise && (
        <ExerciseDetailModal
          exercise={selectedExercise}
          onClose={() => setSelectedExercise(null)}
          onConfirm={handleConfirmAdd}
        />
      )}

      {/* Edit flow: the modal stays mounted under the picker while swapping, so what was typed
          survives — only the custom → catalog transition remounts, and `draft` covers that. */}
      {editing && editing.exercise && (
        <ExerciseDetailModal
          exercise={editing.exercise}
          initialSeries={editing.draft.series}
          initialObservacao={editing.draft.observacao}
          confirmLabel={t.exerciseDetail.save}
          errorLabel={t.exerciseDetail.saveError}
          onSwap={handleSwapRequest}
          onClose={() => setEditing(null)}
          onConfirm={handleConfirmEditCatalog}
        />
      )}

      {editing && !editing.exercise && (
        <CustomExerciseSheet
          initialName={editing.row.customName ?? ''}
          initialSeries={editing.draft.series}
          initialObservacao={editing.draft.observacao}
          onSwap={handleSwapRequest}
          onClose={() => setEditing(null)}
          onConfirm={handleConfirmEditCustom}
        />
      )}

      {pickerFor && (
        <ExercisePicker
          dayLabel={t.weekDays.full[selectedDay]}
          onClose={() => setPickerFor(null)}
          onSelect={(exercise) => {
            if (pickerFor === 'swap') {
              setEditing((prev) => (prev ? { ...prev, exercise } : prev));
            } else {
              setSelectedExercise(exercise);
            }
            setPickerFor(null);
          }}
        />
      )}
    </div>
  );
}
