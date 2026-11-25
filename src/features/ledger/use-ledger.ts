/**
 * 账本页的派生数据：月份列表、筛选、统计、按日分组。
 * 所有主题视图只消费这里的输出，不再各自计算。
 */
import { useMemo } from 'react';
import type { DateGroup, DisplayTransaction, LedgerFilters, SummaryStats, Transaction } from '../../types';

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
 * 汇总键：“杂项”按二级分类汇总（如 "杂项/麻将"），其余按一级分类汇总。
 * 用于分类统计面板及「点击分类 → 过滤明细」的匹配。
 */
export const summaryKey = (
  t: Pick<Transaction, 'category' | 'subcategory' | 'tx_type' | 'to_ledger'>
): string => {
  if (isTransferTransaction(t)) return (t.category || '').trim() || '转账';
  const main = (t.category || '').trim() || '其它';
  const sub = (t.subcategory || '').trim();
  if (main === '杂项' && sub) return `杂项/${sub}`;
  return main;
};

/**
 * 将转账记录拆分为首页明细展示的两行：
 * - 第一行：对转入账本（A）的收入（+amount）
 * - 第二行：对转出账本（B）的支出（-amount）
 * 且转账不携带人物 tag（member 置空）。
 */
export function expandTransactionsForDisplay(transactions: Transaction[]): DisplayTransaction[] {
  const result: DisplayTransaction[] = [];

  for (const t of transactions) {
    if (!isTransferTransaction(t)) {
      result.push(t);
      continue;
    }

    const absAmount = Math.abs(Number(t.amount) || 0);
    const fromLedger = normalizeLedgerName(t.ledger);
    const toLedger = normalizeLedgerName(t.to_ledger);

    // 账本 A（转入账本）的收入行
    result.push({
      ...t,
      id: `${t.id}::in`,
      sourceId: t.id,
      member: '',
      amount: absAmount,
      ledger: toLedger,
      to_ledger: toLedger,
      tx_type: 'transfer',
      transferLeg: 'in',
      counterpartyLedger: fromLedger,
    });

    // 账本 B（转出账本）的支出行
    result.push({
      ...t,
      id: `${t.id}::out`,
      sourceId: t.id,
      member: '',
      amount: absAmount === 0 ? 0 : -absAmount,
      ledger: fromLedger,
      to_ledger: toLedger,
      tx_type: 'transfer',
      transferLeg: 'out',
      counterpartyLedger: toLedger,
    });
  }

  return result;
}

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

/** 去重后的成员 / 分类候选值，用于筛选下拉（转账不带人物 tag，不计入分类统计） */
export function buildFilterOptions(transactions: Transaction[]) {
  const members = new Set<string>();
  const categories = new Set<string>();

  transactions.forEach((t) => {
    if (isTransferTransaction(t)) return;
    if (t.member) members.add(t.member);
    categories.add(summaryKey(t));
  });

  return {
    members: Array.from(members).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    categories: Array.from(categories).sort((a, b) => a.localeCompare(b, 'zh-CN')),
  };
}

