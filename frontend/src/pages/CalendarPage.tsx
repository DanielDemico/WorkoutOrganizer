import { useEffect, useMemo, useState } from 'react';
import { WEEK_DAYS, type WeekDay } from '../types';
import { useI18n } from '../i18n';
import { getMonthCalendar, getWorkoutCompletions, type CalendarDay } from '../api/completions';
import { TopBar } from '../components/TopBar';
import { ExerciseCardInfo } from '../components/ExerciseCardInfo';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { useAllWorkoutExercises } from '../hooks/useAllWorkoutExercises';
import { formatDateKey } from '../lib/weekCycle';

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const todayKey = formatDateKey(today);

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(today));
  const [calendarDays, setCalendarDays] = useState<CalendarDay[] | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey);
  const { t } = useI18n();

  const { exercises, error: exercisesError } = useAllWorkoutExercises();

  useEffect(() => {
    let cancelled = false;
    setCalendarDays(null);
    setCalendarError(null);

    getMonthCalendar(monthCursor.getFullYear(), monthCursor.getMonth() + 1)
      .then((days) => {
        if (!cancelled) setCalendarDays(days);
      })
      .catch(() => {
        if (!cancelled) setCalendarError(t.calendar.loadError);
      });

    return () => {
      cancelled = true;
    };
  }, [monthCursor, t]);

  const calendarByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of calendarDays ?? []) map.set(day.date, day);
    return map;
  }, [calendarDays]);

  const selectedWeekDay: WeekDay | null = selectedDate
    ? WEEK_DAYS[new Date(`${selectedDate}T00:00:00`).getDay()]
    : null;

  const selectedDayExercises = useMemo(
    () => (exercises ?? []).filter((e) => e.dia === selectedWeekDay).sort((a, b) => a.ordem - b.ordem),
    [exercises, selectedWeekDay],
  );

  const [selectedDone, setSelectedDone] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!selectedDate || !selectedWeekDay) {
      setSelectedDone(new Set());
      return;
    }
    const dayExercises = (exercises ?? []).filter((e) => e.dia === selectedWeekDay);
    if (dayExercises.length === 0) {
      setSelectedDone(new Set());
      return;
    }

    let cancelled = false;
    const workoutIds = [...new Set(dayExercises.map((e) => e.workoutId))];

    Promise.all(workoutIds.map((workoutId) => getWorkoutCompletions(workoutId, selectedDate, selectedDate)))
      .then((results) => {
        if (cancelled) return;
        setSelectedDone(new Set(results.flat().map((c) => c.workoutExerciseId)));
      })
      .catch(() => {
        if (!cancelled) setSelectedDone(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, exercises, selectedWeekDay]);

  const weeks = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = new Date(year, month, 1).getDay(); // 0 = domingo, matches WEEK_DAYS order

    const cells: (string | null)[] = [...Array(leadingBlanks).fill(null)];
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(formatDateKey(new Date(year, month, day)));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [monthCursor]);

  return (
    <div className="app-shell">
      <TopBar title={t.calendar.title} menu />

      <main className="container">
        {calendarError && <ErrorBanner message={calendarError} />}
        {exercisesError && <ErrorBanner message={exercisesError} />}

        <div className="calendar-month-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label={t.calendar.previousMonth}
            onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          >
            ‹
          </button>
          <span className="calendar-month-label">
            {t.months[monthCursor.getMonth()]} {monthCursor.getFullYear()}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t.calendar.nextMonth}
            onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          >
            ›
          </button>
        </div>

        {!calendarDays && !calendarError && (
          <div className="page-loading">
            <Spinner />
          </div>
        )}

        {calendarDays && (
          <>
            <div className="calendar-grid">
              {WEEK_DAYS.map((dia) => (
                <span key={dia} className="calendar-weekday-label">
                  {t.weekDays.short[dia]}
                </span>
              ))}

              {weeks.flatMap((row, ri) =>
                row.map((date, ci) => {
                  if (!date) return <span key={`${ri}-${ci}`} className="calendar-cell empty" />;

                  const info = calendarByDate.get(date);
                  const dayNumber = Number(date.slice(-2));
                  const classes = [
                    'calendar-cell',
                    date === todayKey && 'today',
                    info?.completo && 'completed',
                    info && !info.completo && 'scheduled',
                    date === selectedDate && 'selected',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <button
                      key={date}
                      type="button"
                      className={classes}
                      onClick={() => setSelectedDate(date)}
                    >
                      {dayNumber}
                    </button>
                  );
                }),
              )}
            </div>

            <div className="calendar-legend">
              <span className="calendar-legend-item">
                <span className="calendar-legend-dot completed" /> {t.calendar.legendCompleted}
              </span>
              <span className="calendar-legend-item">
                <span className="calendar-legend-dot scheduled" /> {t.calendar.legendScheduled}
              </span>
            </div>
          </>
        )}

        {selectedDate && selectedWeekDay && (
          <>
            <h2 className="day-title">{t.weekDays.full[selectedWeekDay]}</h2>

            {selectedDayExercises.length === 0 && (
              <EmptyState title={t.calendar.emptyTitle} subtitle={t.calendar.emptySubtitle} />
            )}

            {selectedDayExercises.length > 0 && (
              <ul className="exercise-list">
                {selectedDayExercises.map((we) => (
                  <li
                    key={we.id}
                    className={['exercise-card', we.exercise === null && 'custom', selectedDone.has(we.id) && 'done']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="exercise-card-source">{we.workoutNome}</span>
                    <ExerciseCardInfo
                      exercise={we.exercise}
                      customName={we.customName}
                      series={we.series}
                      observacao={we.observacao}
                    />
                    {selectedDone.has(we.id) && (
                      <span className="exercise-card-check" aria-label={t.common.done}>
                        ✓
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
