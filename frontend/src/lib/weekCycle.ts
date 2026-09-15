// Implements specs/0001-ciclo-semanal/spec.md: the week is a date window computed on the fly
// from "today", not a stored state that needs to be reset. Sunday is day 0, matching
// Date#getDay() and WEEK_DAYS in types.ts, so weekDates[i] always lines up with WEEK_DAYS[i].

export function getWeekStart(refDate: Date = new Date()): Date {
  const d = new Date(refDate);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

// Local calendar date, not UTC — toISOString() would shift the day near midnight in
// timezones ahead of UTC.
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return formatDateKey(d);
  });
}

export function msUntilNextMidnight(from: Date = new Date()): number {
  const next = new Date(from);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - from.getTime();
}
