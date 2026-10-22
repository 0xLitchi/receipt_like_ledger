import { useCallback, useMemo, useState } from 'react';
import type { LedgerFilters, LedgerType } from '../../types';

const DEFAULT_FILTERS: LedgerFilters = {
  month: '',
  member: 'ALL',
  category: 'ALL',
  type: 'ALL',
  search: '',
};

/**
 * 账本筛选状态（月份、成员、分类、收支、关键词）。
 *
 * 刻意不写入 URL：地址栏只保留页面入口与访问令牌，方便直接收藏。
 * 刷新后回到默认视图（最近一个月、无额外筛选）。
 * month 为空表示「使用最近月份」，由页面在拿到数据后回填。
 */
export function useLedgerFilters() {
  const [filters, setFilters] = useState<LedgerFilters>(DEFAULT_FILTERS);

  const patch = useCallback((next: Partial<LedgerFilters> | ((prev: LedgerFilters) => Partial<LedgerFilters>)) => {
    setFilters((prev) => ({ ...prev, ...(typeof next === 'function' ? next(prev) : next) }));
  }, []);

  const reset = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const activeCount = useMemo(
    () =>
      (filters.member !== 'ALL' ? 1 : 0) +
      (filters.category !== 'ALL' ? 1 : 0) +
      (filters.type !== 'ALL' ? 1 : 0) +
      (filters.search.trim() ? 1 : 0),
    [filters]
  );

  return { filters, patch, reset, activeCount };
}

export type { LedgerType };
