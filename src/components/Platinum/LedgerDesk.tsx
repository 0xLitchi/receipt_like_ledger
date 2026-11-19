import React, { useMemo, useState, useCallback, useEffect } from 'react';
import type { DateGroup, LedgerFilters, LedgerType, SummaryStats, Transaction } from '../../types';
import { categoryLabel, summaryKey } from '../../features/ledger/use-ledger';
import { formatCurrency } from '../../utils/formatters';
import { PixelDot, PlatinumSelect, PlatinumWindow } from './PlatinumChrome';
import { buildMemberColorMap, memberDotColor } from './colors';

interface LedgerDeskProps {
  allTransactions: Transaction[];
  monthTransactions: Transaction[];
  dateGroups: DateGroup[];
  stats: SummaryStats;
  years: string[];
  monthsByYear: Record<string, string[]>;
  allMonths: string[];
  filters: LedgerFilters;
  onPatchFilters: (next: Partial<LedgerFilters>) => void;
  hasFullAccess: boolean;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  onRefresh: () => void;
}

interface BreakdownRow {
  name: string;
  netTotal: number;
  absVal: number;
  count: number;
  barPct: number;
}

function formatMonthTab(m: string): string {
  if (m === 'ALL') return '全部';
  const [y, mm] = m.split('-');
  if (!y || !mm) return m;
  return `${y}年${mm.padStart(2, '0')}月`;
}

