import { describe, expect, it } from 'vitest';
import {
  buildAvailableLedgers,
  buildAvailableYearMonths,
  buildFilterOptions,
  buildMonthList,
  categoryLabel,
  computeStats,
  filterTransactions,
  groupByDate,
  isTransferTransaction,
  matchesLedgerFilter,
  normalizeLedgerName,
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

const base: LedgerFilters = {
  ledger: 'ALL',
  month: 'ALL',
  member: 'ALL',
  category: 'ALL',
  type: 'ALL',
  search: '',
};

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

describe('buildAvailableYearMonths', () => {
  it('returns only years and months that exist in transactions, descending without limit', () => {
    const result = buildAvailableYearMonths([
      t({ date: '2024-02-05' }),
      t({ date: '2026-11-10' }),
      t({ date: '2026-08-01' }),
      t({ date: '2026-11-02' }),
      t({ date: '2025-12-20' }),
      t({ date: '2025-03-11' }),
      t({ date: '2025-01-01' }),
      t({ date: 'invalid' }),
    ]);

    expect(result.years).toEqual(['2026', '2025', '2024']);
    expect(result.monthsByYear).toEqual({
      '2026': ['11', '08'],
      '2025': ['12', '03', '01'],
      '2024': ['02'],
    });
    expect(result.allMonths).toEqual([
      '2026-11',
      '2026-08',
      '2025-12',
      '2025-03',
      '2025-01',
      '2024-02',
    ]);
  });

  it('returns empty arrays when there are no transactions', () => {
    expect(buildAvailableYearMonths([])).toEqual({
      years: [],
      monthsByYear: {},
      allMonths: [],
    });
  });
});

describe('ledger & transfer helpers', () => {
  it('normalizes empty ledger names to Default', () => {
    expect(normalizeLedgerName('')).toBe('Default');
    expect(normalizeLedgerName('   ')).toBe('Default');
    expect(normalizeLedgerName(undefined)).toBe('Default');
    expect(normalizeLedgerName('储蓄')).toBe('储蓄');
  });

  it('detects transfer transactions by tx_type or to_ledger', () => {
    expect(isTransferTransaction(t({ tx_type: 'transfer', to_ledger: '储蓄' }))).toBe(true);
    expect(isTransferTransaction(t({ to_ledger: '储蓄' }))).toBe(true);
    expect(isTransferTransaction(t({ tx_type: 'normal', to_ledger: '' }))).toBe(false);
    expect(isTransferTransaction(t({}))).toBe(false);
  });

  it('builds available ledgers with Default first and includes transfer targets', () => {
    const ledgers = buildAvailableLedgers([
      t({ ledger: '投资' }),
      t({ ledger: 'Default', tx_type: 'transfer', to_ledger: '储蓄' }),
      t({ ledger: '' }),
    ]);
    expect(ledgers[0]).toBe('Default');
    expect(ledgers).toContain('储蓄');
    expect(ledgers).toContain('投资');
    expect(ledgers).toHaveLength(3);
  });

  it('always includes Default even with no transactions', () => {
    expect(buildAvailableLedgers([])).toEqual(['Default']);
  });

  it('matches transfers on both source and target ledger filters', () => {
    const xfer = t({ ledger: 'Default', tx_type: 'transfer', to_ledger: '储蓄', amount: 1000 });
    expect(matchesLedgerFilter(xfer, 'ALL')).toBe(true);
    expect(matchesLedgerFilter(xfer, 'Default')).toBe(true);
    expect(matchesLedgerFilter(xfer, '储蓄')).toBe(true);
    expect(matchesLedgerFilter(xfer, '投资')).toBe(false);
  });

  it('filters transfers separately from income and expense', () => {
    const rows = [
      t({ title: '工资', amount: 10000, ledger: 'Default' }),
      t({ title: '餐费', amount: -50, ledger: 'Default' }),
      t({ title: '存钱', amount: 2000, ledger: 'Default', tx_type: 'transfer', to_ledger: '储蓄', category: '转账' }),
      t({ title: '利息', amount: 80, ledger: '储蓄' }),
    ];

    expect(filterTransactions(rows, { ...base, type: 'TRANSFER' })).toHaveLength(1);
    expect(filterTransactions(rows, { ...base, type: 'INCOME' })).toHaveLength(2);
    expect(filterTransactions(rows, { ...base, type: 'EXPENSE' })).toHaveLength(1);
    expect(filterTransactions(rows, { ...base, ledger: 'Default' })).toHaveLength(3);
    expect(filterTransactions(rows, { ...base, ledger: '储蓄' })).toHaveLength(2);
    expect(filterTransactions(rows, { ...base, ledger: '储蓄', type: 'TRANSFER' })).toHaveLength(1);
  });

  it('computes totalTransfer without counting transfers in income or expense', () => {
    const stats = computeStats([
      t({ amount: 500 }),
      t({ amount: -100 }),
      t({ amount: 1000, tx_type: 'transfer', ledger: 'Default', to_ledger: '储蓄' }),
    ]);
    expect(stats.totalIncome).toBe(500);
    expect(stats.totalExpense).toBe(100);
    expect(stats.totalTransfer).toBe(1000);
    expect(stats.netBalance).toBe(400);
    expect(stats.count).toBe(3);
  });
});
