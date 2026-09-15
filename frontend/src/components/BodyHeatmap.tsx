import { useEffect, useRef } from 'react';
import { BodyChart, ViewSide, type BodyState } from 'body-muscles';

interface BodyHeatmapProps {
  view: ViewSide;
  /** Must be a new object whenever it changes — BodyChart does not detect mutation. */
  bodyState: BodyState;
  onMuscleClick?: (muscleId: string, name: string) => void;
  ariaLabel?: string;
}

/**
 * React wrapper around `BodyChart`, which is an imperative class that drives the DOM itself.
 * The chart is built once and then patched via `update()`; the click handler lives in a ref so
 * a new callback identity never forces a rebuild of the SVG.
 */
export function BodyHeatmap({ view, bodyState, onMuscleClick, ariaLabel }: BodyHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<BodyChart | null>(null);
  const clickRef = useRef(onMuscleClick);
  clickRef.current = onMuscleClick;

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = new BodyChart(containerRef.current, {
      view,
      bodyState,
      ariaLabel,
      onMuscleClick: (id, name) => clickRef.current?.(id, name),
    });
    chartRef.current = chart;

    // Mandatory: the SPA unmounts this page on every navigation away from /muscle-use,
    // and without destroy() the chart's listeners leak once per visit.
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
    // Built once on mount; view/bodyState changes go through update() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chartRef.current?.update({ view, bodyState });
  }, [view, bodyState]);

  return <div ref={containerRef} className="body-heatmap" />;
}