export const LedgerDesk: React.FC<LedgerDeskProps> = ({
  allTransactions,
  monthTransactions,
  dateGroups,
  stats,
  years,
  monthsByYear,
  allMonths,
  filters,
  onPatchFilters,
  hasFullAccess,
  isAdmin,
  onOpenAdmin,
  onRefresh,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedMonth =
    filters.month && allMonths.includes(filters.month) ? filters.month : allMonths[0] || '';
  const selectedYear = selectedMonth ? selectedMonth.slice(0, 4) : years[0] || '';
  const selectedMonthNum = selectedMonth ? selectedMonth.slice(5, 7) : '';

  const yearOptions = useMemo(
    () => years.map((y) => ({ value: y, label: `${y}年` })),
    [years]
  );

  const availableMonthsForYear = useMemo(
    () => (selectedYear ? monthsByYear[selectedYear] ?? [] : []),
    [monthsByYear, selectedYear]
  );

  const monthOptions = useMemo(
    () => availableMonthsForYear.map((mm) => ({ value: mm, label: `${mm}月` })),
    [availableMonthsForYear]
  );

  const handleYearChange = useCallback(
    (newYear: string) => {
      const candidateMonths = monthsByYear[newYear] ?? [];
      if (candidateMonths.length === 0) return;
      const nextMonthNum = candidateMonths.includes(selectedMonthNum)
        ? selectedMonthNum
        : candidateMonths[0];
      onPatchFilters({ month: `${newYear}-${nextMonthNum}`, category: 'ALL' });
    },
    [monthsByYear, selectedMonthNum, onPatchFilters]
  );

  const handleMonthChange = useCallback(
    (newMonthNum: string) => {
      if (!selectedYear) return;
      onPatchFilters({ month: `${selectedYear}-${newMonthNum}`, category: 'ALL' });
    },
    [selectedYear, onPatchFilters]
  );

  // Collapse detail drawer when month changes
  useEffect(() => {
    setExpandedId(null);
  }, [selectedMonth]);

  // Category breakdown (always based on current month scope, not filtered by category itself)
  const categoryRows = useMemo<BreakdownRow[]>(() => {
    const scope = monthTransactions.filter((t) => {
      if (filters.member !== 'ALL' && t.member !== filters.member) return false;
      if (filters.type === 'EXPENSE' && t.amount >= 0) return false;
      if (filters.type === 'INCOME' && t.amount <= 0) return false;
      return true;
    });

    const map = new Map<string, { net: number; count: number }>();
    scope.forEach((t) => {
      const key = summaryKey(t);
      const cur = map.get(key) || { net: 0, count: 0 };
      cur.net += hasFullAccess ? t.amount : 0;
      cur.count += 1;
      map.set(key, cur);
    });

    const list: BreakdownRow[] = Array.from(map.entries()).map(([name, v]) => ({
      name,
      netTotal: v.net,
      absVal: Math.abs(v.net),
      count: v.count,
      barPct: 0,
    }));

    list.sort((a, b) => (hasFullAccess ? b.absVal - a.absVal : b.count - a.count));
    const maxMetric = list.reduce(
      (m, r) => Math.max(m, hasFullAccess ? r.absVal : r.count),
      0
    );
    list.forEach((r) => {
      const val = hasFullAccess ? r.absVal : r.count;
      r.barPct = maxMetric > 0 ? Math.max(val > 0 ? 3 : 0, (val / maxMetric) * 100) : 0;
    });

    return list;
  }, [monthTransactions, filters.member, filters.type, hasFullAccess]);

  // Stable distinct color mapping for each member
  const memberColorMap = useMemo(
    () => buildMemberColorMap(allTransactions.map((t) => t.member || '默认')),
    [allTransactions]
  );

  const hasActiveFilters =
    filters.category !== 'ALL' ||
    filters.member !== 'ALL' ||
    filters.type !== 'ALL' ||
    filters.search.trim().length > 0;

  const handleCopyAmount = useCallback(
    async (e: React.MouseEvent, id: string, amount: number) => {
      e.stopPropagation();
      if (!hasFullAccess) return;
      const text = formatCurrency(amount, false, true).replace('￥', '');
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1200);
      } catch {
        /* ignore clipboard errors */
      }
    },
    [hasFullAccess]
  );

  const maskVal = (val: number, showPlus = false) =>
    hasFullAccess ? formatCurrency(val, showPlus, true) : '￥***.**';

  const accessBadge = isAdmin ? '管理员' : hasFullAccess ? '已解锁' : '脱敏模式';

  return (
    <div className="pt-desk">
      {/* ── Window 1: Main Overview (Matches exe.v2core.com/stats top window) ── */}
      <PlatinumWindow
        title={`Ledger${selectedMonth && selectedMonth !== 'ALL' ? ` · ${formatMonthTab(selectedMonth)}` : ''}`}
        onClose={onRefresh}
        closeTitle="刷新数据"
      >
        {/* Range / Month Strip */}
        <div className="pt-strip">
          <PlatinumSelect
            value={selectedYear}
            options={yearOptions}
            onChange={handleYearChange}
            ariaLabel="选择年份"
            placeholder="暂无年份"
            minWidth={88}
          />
          <PlatinumSelect
            value={selectedMonthNum}
            options={monthOptions}
            onChange={handleMonthChange}
            ariaLabel="选择月份"
            placeholder="暂无月份"
            minWidth={74}
          />

          <span
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: '#333',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <PixelDot color={isAdmin ? '#333399' : hasFullAccess ? '#336633' : '#999999'} />
              {accessBadge}
            </span>
            <button type="button" className="pt-btn tab" onClick={onOpenAdmin}>
              后台
            </button>
          </span>
        </div>

        {/* Active Filter Chips Strip (shown only when filtered) */}
        {hasActiveFilters && (
          <div className="pt-strip pt-chips">
            <span>筛选:</span>
            {filters.category !== 'ALL' && (
              <span className="pt-chip">
                分类 <b>{filters.category}</b>
                <button
                  type="button"
                  aria-label="清除分类筛选"
                  onClick={() => onPatchFilters({ category: 'ALL' })}
                >
                  ×
                </button>
              </span>
            )}
            {filters.member !== 'ALL' && (
              <span className="pt-chip">
                成员 <b>{filters.member}</b>
                <button
                  type="button"
                  aria-label="清除成员筛选"
                  onClick={() => onPatchFilters({ member: 'ALL' })}
                >
                  ×
                </button>
              </span>
            )}
            {filters.type !== 'ALL' && (
              <span className="pt-chip">
                类型 <b>{filters.type === 'EXPENSE' ? '仅支出' : '仅收入'}</b>
                <button
                  type="button"
                  aria-label="清除收支类型筛选"
                  onClick={() => onPatchFilters({ type: 'ALL' })}
                >
                  ×
                </button>
              </span>
            )}
            {filters.search.trim() && (
              <span className="pt-chip">
                搜索 <b>{filters.search.trim()}</b>
                <button
                  type="button"
                  aria-label="清除搜索关键词"
                  onClick={() => onPatchFilters({ search: '' })}
                >
                  ×
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => onPatchFilters({ category: 'ALL', member: 'ALL', type: 'ALL', search: '' })}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 0,
                color: 'var(--hl)',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: 11,
              }}
            >
              清除全部
            </button>
          </div>
        )}

        {/* KPI Metric Tiles */}
        <div className="pt-tiles">
          <div className="pt-tile">
            <div className="tl">支出</div>
            <div
              className="tv"
              style={{ color: hasFullAccess ? 'var(--expense)' : '#666' }}
            >
              {maskVal(-stats.totalExpense)}
            </div>
          </div>

          <div className="pt-tile">
            <div className="tl">收入</div>
            <div
              className="tv"
              style={{ color: hasFullAccess ? 'var(--income)' : '#666' }}
            >
              {maskVal(stats.totalIncome, true)}
            </div>
          </div>
        </div>
      </PlatinumWindow>

      {/* ── Window 2: Category Breakdown ── */}
      <PlatinumWindow title="分类统计 · Categories">
        <div className="pt-rows" data-category-summary>
          {categoryRows.length === 0 ? (
            <div className="none">本月暂无分类数据</div>
          ) : (
            categoryRows.map((item) => {
              const isSelected = filters.category === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  className={`pt-row clickable${isSelected ? ' selected' : ''}`}
                  aria-pressed={isSelected}
                  title={isSelected ? '点击取消分类筛选' : `按 ${item.name} 筛选`}
                  onClick={() =>
                    onPatchFilters({ category: isSelected ? 'ALL' : item.name })
                  }
                >
                  <span className="lab">
                    <span className="bar" style={{ width: `${item.barPct.toFixed(1)}%` }} />
                    <span className="lab-inner">
                      <span className="lab-text">{item.name}</span>
                      <span className="tag">{item.count}笔</span>
                    </span>
                  </span>
                  <span
                    className="n"
                    style={{
                      color: !hasFullAccess
                        ? '#666'
                        : item.netTotal >= 0
                        ? 'var(--income)'
                        : 'var(--expense)',
                    }}
                  >
                    {hasFullAccess ? formatCurrency(item.netTotal, true, false) : '***.**'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PlatinumWindow>

      {/* ── Window 3: Transactions Feed (Matches exe.v2core.com/stats Live window) ── */}
      <PlatinumWindow title="账单明细 · Transactions">
        <div className="pt-strip">
          {(['ALL', 'EXPENSE', 'INCOME'] as LedgerType[]).map((tp) => {
            const label = tp === 'ALL' ? '全部' : tp === 'EXPENSE' ? '支出' : '收入';
            return (
              <button
                key={tp}
                type="button"
                className={`pt-btn tab${filters.type === tp ? ' on' : ''}`}
                aria-pressed={filters.type === tp}
                onClick={() => onPatchFilters({ type: tp })}
              >
                {label}
              </button>
            );
          })}

          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555' }}>
            共 {stats.count} 笔
          </span>
        </div>

        <div>
          {dateGroups.length === 0 ? (
            <div style={{ padding: '32px 12px', textAlign: 'center', color: '#777', fontSize: 12 }}>
              当前筛选条件下暂无记账明细
            </div>
          ) : (
            dateGroups.map((group) => (
              <React.Fragment key={group.date}>
                <div className="pt-live-group-header">
                  <span>{group.date}</span>
                </div>

                {group.items.map((tx) => {
                    const isActive = expandedId === tx.id;
                    const cat = categoryLabel(tx);
                    const memberName = tx.member || '默认';
                    const noteText = hasFullAccess
                      ? (tx.title || '').trim()
                      : tx.title
                      ? '***'
                      : '';
                    const dotColor =
                      memberColorMap.get(memberName) ?? memberDotColor(memberName);

                    return (
                      <React.Fragment key={tx.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-expanded={isActive}
                          className={`pt-live-row${isActive ? ' active' : ''}`}
                          onClick={() => setExpandedId((prev) => (prev === tx.id ? null : tx.id))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setExpandedId((prev) => (prev === tx.id ? null : tx.id));
                            }
                          }}
                        >
                          <span className="who" title={memberName}>
                            <PixelDot color={dotColor} />
                            <span>{memberName}</span>
                          </span>

                          <span className="cc" title={cat}>
                            {cat || '—'}
                          </span>

                          <span className="pg" title={noteText || undefined}>
                            {noteText}
                          </span>

                          <span
                            className="amt"
                            style={{
                              color: !hasFullAccess
                                ? '#777'
                                : tx.amount >= 0
                                ? 'var(--income)'
                                : 'var(--expense)',
                            }}
                            title={hasFullAccess ? '点击复制金额' : undefined}
                            onClick={(e) => void handleCopyAmount(e, tx.id, tx.amount)}
                          >
                            {copiedId === tx.id
                              ? '已复制'
                              : hasFullAccess
                              ? formatCurrency(tx.amount, true, false)
                              : '***.**'}
                          </span>
                        </div>

                        {isActive && (
                          <div className="pt-inspector">
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 6,
                                paddingBottom: 4,
                                borderBottom: '1px solid #ddd',
                              }}
                            >
                              <b style={{ fontSize: 12 }}>{noteText || cat || '交易详情'}</b>
                              <button
                                type="button"
                                className="pt-btn tab"
                                onClick={() => setExpandedId(null)}
                              >
                                收起
                              </button>
                            </div>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: '4px 16px',
                                fontSize: 11,
                              }}
                            >
                              <div>
                                <span style={{ color: '#666' }}>日期: </span>
                                <span style={{ fontFamily: 'var(--font-mono)' }}>{tx.date}</span>
                              </div>
                              <div>
                                <span style={{ color: '#666' }}>成员: </span>
                                <b>{tx.member || '—'}</b>
                              </div>
                              <div>
                                <span style={{ color: '#666' }}>分类: </span>
                                <b>{cat || '—'}</b>
                              </div>
                              <div>
                                <span style={{ color: '#666' }}>账本: </span>
                                <span>{tx.ledger || 'Default'}</span>
                              </div>
                              <div>
                                <span style={{ color: '#666' }}>金额: </span>
                                <b
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    color: !hasFullAccess
                                      ? '#666'
                                      : tx.amount >= 0
                                      ? 'var(--income)'
                                      : 'var(--expense)',
                                  }}
                                >
                                  {maskVal(tx.amount, true)}
                                </b>
                              </div>
                              {tx.title && (
                                <div>
                                  <span style={{ color: '#666' }}>备注: </span>
                                  <span>{hasFullAccess ? tx.title : '***'}</span>
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                marginTop: 6,
                                paddingTop: 4,
                                borderTop: '1px dashed #ccc',
                                fontSize: 10,
                                color: '#777',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              ID: {tx.id}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
              </React.Fragment>
            ))
          )}
        </div>

        <div className="pt-statusbar">
          <span>
            共计 {stats.count} 笔 · 收入{' '}
            <span style={{ color: hasFullAccess ? 'var(--income)' : undefined }}>
              {maskVal(stats.totalIncome, true)}
            </span>{' '}
            · 支出{' '}
            <span style={{ color: hasFullAccess ? 'var(--expense)' : undefined }}>
              {maskVal(-stats.totalExpense)}
            </span>
          </span>
          <b
            style={{
              fontFamily: 'var(--font-mono)',
              color: !hasFullAccess
                ? undefined
                : stats.netBalance >= 0
                ? 'var(--income)'
                : 'var(--expense)',
            }}
          >
            净计: {maskVal(stats.netBalance, true)}
          </b>
        </div>
      </PlatinumWindow>
    </div>
  );
};
