import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDateShort, generateReceiptNo, getTransactionName } from './formatters';

describe('formatCurrency', () => {
  it('formats positive amount with ￥ prefix', () => {
    expect(formatCurrency(3900)).toBe('￥3,900.00');
  });

  it('formats negative amount with minus sign', () => {
    expect(formatCurrency(-205.5)).toBe('￥-205.50');
  });

  it('shows plus sign when requested', () => {
    expect(formatCurrency(97, true)).toBe('￥+97.00');
  });
});

describe('formatDateShort', () => {
  it('converts YYYY-MM-DD to YYYY.MM.DD', () => {
    expect(formatDateShort('2026-08-07')).toBe('2026.08.07');
  });

  it('returns empty string for empty input', () => {
    expect(formatDateShort('')).toBe('');
  });
});

describe('generateReceiptNo', () => {
  it('produces REC-YYYYMMDD-XXXX format', () => {
    const no = generateReceiptNo('2026-08-07');
    expect(no).toMatch(/^REC-\d{8}-\d{4}$/);
  });

  it('is deterministic for the same date', () => {
    expect(generateReceiptNo('2026-08-07')).toBe(generateReceiptNo('2026-08-07'));
  });
});

describe('getTransactionName', () => {
  it('prefers title when present', () => {
    expect(getTransactionName({ title: '小雅退押金', category: '住房', subcategory: '押金' }))
      .toBe('小雅退押金');
  });

  it('falls back to category/subcategory', () => {
    expect(getTransactionName({ title: '', category: '住房', subcategory: '押金' }))
      .toBe('住房 / 押金');
  });

  it('falls back to category alone', () => {
    expect(getTransactionName({ title: '', category: '杂项', subcategory: '' }))
      .toBe('杂项');
  });
});
