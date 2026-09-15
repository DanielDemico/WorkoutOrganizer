import { useEffect, useMemo, useState } from 'react';
import { INTENSITY_COLORS, ViewSide, type BodyState } from 'body-muscles';
import { TopBar } from '../components/TopBar';
import { BodyHeatmap } from '../components/BodyHeatmap';
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback';
import { getMuscleUsage, type MuscleUsage } from '../api/muscles';
import { useI18n } from '../i18n';

// The intensity scale runs 1-10; 0 is the neutral "never trained" colour the library
// already paints for regions absent from bodyState, so the legend starts at 1.
const LEGEND_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function MuscleUsePage() {
  const [usage, setUsage] = useState<MuscleUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewSide>(ViewSide.FRONT);
  const [selectedMuscleId, setSelectedMuscleId] = useState<string | null>(null);
  const [selectedMuscleName, setSelectedMuscleName] = useState<string | null>(null);
  const { lang, t } = useI18n();

  const viewLabels: Record<ViewSide, string> = {
    [ViewSide.FRONT]: t.muscleUse.front,
    [ViewSide.BACK]: t.muscleUse.back,
  };

  useEffect(() => {
    let cancelled = false;

    getMuscleUsage()
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => {
        if (!cancelled) setError(t.muscleUse.loadError);
      });

    return () => {
      cancelled = true;
    };
    // The muscle labels come from term_i18n, so a language switch refetches (spec 004 §9.3).
  }, [lang, t]);

  // A brand new object every time: BodyChart ignores mutations of the previous one.
  const bodyState: BodyState = useMemo(() => {
    const state: BodyState = {};
    for (const muscle of usage?.muscles ?? []) {
      state[muscle.muscleId] = {
        intensity: muscle.intensity,
        selected: muscle.muscleId === selectedMuscleId,
      };
    }
    // A region the plan never reaches is absent above (the library draws it neutral), but it is
    // still clickable — give it an entry so the selection outline shows up anyway.
    if (selectedMuscleId && !state[selectedMuscleId]) {
      state[selectedMuscleId] = { intensity: 0, selected: true };
    }
    return state;
  }, [usage, selectedMuscleId]);

  const pointsByMuscleId = useMemo(() => {
    const map = new Map<string, number>();
    for (const muscle of usage?.muscles ?? []) map.set(muscle.muscleId, muscle.points);
    return map;
  }, [usage]);

  // Clicking a region narrows the ranked list to the terms that paint it.
  const breakdown = useMemo(() => {
    const all = usage?.breakdown ?? [];
    if (!selectedMuscleId) return all;
    return all.filter((row) => row.muscleIds.includes(selectedMuscleId));
  }, [usage, selectedMuscleId]);

  const maxBreakdownPoints = usage?.breakdown[0]?.points ?? 0;

  function handleMuscleClick(muscleId: string, name: string) {
    const isSame = muscleId === selectedMuscleId;
    setSelectedMuscleId(isSame ? null : muscleId);
    setSelectedMuscleName(isSame ? null : name);
  }

  function clearSelection() {
    setSelectedMuscleId(null);
    setSelectedMuscleName(null);
  }

  return (
    <div className="app-shell">
      <TopBar title={t.muscleUse.title} menu />

      <main className="container">
        {error && <ErrorBanner message={error} />}

        {!usage && !error && (
          <div className="page-loading">
            <Spinner />
          </div>
        )}

        {usage && usage.totalExercises === 0 && (
          <EmptyState title={t.muscleUse.emptyTitle} subtitle={t.muscleUse.emptySubtitle} />
        )}

        {usage && usage.totalExercises > 0 && (
          <>
            <div className="muscle-use-header">
              <div className="muscle-use-views" role="group" aria-label={t.muscleUse.viewGroup}>
                {[ViewSide.FRONT, ViewSide.BACK].map((side) => (
                  <button
                    key={side}
                    type="button"
                    className={`muscle-use-view-btn${view === side ? ' active' : ''}`}
                    aria-pressed={view === side}
                    onClick={() => setView(side)}
                  >
                    {viewLabels[side]}
                  </button>
                ))}
              </div>
              <span className="muscle-use-total">{t.muscleUse.exerciseCount(usage.totalExercises)}</span>
            </div>

            <div className="muscle-use-layout">
              <BodyHeatmap
                view={view}
                bodyState={bodyState}
                onMuscleClick={handleMuscleClick}
                ariaLabel={t.muscleUse.heatmapLabel(viewLabels[view])}
              />

              <section className="muscle-use-panel">
                <h2 className="muscle-use-panel-title">{t.muscleUse.panelTitle}</h2>

                {selectedMuscleId && (
                  <button
                    type="button"
                    className="muscle-use-filter-chip"
                    aria-label={t.muscleUse.clearFilter}
                    onClick={clearSelection}
                  >
                    <span>
                      {selectedMuscleName ?? selectedMuscleId}
                      {' · '}
                      {pointsByMuscleId.get(selectedMuscleId) ?? 0} pts
                    </span>
                    <span aria-hidden="true">✕</span>
                  </button>
                )}

                {breakdown.length === 0 ? (
                  <p className="muscle-use-subtitle">{t.muscleUse.noMuscleInRegion}</p>
                ) : (
                  <ul className="muscle-use-list">
                    {breakdown.map((row) => (
                      <li key={row.term} className="muscle-use-row">
                        <div className="muscle-use-row-header">
                          <span className="muscle-use-name">{row.label}</span>
                          <span className="muscle-use-count">{row.points}</span>
                        </div>
                        <div className="muscle-use-bar-track">
                          <div
                            className="muscle-use-bar-fill"
                            style={{
                              width: `${maxBreakdownPoints ? (row.points / maxBreakdownPoints) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="muscle-use-roles">
                          {t.muscleUse.roles(row.primaryCount, row.secondaryCount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* No absolute numbers on the legend: the scale is relative to this user's own
                hardest-worked muscle, which is always 10. */}
            <div className="muscle-use-legend">
              <span>{t.muscleUse.less}</span>
              <div className="muscle-use-legend-scale" aria-hidden="true">
                {LEGEND_LEVELS.map((level) => (
                  <span
                    key={level}
                    className="muscle-use-legend-step"
                    style={{ background: INTENSITY_COLORS[level] }}
                  />
                ))}
              </div>
              <span>{t.muscleUse.more}</span>
            </div>

            <p className="muscle-use-subtitle">{t.muscleUse.explanation}</p>

            {/* Terms with no anatomical region are surfaced instead of silently dropped. */}
            {usage.ignored.map((item) => (
              <p key={item.term} className="muscle-use-note">
                ⓘ {t.muscleUse.ignoredNote(item.exerciseCount, item.label)}
              </p>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
