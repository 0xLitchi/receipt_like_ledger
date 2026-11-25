export interface LiveRowTextSample {
  isTransfer: boolean;
  isNonDefaultLedger: boolean;
  memberName: string;
  categoryLabel: string;
  noteLabel: string;
  amountLabel: string;
}

export interface LiveColumnNaturalWidths {
  /** Available horizontal inner width of a row (container width minus row horizontal padding) */
  innerWidth: number;
  /** Natural max width required by col 1 (.who), including dot + inner gap + text; 0 if no non-transfer rows */
  wantWho: number;
  /** Natural max width required by col 2 (.cc) */
  wantCc: number;
  /** Natural max width required by col 3 (.pg) */
  wantPg: number;
  /** Reference width required by col 4 (.amt), typically the widest amount in the list */
  refAmt: number;
  /** Whether any visible row displays the .who column */
  hasWho: boolean;
}

export interface LiveColumnLayout {
  whoWidth: number;
  ccWidth: number;
  gap: number;
  hideWho: boolean;
}

export interface LiveColumnFontSpec {
  whoFontSize: string;
  whoFontFamily: string;
  whoDotWidth: number;
  whoInnerGap: number;
  ccFontSize: string;
  ccFontFamily: string;
  pgFontSize: string;
  pgFontFamily: string;
  amtFontSize: string;
  amtFontFamily: string;
  amtFontWeight: string;
}

/** Minimum comfortable width floor for Col 1 (.who) when squeezing on narrow screens */
const MIN_WHO_FLOOR = 54;
/** Minimum comfortable width floor for Col 2 (.cc) when squeezing on narrow screens */
const MIN_CC_FLOOR = 56;
/** Minimum guaranteed floor for Col 3 (.pg) when content actually needs space */
const MIN_PG_FLOOR = 56;
/** Target minimum share of available space protected for Col 3 (.pg) when long notes exist */
const PG_MIN_SHARE = 0.3;

export function pickLiveRowGap(innerWidth: number): number {
  if (innerWidth >= 460) return 10;
  if (innerWidth >= 340) return 8;
  return 6;
}

/**
 * Adaptive column width allocator for `.pt-live-row` (4 columns: who, cc, pg, amt).
 *
 * Strategy:
 * 1. If all visible rows are transfers (`hasWho === false`), collapse Col 1 completely.
 * 2. If `wantWho + wantCc + wantPg` fits inside the available space (after gaps & `refAmt`),
 *    give Col 1 and Col 2 their exact natural widths — zero truncation anywhere and no wasted
 *    fixed-width whitespace.
 * 3. When space is tighter than total natural width:
 *    - Reserve `targetPgMin = min(wantPg, max(56, 30% of available))` for Col 3 (.pg).
 *      Because it is capped at `wantPg`, short notes/ledger names never hoard unused space
 *      while Col 1 or Col 2 get truncated.
 *    - If Col 1 + Col 2 fit within the remaining budget, both still render untruncated.
 *    - Otherwise, allocate the remaining budget between Col 1 and Col 2 using floor-preserving
 *      water-filling: each column gets its minimum floor (capped at its actual need), and
 *      surplus is split evenly with overflow spilling to whichever column still needs more,
 *      so an extreme outlier in one column never starves the other.
 */
export function computeAdaptiveLiveColumns(input: LiveColumnNaturalWidths): LiveColumnLayout {
  const { innerWidth, wantWho, wantCc, wantPg, refAmt, hasWho } = input;
  const gap = pickLiveRowGap(innerWidth);
  const hideWho = !hasWho || wantWho <= 0;
  const wantWhoClamped = hideWho ? 0 : Math.ceil(Math.max(0, wantWho));
  const wantCcClamped = Math.ceil(Math.max(0, wantCc));
  const wantPgClamped = Math.ceil(Math.max(0, wantPg));

  if (innerWidth <= 0) {
    return {
      whoWidth: wantWhoClamped,
      ccWidth: wantCcClamped,
      gap,
      hideWho,
    };
  }

  const gapCount = hideWho ? 2 : 3;
  const rawAvail = Math.max(0, Math.floor(innerWidth - gap * gapCount - Math.max(0, refAmt)));

  // Case 1: Everything fits comfortably with zero truncation
  if (wantWhoClamped + wantCcClamped + wantPgClamped <= rawAvail) {
    return {
      whoWidth: wantWhoClamped,
      ccWidth: wantCcClamped,
      gap,
      hideWho,
    };
  }

  // Case 2: Tight space — protect a fair floor for Col 3, never exceeding what Col 3 actually needs
  const pgFloor = Math.max(MIN_PG_FLOOR, Math.round(rawAvail * PG_MIN_SHARE));
  const targetPgMin = Math.min(wantPgClamped, pgFloor);
  const leftBudget = Math.max(0, rawAvail - targetPgMin);

  if (wantWhoClamped + wantCcClamped <= leftBudget) {
    return {
      whoWidth: wantWhoClamped,
      ccWidth: wantCcClamped,
      gap,
      hideWho,
    };
  }

  if (hideWho) {
    return {
      whoWidth: 0,
      ccWidth: Math.min(wantCcClamped, leftBudget),
      gap,
      hideWho: true,
    };
  }

  // Case 3: Both Col 1 and Col 2 compete for `leftBudget` — floor-preserving water-filling
  const minWho = Math.min(wantWhoClamped, MIN_WHO_FLOOR);
  const minCc = Math.min(wantCcClamped, MIN_CC_FLOOR);
  const minSum = minWho + minCc;

  if (minSum >= leftBudget) {
    if (minSum === 0) {
      return { whoWidth: 0, ccWidth: 0, gap, hideWho: false };
    }
    const whoWidth = Math.floor((leftBudget * minWho) / minSum);
    return {
      whoWidth,
      ccWidth: Math.max(0, leftBudget - whoWidth),
      gap,
      hideWho: false,
    };
  }

  const surplus = leftBudget - minSum;
  const extraWho = Math.max(0, wantWhoClamped - minWho);
  const extraCc = Math.max(0, wantCcClamped - minCc);
  const half = Math.floor(surplus / 2);

  let addWho = Math.min(extraWho, half);
  let addCc = Math.min(extraCc, surplus - half);
  const rem = surplus - addWho - addCc;

  if (rem > 0) {
    const moreWho = Math.min(extraWho - addWho, rem);
    addWho += moreWho;
    const moreCc = Math.min(extraCc - addCc, rem - moreWho);
    addCc += moreCc;
  }

  return {
    whoWidth: minWho + addWho,
    ccWidth: minCc + addCc,
    gap,
    hideWho: false,
  };
}

let cachedCanvasCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (cachedCanvasCtx !== undefined) return cachedCanvasCtx;
  if (typeof document === 'undefined') {
    cachedCanvasCtx = null;
    return null;
  }
  const canvas = document.createElement('canvas');
  cachedCanvasCtx = canvas.getContext('2d');
  return cachedCanvasCtx;
}

function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  font: string,
  text: string,
  safetyPx: number
): number {
  if (!text) return 0;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const bboxWidth =
    typeof metrics.actualBoundingBoxLeft === 'number' &&
    typeof metrics.actualBoundingBoxRight === 'number'
      ? Math.abs(metrics.actualBoundingBoxLeft) + Math.abs(metrics.actualBoundingBoxRight)
      : 0;
  return Math.ceil(Math.max(metrics.width, bboxWidth)) + safetyPx;
}

/**
 * Measure natural pixel widths across all visible rows using Canvas 2D with the live computed
 * font specs. Deduplicates identical `(text, italic)` entries to stay sub-millisecond even for
 * hundreds of rows.
 */
export function measureLiveNaturalWidths(
  samples: readonly LiveRowTextSample[],
  spec: LiveColumnFontSpec
): Omit<LiveColumnNaturalWidths, 'innerWidth'> | null {
  const ctx = getMeasureContext();
  if (!ctx) return null;

  let hasWho = false;
  let wantWho = 0;
  let wantCc = 0;
  let wantPg = 0;
  let refAmt = 0;

  const seenWho = new Set<string>();
  const seenCc = new Set<string>();
  const seenPg = new Set<string>();
  const seenAmt = new Set<string>();

  const whoNormalFont = `${spec.whoFontSize} ${spec.whoFontFamily}`;
  const whoItalicFont = `italic ${spec.whoFontSize} ${spec.whoFontFamily}`;
  const ccNormalFont = `${spec.ccFontSize} ${spec.ccFontFamily}`;
  const ccItalicFont = `italic ${spec.ccFontSize} ${spec.ccFontFamily}`;
  const pgNormalFont = `${spec.pgFontSize} ${spec.pgFontFamily}`;
  const pgItalicFont = `italic ${spec.pgFontSize} ${spec.pgFontFamily}`;
  const amtNormalFont = `${spec.amtFontWeight} ${spec.amtFontSize} ${spec.amtFontFamily}`;
  const amtItalicFont = `italic ${spec.amtFontWeight} ${spec.amtFontSize} ${spec.amtFontFamily}`;

  const whoChrome = spec.whoDotWidth + spec.whoInnerGap;

  for (const s of samples) {
    const italicRow = s.isNonDefaultLedger;

    if (!s.isTransfer) {
      hasWho = true;
      const key = `${italicRow ? '1' : '0'}:${s.memberName}`;
      if (!seenWho.has(key)) {
        seenWho.add(key);
        const w =
          whoChrome +
          measureTextWidth(
            ctx,
            italicRow ? whoItalicFont : whoNormalFont,
            s.memberName,
            italicRow ? 4 : 2
          );
        if (w > wantWho) wantWho = w;
      }
    }

    {
      const key = `${italicRow ? '1' : '0'}:${s.categoryLabel}`;
      if (!seenCc.has(key)) {
        seenCc.add(key);
        const w = measureTextWidth(
          ctx,
          italicRow ? ccItalicFont : ccNormalFont,
          s.categoryLabel,
          italicRow ? 4 : 2
        );
        if (w > wantCc) wantCc = w;
      }
    }

    if (s.noteLabel) {
      const italicPg = italicRow || s.isTransfer;
      const key = `${italicPg ? '1' : '0'}:${s.noteLabel}`;
      if (!seenPg.has(key)) {
        seenPg.add(key);
        const w = measureTextWidth(
          ctx,
          italicPg ? pgItalicFont : pgNormalFont,
          s.noteLabel,
          italicPg ? 4 : 2
        );
        if (w > wantPg) wantPg = w;
      }
    }

    if (s.amountLabel) {
      const key = `${italicRow ? '1' : '0'}:${s.amountLabel}`;
      if (!seenAmt.has(key)) {
        seenAmt.add(key);
        const w = measureTextWidth(
          ctx,
          italicRow ? amtItalicFont : amtNormalFont,
          s.amountLabel,
          italicRow ? 6 : 4
        );
        if (w > refAmt) refAmt = w;
      }
    }
  }

  return { wantWho, wantCc, wantPg, refAmt, hasWho };
}
