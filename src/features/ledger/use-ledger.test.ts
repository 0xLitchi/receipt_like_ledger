import { describe, expect, it } from 'vitest';
import {
  buildAvailableLedgers,
  buildAvailableYearMonths,
  buildFilterOptions,
  buildMonthList,
  categoryLabel,
  computeStats,
  expandTransactionsForDisplay,
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

  it('filters by exact subcategory summary key', () => {
    expect(filterTransactions(rows, { ...base, category: '杂项/麻将' })).toHaveLength(1);
    expect(filterTransactions(rows, { ...base, category: '餐饮/早餐' })).toHaveLength(1);
    expect(filterTransactions(rows, { ...base, category: '餐饮' })).toHaveLength(0);
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
  it('is precise to subcategory for all categories', () => {
    expect(summaryKey(t({ category: '餐饮', subcategory: '早餐' }))).toBe('餐饮/早餐');
    expect(summaryKey(t({ category: '住房', subcategory: '房租' }))).toBe('住房/房租');
    expect(summaryKey(t({ category: '杂项', subcategory: '麻将' }))).toBe('杂项/麻将');
  });

  it('falls back to main category when subcategory is empty', () => {
    expect(summaryKey(t({ category: '杂项', subcategory: '' }))).toBe('杂项');
    expect(summaryKey(t({ category: '餐饮', subcategory: '' }))).toBe('餐饮');
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

  it('expands transfers into an income leg for to_ledger and an expense leg for ledger without member', () => {
    const rows = [
      t({ id: 'n1', title: '工资', amount: 10000, ledger: 'Default', category: '收入', subcategory: '工资' }),
      t({
        id: 'x1',
        title: '月度定存',
        amount: 2000,
        member: '荔枝',
        ledger: 'Default',
        tx_type: 'transfer',
        to_ledger: '储蓄',
        category: '转账',
        subcategory: '储蓄划转',
      }),
    ];

    const expanded = expandTransactionsForDisplay(rows);
    expect(expanded).toHaveLength(3);

    const [normal, legIn, legOut] = expanded;
    expect(normal.id).toBe('n1');
    expect(legIn).toMatchObject({
      id: 'x1::in',
      sourceId: 'x1',
      transferLeg: 'in',
      ledger: '储蓄',
      counterpartyLedger: 'Default',
      amount: 2000,
      member: '',
    });
    expect(legOut).toMatchObject({
      id: 'x1::out',
      sourceId: 'x1',
      transferLeg: 'out',
      ledger: 'Default',
      counterpartyLedger: '储蓄',
      amount: -2000,
      member: '',
    });
  });

  it('filters expanded transfer legs by ledger and type', () => {
    const rows = expandTransactionsForDisplay([
      t({ title: '工资', amount: 10000, ledger: 'Default', category: '收入', subcategory: '工资' }),
      t({ title: '餐费', amount: -50, ledger: 'Default', category: '餐饮', subcategory: '午餐' }),
      t({ title: '存钱', amount: 2000, ledger: 'Default', tx_type: 'transfer', to_ledger: '储蓄', category: '转账', subcategory: '储蓄划转' }),
      t({ title: '利息', amount: 80, ledger: '储蓄', category: '收入', subcategory: '理财' }),
    ]);

    expect(filterTransactions(rows, { ...base, type: 'TRANSFER' })).toHaveLength(2);
    expect(filterTransactions(rows, { ...base, type: 'INCOME' })).toHaveLength(3); // 工资 + 利息 + 储蓄转入
    expect(filterTransactions(rows, { ...base, type: 'EXPENSE' })).toHaveLength(2); // 餐费 + Default转出
    expect(filterTransactions(rows, { ...base, ledger: 'Default' })).toHaveLength(3); // 工资 + 餐费 + Default转出
    expect(filterTransactions(rows, { ...base, ledger: '储蓄' })).toHaveLength(2); // 利息 + 储蓄转入
    expect(filterTransactions(rows, { ...base, ledger: '储蓄', type: 'TRANSFER' })).toHaveLength(1);
    expect(filterTransactions(rows, { ...base, ledger: '储蓄', type: 'INCOME' })).toHaveLength(2);
    expect(filterTransactions(rows, { ...base, ledger: '储蓄', type: 'EXPENSE' })).toHaveLength(0);
  });

  it('excludes transfers from ALL-ledger stats but counts them as inflow/outflow in single-ledger stats', () => {
    const rows = expandTransactionsForDisplay([
      t({ amount: 500, ledger: 'Default', category: '收入', subcategory: '兼职' }),
      t({ amount: -100, ledger: 'Default', category: '餐饮', subcategory: '晚餐' }),
      t({ amount: 1000, tx_type: 'transfer', ledger: 'Default', to_ledger: '储蓄', category: '转账', subcategory: '储蓄划转' }),
      t({ amount: 50, ledger: '储蓄', category: '收入', subcategory: '理财' }),
    ]);

    const allStats = computeStats(filterTransactions(rows, base), 'ALL');
    expect(allStats.totalIncome).toBe(550);
    expect(allStats.totalExpense).toBe(100);
    expect(allStats.netBalance).toBe(450);

    const defaultStats = computeStats(filterTransactions(rows, { ...base, ledger: 'Default' }), 'Default');
    expect(defaultStats.totalIncome).toBe(500);
    expect(defaultStats.totalExpense).toBe(1100);
    expect(defaultStats.netBalance).toBe(-600);

    const savingsStats = computeStats(filterTransactions(rows, { ...base, ledger: '储蓄' }), '储蓄');
    expect(savingsStats.totalIncome).toBe(1050);
    expect(savingsStats.totalExpense).toBe(0);
    expect(savingsStats.netBalance).toBe(1050);

    // 各账本净计之和等于全部账本净计
    expect(defaultStats.netBalance + savingsStats.netBalance).toBe(allStats.netBalance);
  });
});
