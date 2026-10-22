import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LedgerFilters, LedgerType } from '../../types';

const DEFAULT_FILTERS: LedgerFilters = {
  month: '',
  member: 'ALL',
  category: 'ALL',
  type: 'ALL',
  search: '',
};

const isValidType = (v: string | null): v is LedgerType =>
  v === 'ALL' || v === 'EXPENSE' || v === 'INCOME';

/**
 * 把筛选条件放在 URL query 里，刷新、前进后退、分享链接都能还原同一视图。
 * month 为空表示"使用最近月份"，由页面在拿到数据后回填。
 */
export function useLedgerFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<LedgerFilters>(() => {
    const type = searchParams.get('type');
    return {
      month: searchParams.get('month') ?? DEFAULT_FILTERS.month,
      member: searchParams.get('member') ?? DEFAULT_FILTERS.member,
      category: searchParams.get('category') ?? DEFAULT_FILTERS.category,
      type: isValidType(type) ? type : DEFAULT_FILTERS.type,
      search: searchParams.get('q') ?? DEFAULT_FILTERS.search,
    };
  }, [searchParams]);

  const patch = useCallback(
    (next: Partial<LedgerFilters>) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const merged = { ...filters, ...next };

          const write = (key: string, value: string, fallback: string) => {
            if (!value || value === fallback) params.delete(key);
            else params.set(key, value);
          };

          write('month', merged.month, DEFAULT_FILTERS.month);
          write('member', merged.member, DEFAULT_FILTERS.member);
          write('category', merged.category, DEFAULT_FILTERS.category);
          write('q', merged.search, DEFAULT_FILTERS.search);
          if (merged.type === 'ALL') params.delete('type');
          else params.set('type', merged.type);

          return params;
        },
        { replace: true }
      );
    },
    [filters, setSearchParams]
  );

  const reset = useCallback(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        ['month', 'member', 'category', 'type', 'q'].forEach((k) => params.delete(k));
        return params;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const activeCount =
    (filters.member !== 'ALL' ? 1 : 0) +
    (filters.category !== 'ALL' ? 1 : 0) +
    (filters.type !== 'ALL' ? 1 : 0) +
    (filters.search.trim() ? 1 : 0);

  return { filters, patch, reset, activeCount };
}
