/**
 * 账本页的派生数据：月份列表、筛选、统计、按日分组。
 * 所有主题视图只消费这里的输出，不再各自计算。
 */
import { useMemo } from 'react';
import type { DateGroup, LedgerFilters, SummaryStats, Transaction } from '../../types';

/** 规范化账本名称，空值回退为 Default */
export const normalizeLedgerName = (ledger?: string | null): string => {
  const trimmed = (ledger ?? '').trim();
  return trimmed || 'Default';
};

/** 判断是否为账本间转账记录 */
export const isTransferTransaction = (
  t: Pick<Transaction, 'tx_type' | 'to_ledger'>
): boolean => {
  if (t.tx_type === 'transfer') return true;
  if (t.to_ledger && t.to_ledger.trim().length > 0) return true;
  return false;
};

/** 判断交易是否属于当前选中的账本（转账记录在转出/转入账本均可见） */
export const matchesLedgerFilter = (
  t: Pick<Transaction, 'ledger' | 'tx_type' | 'to_ledger'>,
  ledgerFilter: string
): boolean => {
  if (!ledgerFilter || ledgerFilter === 'ALL') return true;
  if (normalizeLedgerName(t.ledger) === ledgerFilter) return true;
  if (isTransferTransaction(t)) {
    const toLedger = (t.to_ledger ?? '').trim();
    if (toLedger && toLedger === ledgerFilter) return true;
  }
  return false;
};

/** 提取数据中出现过的所有账本，始终包含 Default 且置顶，其余按中文排序 */
export function buildAvailableLedgers(transactions: Transaction[]): string[] {
  const others = new Set<string>();
  transactions.forEach((t) => {
    const fromLedger = normalizeLedgerName(t.ledger);
    if (fromLedger !== 'Default') others.add(fromLedger);
    if (isTransferTransaction(t)) {
      const toLedger = (t.to_ledger ?? '').trim();
      if (toLedger && toLedger !== 'Default') others.add(toLedger);
    }
  });
  return ['Default', ...Array.from(others).sort((a, b) => a.localeCompare(b, 'zh-CN'))];
}

/** 主分类 + 子分类的展示名，例如 "杂项/麻将" */
export const categoryLabel = (t: Pick<Transaction, 'category' | 'subcategory'>): string => {
  if (!t.category) return '';
  return t.subcategory ? `${t.category}/${t.subcategory}` : t.category;
};

/**
 * 汇总键：杂项按子分类细分（与分类汇总面板保持一致），其余按主分类。
 * 用于「点击分类 → 过滤明细」的匹配。
 */
export const summaryKey = (
  t: Pick<Transaction, 'category' | 'subcategory' | 'tx_type' | 'to_ledger'>
): string => {
  if (isTransferTransaction(t)) return t.category || '转账';
  const main = t.category || '其它';
  if (main === '杂项' && t.subcategory) return `杂项/${t.subcategory}`;
  return main;
};

/** 从交易里提取所有出现过的月份（YYYY-MM），倒序 */
export function buildMonthList(transactions: Transaction[], limit = 3): string[] {
  const monthSet = new Set<string>();

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  for (let i = 0; i < 3; i++) {
    const d = new Date(curYear, curMonth - 1 - i, 1);
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  transactions.forEach((t) => {
    if (t.date && t.date.length >= 7) monthSet.add(t.date.substring(0, 7));
  });

  return Array.from(monthSet).sort().reverse().slice(0, limit);
}

/** 提取数据中实际出现过的所有年月（不限制数量、不补空月），按倒序分组 */
export function buildAvailableYearMonths(transactions: Transaction[]): {
  years: string[];
  monthsByYear: Record<string, string[]>;
  allMonths: string[];
} {
  const monthSet = new Set<string>();
  transactions.forEach((t) => {
    const ym = t.date?.substring(0, 7);
    if (ym && /^\d{4}-\d{2}$/.test(ym)) {
      monthSet.add(ym);
    }
  });

  const allMonths = Array.from(monthSet).sort().reverse();
  const monthsByYear: Record<string, string[]> = {};
  const years: string[] = [];

  for (const ym of allMonths) {
    const year = ym.slice(0, 4);
    const month = ym.slice(5, 7);
    if (!monthsByYear[year]) {
      monthsByYear[year] = [];
      years.push(year);
    }
    monthsByYear[year].push(month);
  }

  return { years, monthsByYear, allMonths };
}

/** 去重后的成员 / 分类候选值，用于筛选下拉 */
export function buildFilterOptions(transactions: Transaction[]) {
  const members = new Set<string>();
  const categories = new Set<string>();

  transactions.forEach((t) => {
    if (t.member) members.add(t.member);
    categories.add(summaryKey(t));
  });

  return {
    members: Array.from(members).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    categories: Array.from(categories).sort((a, b) => a.localeCompare(b, 'zh-CN')),
  };
}

export function filterTransactions(transactions: Transaction[], filters: LedgerFilters): Transaction[] {
  const keyword = filters.search.trim().toLowerCase();

  return transactions.filter((t) => {
    if (!matchesLedgerFilter(t, filters.ledger)) return false;
    if (filters.month !== 'ALL' && !t.date?.startsWith(filters.month)) return false;
    if (filters.member !== 'ALL' && t.member !== filters.member) return false;
    if (filters.category !== 'ALL' && summaryKey(t) !== filters.category) return false;

    const transfer = isTransferTransaction(t);
    if (filters.type === 'TRANSFER' && !transfer) return false;
    if (filters.type === 'EXPENSE' && (transfer || t.amount >= 0)) return false;
    if (filters.type === 'INCOME' && (transfer || t.amount <= 0)) return false;

    if (keyword) {
      const haystack = `${t.title} ${t.member} ${categoryLabel(t)} ${t.ledger} ${t.to_ledger || ''}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}

export function computeStats(transactions: Transaction[]): SummaryStats {
  let income = 0;
  let expense = 0;
  let transfer = 0;

  transactions.forEach((t) => {
    if (isTransferTransaction(t)) {
      transfer += Math.abs(t.amount);
    } else if (t.amount > 0) {
      income += t.amount;
    } else {
      expense += Math.abs(t.amount);
    }
  });

  return {
    totalIncome: income,
    totalExpense: expense,
    totalTransfer: transfer,
    netBalance: income - expense,
    count: transactions.length,
  };
}

/** 按日期倒序分组，组内保持服务端顺序 */
export function groupByDate(transactions: Transaction[]): DateGroup[] {
  const map = new Map<string, Transaction[]>();

  transactions.forEach((t) => {
    const d = t.date || '未知日期';
    const list = map.get(d) || [];
    list.push(t);
    map.set(d, list);
  });

  return Array.from(map.keys())
    .sort()
    .reverse()
    .map((d) => ({
      date: d,
      shortDate: d.length >= 10 ? d.substring(5) : d,
      items: map.get(d) || [],
    }));
}

export function useLedger(transactions: Transaction[], filters: LedgerFilters) {
  const months = useMemo(() => buildMonthList(transactions), [transactions]);
  const options = useMemo(() => buildFilterOptions(transactions), [transactions]);
  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const dateGroups = useMemo(() => groupByDate(filtered), [filtered]);

  return { months, options, filtered, stats, dateGroups };
}
