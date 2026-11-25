import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  computeAdaptiveLiveColumns,
  measureLiveNaturalWidths,
  type LiveColumnFontSpec,
  type LiveColumnNaturalWidths,
  type LiveRowTextSample,
} from './live-columns';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function readFontSpecAndPadding(container: HTMLElement): {
  spec: LiveColumnFontSpec;
  paddingX: number;
} {
  const firstRow = container.querySelector<HTMLElement>('.pt-live-row');
  const rowStyle = firstRow ? getComputedStyle(firstRow) : getComputedStyle(container);
  const paddingX = firstRow
    ? (parseFloat(rowStyle.paddingLeft) || 0) + (parseFloat(rowStyle.paddingRight) || 0)
    : 24;

  const whoEl = firstRow?.querySelector<HTMLElement>('.who') ?? null;
  const ccEl = firstRow?.querySelector<HTMLElement>('.cc') ?? null;
  const pgEl = firstRow?.querySelector<HTMLElement>('.pg') ?? null;
  const amtEl = firstRow?.querySelector<HTMLElement>('.amt') ?? null;
  const dotEl = container.querySelector<Element>('.pt-dot');

  const whoStyle = whoEl ? getComputedStyle(whoEl) : rowStyle;
  const ccStyle = ccEl ? getComputedStyle(ccEl) : rowStyle;
  const pgStyle = pgEl ? getComputedStyle(pgEl) : rowStyle;
  const amtStyle = amtEl ? getComputedStyle(amtEl) : rowStyle;
  const dotWidth = dotEl ? parseFloat(getComputedStyle(dotEl).width) || 12 : 12;

  const whoInnerGap =
    parseFloat(whoStyle.columnGap) || parseFloat(whoStyle.gap) || 5;

  return {
    paddingX,
    spec: {
      whoFontSize: whoStyle.fontSize || '12px',
      whoFontFamily: whoStyle.fontFamily || 'sans-serif',
      whoDotWidth: dotWidth,
      whoInnerGap,
      ccFontSize: ccStyle.fontSize || '11px',
      ccFontFamily: ccStyle.fontFamily || 'monospace',
      pgFontSize: pgStyle.fontSize || '11px',
      pgFontFamily: pgStyle.fontFamily || whoStyle.fontFamily || 'sans-serif',
      amtFontSize: amtStyle.fontSize || '12px',
      amtFontFamily: amtStyle.fontFamily || ccStyle.fontFamily || 'monospace',
      amtFontWeight: amtStyle.fontWeight || 'bold',
    },
  };
}

/**
 * Dynamically measures visible transaction rows and sets `--col-who`, `--col-cc`, and
 * `--live-gap` CSS custom properties on the `.pt-live-list` container.
 * Recomputes automatically on data changes, container resize, and web font load completion.
 */
export function useLiveColumnWidths(
  containerRef: React.RefObject<HTMLDivElement | null>,
  samples: readonly LiveRowTextSample[]
): { hideWho: boolean } {
  const [fontEpoch, setFontEpoch] = useState(0);
  const naturalRef = useRef<Omit<LiveColumnNaturalWidths, 'innerWidth'> | null>(null);
  const hideWho = samples.length > 0 && samples.every((s) => s.isTransfer);

  // Re-measure once web fonts (e.g. Fusion Pixel woff2) finish loading
  useEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) return;
    let active = true;
    const bump = () => {
      if (active) setFontEpoch((n) => n + 1);
    };

    void document.fonts.ready.then(bump);
    document.fonts.addEventListener?.('loadingdone', bump);
    return () => {
      active = false;
      document.fonts.removeEventListener?.('loadingdone', bump);
    };
  }, []);

  // Apply adaptive CSS variables before paint whenever rows or fonts change
  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || samples.length === 0) {
      naturalRef.current = null;
      return;
    }

    const { spec, paddingX } = readFontSpecAndPadding(el);
    const natural = measureLiveNaturalWidths(samples, spec);
    naturalRef.current = natural;
    if (!natural) return;

    const innerWidth = Math.max(0, el.clientWidth - paddingX);
    const layout = computeAdaptiveLiveColumns({ innerWidth, ...natural });

    el.style.setProperty('--col-who', `${layout.whoWidth}px`);
    el.style.setProperty('--col-cc', `${layout.ccWidth}px`);
    el.style.setProperty('--live-gap', `${layout.gap}px`);
  }, [containerRef, samples, fontEpoch]);

  // Re-allocate column widths smoothly on container resize without re-measuring text
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      const natural = naturalRef.current;
      if (!natural) return;
      const firstRow = el.querySelector<HTMLElement>('.pt-live-row');
      const paddingX = firstRow
        ? (parseFloat(getComputedStyle(firstRow).paddingLeft) || 0) +
          (parseFloat(getComputedStyle(firstRow).paddingRight) || 0)
        : 24;
      const innerWidth = Math.max(0, el.clientWidth - paddingX);
      const layout = computeAdaptiveLiveColumns({ innerWidth, ...natural });

      el.style.setProperty('--col-who', `${layout.whoWidth}px`);
      el.style.setProperty('--col-cc', `${layout.ccWidth}px`);
      el.style.setProperty('--live-gap', `${layout.gap}px`);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  return { hideWho };
}
