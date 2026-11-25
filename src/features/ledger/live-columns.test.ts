import { describe, expect, it } from 'vitest';
import { computeAdaptiveLiveColumns, pickLiveRowGap } from './live-columns';

describe('pickLiveRowGap', () => {
  it('scales gap cleanly with container inner width', () => {
    expect(pickLiveRowGap(600)).toBe(10);
    expect(pickLiveRowGap(460)).toBe(10);
    expect(pickLiveRowGap(400)).toBe(8);
    expect(pickLiveRowGap(340)).toBe(8);
    expect(pickLiveRowGap(310)).toBe(6);
  });
});

describe('computeAdaptiveLiveColumns', () => {
  it('gives Col 1 and Col 2 full natural width when Col 3 has ample spare room (screenshot case)', () => {
    // e.g. narrow desktop/tablet: innerW=350, "荔枝, 扶正" wants 82px, "餐饮/早餐" wants 58px,
    // notes like "货币基金收益" want 74px, max amount "+2,100.00" is 66px
    const layout = computeAdaptiveLiveColumns({
      innerWidth: 350,
      wantWho: 82,
      wantCc: 58,
      wantPg: 74,
      refAmt: 66,
      hasWho: true,
    });

    expect(layout.hideWho).toBe(false);
    expect(layout.gap).toBe(8);
    expect(layout.whoWidth).toBe(82);
    expect(layout.ccWidth).toBe(58);
  });

  it('shrinks Col 1 and Col 2 tightly to content on wide screens instead of leaving dead space', () => {
    const layout = computeAdaptiveLiveColumns({
      innerWidth: 640,
      wantWho: 44, // short 2-char member name
      wantCc: 58,
      wantPg: 120,
      refAmt: 70,
      hasWho: true,
    });

    expect(layout.gap).toBe(10);
    expect(layout.whoWidth).toBe(44);
    expect(layout.ccWidth).toBe(58);
  });

  it('keeps Col 1 and Col 2 untruncated even with long notes if Col 3 still retains >= 30%', () => {
    // innerW=340 -> gap=8 (3*8=24), refAmt=66 -> rawAvail=250
    // 30% of 250 = 75 -> leftBudget = 175 >= 82 + 78 (160)
    const layout = computeAdaptiveLiveColumns({
      innerWidth: 340,
      wantWho: 82,
      wantCc: 78,
      wantPg: 240,
      refAmt: 66,
      hasWho: true,
    });

    expect(layout.whoWidth).toBe(82);
    expect(layout.ccWidth).toBe(78);
  });

  it('does not let short notes hoard unused minimum space when Col 1 & Col 2 are tight', () => {
    // innerW=300 -> gap=6 (18), refAmt=64 -> rawAvail=218
    // Notes only need 44px (< 30% floor 65px), so leftBudget = 218 - 44 = 174
    const layout = computeAdaptiveLiveColumns({
      innerWidth: 300,
      wantWho: 96,
      wantCc: 76,
      wantPg: 44,
      refAmt: 64,
      hasWho: true,
    });

    expect(layout.whoWidth).toBe(96);
    expect(layout.ccWidth).toBe(76);
  });

  it('uses water-filling so an extreme outlier in Col 1 does not starve Col 2', () => {
    // innerW=350 -> gap=8 (24), refAmt=66 -> rawAvail=260
    // targetPgMin = max(56, round(78)) = 78 -> leftBudget = 182
    // wantWho = 240 (extreme outlier), wantCc = 76 (normal)
    const layout = computeAdaptiveLiveColumns({
      innerWidth: 350,
      wantWho: 240,
      wantCc: 76,
      wantPg: 140,
      refAmt: 66,
      hasWho: true,
    });

    // Col 2 should get its full 76px while Col 1 takes the remaining 106px
    expect(layout.ccWidth).toBe(76);
    expect(layout.whoWidth).toBe(106);
    expect(layout.whoWidth + layout.ccWidth).toBe(182);
  });

  it('collapses Col 1 cleanly when viewing transfer-only rows', () => {
    const layout = computeAdaptiveLiveColumns({
      innerWidth: 320,
      wantWho: 0,
      wantCc: 64,
      wantPg: 90,
      refAmt: 66,
      hasWho: false,
    });

    expect(layout.hideWho).toBe(true);
    expect(layout.whoWidth).toBe(0);
    expect(layout.ccWidth).toBe(64);
  });

  it('handles very small or non-positive container widths without NaN or negative values', () => {
    const zero = computeAdaptiveLiveColumns({
      innerWidth: 0,
      wantWho: 80,
      wantCc: 70,
      wantPg: 100,
      refAmt: 60,
      hasWho: true,
    });
    expect(zero.whoWidth).toBe(80);
    expect(zero.ccWidth).toBe(70);

    const tiny = computeAdaptiveLiveColumns({
      innerWidth: 180,
      wantWho: 90,
      wantCc: 80,
      wantPg: 120,
      refAmt: 60,
      hasWho: true,
    });
    expect(tiny.whoWidth).toBeGreaterThanOrEqual(0);
    expect(tiny.ccWidth).toBeGreaterThanOrEqual(0);
    expect(tiny.whoWidth + tiny.ccWidth).toBeLessThanOrEqual(180 - tiny.gap * 3 - 60);
  });
});
