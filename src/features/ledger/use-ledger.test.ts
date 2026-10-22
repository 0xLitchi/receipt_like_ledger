import { describe, expect, it } from 'vitest';
import {
  buildFilterOptions,
  buildMonthList,
  categoryLabel,
  computeStats,
  filterTransactions,
  groupByDate,
  summaryKey,
} from './use-ledger';
import type { LedgerFilters, Transaction } from '../../types';

const t = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  title: '',
  date: '2026-10-01',
  amount: -10,
  member: '荔枝',
  category: '餐饮',
  subcategory: '',
  ledger: 'Default',
  ...over,
});

const base: LedgerFilters = { month: 'ALL', member: 'ALL', category: 'ALL', type: 'ALL', search: '' };

describe('categoryLabel', () => {
  it('joins category and subcategory', () => {
    expect(categoryLabel(t({ category: '杂项', subcategory: '麻将' }))).toBe('杂项/麻将');
  });

  it('falls back to category alone', () => {
    expect(categoryLabel(t({ category: '住房', subcategory: '' }))).toBe('住房');
  });

  it('returns empty string without category', () => {
    expect(categoryLabel(t({ category: '' }))).toBe('');
  });
});

describe('filterTransactions', () => {
  const rows = [
    t({ title: '早餐', amount: -12, category: '餐饮', subcategory: '早餐' }),
    t({ title: '工资', amount: 12000, category: '收入', subcategory: '工资' }),
    t({ title: '麻将', amount: 320, category: '杂项', subcategory: '麻将', member: '扶正', date: '2026-09-15' }),
  ];

  it('filters by month prefix', () => {
    expect(filterTransactions(rows, { ...base, month: '2026-09' })).toHaveLength(1);
  });

  it('filters by type', () => {
    expect(filterTransactions(rows, { ...base, type: 'INCOME' })).toHaveLength(2);
    expect(filterTransactions(rows, { ...base, type: 'EXPENSE' })).toHaveLength(1);
  });

  it('filters by summary key (杂项 splits by subcategory)', () => {
    expect(filterTransactions(rows, { ...base, category: '杂项/麻将' })).toHaveLength(1);
  });

  it('filters by main category for non-杂项 rows', () => {
    expect(filterTransactions(rows, { ...base, category: '餐饮' })).toHaveLength(1);
  });

  it('filters by member and keyword', () => {
    expect(filterTransactions(rows, { ...base, member: '扶正' })).toHaveLength(1);
    expect(filterTransactions(rows, { ...base, search: '早餐' })).toHaveLength(1);
  });

  it('returns everything when no filter is set', () => {
    expect(filterTransactions(rows, base)).toHaveLength(3);
  });
});

describe('summaryKey', () => {
  it('uses category for normal rows', () => {
    expect(summaryKey(t({ category: '餐饮', subcategory: '早餐' }))).toBe('餐饮');
  });

  it('splits 杂项 by subcategory', () => {
    expect(summaryKey(t({ category: '杂项', subcategory: '麻将' }))).toBe('杂项/麻将');
  });

  it('keeps bare 杂项 without subcategory', () => {
    expect(summaryKey(t({ category: '杂项', subcategory: '' }))).toBe('杂项');
  });
});

describe('computeStats', () => {
  it('splits income and expense and nets them', () => {
    const stats = computeStats([t({ amount: 100 }), t({ amount: -30 }), t({ amount: -20 })]);
    expect(stats.totalIncome).toBe(100);
    expect(stats.totalExpense).toBe(50);
    expect(stats.netBalance).toBe(50);
    expect(stats.count).toBe(3);
  });
});

describe('groupByDate', () => {
  it('groups by date descending with short labels', () => {
    const groups = groupByDate([
      t({ date: '2026-10-01' }),
      t({ date: '2026-10-20' }),
      t({ date: '2026-10-20' }),
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-10-20', '2026-10-01']);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].shortDate).toBe('10-20');
  });
});

describe('buildMonthList / buildFilterOptions', () => {
  it('always includes the three most recent months', () => {
    expect(buildMonthList([])).toHaveLength(3);
  });

  it('includes months found in data, newest three only', () => {
    const now = new Date();
    const recent = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const month = `${recent.getFullYear()}-${String(recent.getMonth() + 1).padStart(2, '0')}`;

    const months = buildMonthList([t({ date: `${month}-05` }), t({ date: '2024-02-05' })]);
    expect(months).toHaveLength(3);
    expect(months).toContain(month);
    // 早于最近三个月的月份被截断（滑块只展示最近三个月）
    expect(months).not.toContain('2024-02');
  });

  it('collects unique members and categories', () => {
    const opts = buildFilterOptions([
      t({ member: '荔枝', category: '餐饮', subcategory: '' }),
      t({ member: '荔枝', category: '杂项', subcategory: '麻将' }),
      t({ member: '扶正', category: '餐饮', subcategory: '' }),
    ]);
    expect(opts.members).toEqual(['扶正', '荔枝']);
    expect(opts.categories).toContain('杂项/麻将');
    expect(opts.categories).toContain('餐饮');
    expect(opts.categories).not.toContain('杂项');
  });
});