export function filterTransactions(
  transactions: DisplayTransaction[],
  filters: LedgerFilters
): DisplayTransaction[] {
  const keyword = filters.search.trim().toLowerCase();

  return transactions.filter((t) => {
    const isExpandedTransfer = Boolean(t.transferLeg);
    if (isExpandedTransfer) {
      if (filters.ledger && filters.ledger !== 'ALL' && normalizeLedgerName(t.ledger) !== filters.ledger) {
        return false;
      }
    } else if (!matchesLedgerFilter(t, filters.ledger)) {
      return false;
    }

    if (filters.month !== 'ALL' && !t.date?.startsWith(filters.month)) return false;
    if (filters.member !== 'ALL' && t.member !== filters.member) return false;
    if (filters.category !== 'ALL' && summaryKey(t) !== filters.category) return false;

    const transfer = isExpandedTransfer || isTransferTransaction(t);
    if (filters.type === 'TRANSFER' && !transfer) return false;
    if (filters.type === 'EXPENSE') {
      if (isExpandedTransfer) {
        if (t.transferLeg !== 'out') return false;
      } else if (transfer || t.amount >= 0) {
        return false;
      }
    }
    if (filters.type === 'INCOME') {
      if (isExpandedTransfer) {
        if (t.transferLeg !== 'in') return false;
      } else if (transfer || t.amount <= 0) {
        return false;
      }
    }

    if (keyword) {
      const haystack = `${t.title} ${t.member} ${categoryLabel(t)} ${t.ledger} ${t.to_ledger || ''} ${t.counterpartyLedger || ''}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}

/**
 * 计算收入、支出与净计：
 * - 全部账本（ALL）视角：仅汇总真实收支，忽略内部转账，避免跨账本划转虚增总收支；
 * - 单账本视角：转入该账本记作收入、转出该账本记作支出，与该账本的明细行及净余额保持一致。
 */
export function computeStats(
  transactions: DisplayTransaction[],
  ledgerFilter: string = 'ALL'
): SummaryStats {
  let income = 0;
  let expense = 0;
  const includeTransferLegs = Boolean(ledgerFilter && ledgerFilter !== 'ALL');

  transactions.forEach((t) => {
    const transfer = Boolean(t.transferLeg) || isTransferTransaction(t);
    if (transfer) {
      if (!includeTransferLegs) return;
      if (t.transferLeg === 'in' || (!t.transferLeg && (t.to_ledger || '').trim() === ledgerFilter)) {
        income += Math.abs(t.amount);
      } else if (t.transferLeg === 'out' || (!t.transferLeg && normalizeLedgerName(t.ledger) === ledgerFilter)) {
        expense += Math.abs(t.amount);
      }
      return;
    }

    if (t.amount > 0) {
      income += t.amount;
    } else {
      expense += Math.abs(t.amount);
    }
  });

  return {
    totalIncome: income,
    totalExpense: expense,
    netBalance: income - expense,
    count: transactions.length,
  };
}

/**
 * 计算分类统计柱状图宽度百分比（0–100）：
 * - 当最大/最小正值跨度较小（约 16 倍以内）时保持线性比例，精确反映金额占比；
 * - 当存在跨数量级大额项（如工资 vs 咖啡奶茶）时，自动采用平滑幂函数压缩，
 *   避免小额分类全部被压扁到相同极短柱条，保证各层级清晰可辨且严格单调。
 */
export function computeCategoryBarWidths(values: number[]): number[] {
  if (values.length === 0) return [];

  let maxVal = 0;
  let minPositive = Infinity;
  for (const raw of values) {
    const v = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    if (v > maxVal) maxVal = v;
    if (v > 0 && v < minPositive) minPositive = v;
  }

  if (maxVal <= 0) {
    return values.map(() => 0);
  }

  const TARGET_MIN_RATIO = 0.06;
  const ratio = minPositive < Infinity && minPositive > 0 ? maxVal / minPositive : 1;
  const exponent =
    ratio > 1
      ? Math.min(1, Math.max(0.3, Math.log(1 / TARGET_MIN_RATIO) / Math.log(ratio)))
      : 1;

  return values.map((raw) => {
    const v = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    if (v <= 0) return 0;
    return Math.max(3, Math.pow(v / maxVal, exponent) * 100);
  });
}

/** 按日期倒序分组，组内保持服务端顺序 */
export function groupByDate(transactions: DisplayTransaction[]): DateGroup[] {
  const map = new Map<string, DisplayTransaction[]>();

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
  const expanded = useMemo(() => expandTransactionsForDisplay(transactions), [transactions]);
  const filtered = useMemo(() => filterTransactions(expanded, filters), [expanded, filters]);
  const stats = useMemo(() => computeStats(filtered, filters.ledger), [filtered, filters.ledger]);
  const dateGroups = useMemo(() => groupByDate(filtered), [filtered]);

  return { months, options, filtered, stats, dateGroups };
}
