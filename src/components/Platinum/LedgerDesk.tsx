import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { DateGroup, LedgerFilters, LedgerType, SummaryStats, Transaction } from '../../types';
import {
  categoryLabel,
  computeCategoryBarWidths,
  isTransferTransaction,
  normalizeLedgerName,
  summaryKey,
} from '../../features/ledger/use-ledger';
import type { LiveRowTextSample } from '../../features/ledger/live-columns';
import { useLiveColumnWidths } from '../../features/ledger/use-live-columns';
import { formatCurrency } from '../../utils/formatters';
import { PixelDot, PlatinumSelect, PlatinumWindow } from './PlatinumChrome';
import { SlotNumber } from './SlotNumber';
import { buildMemberColorMap, memberDotColor } from './colors';

interface LedgerDeskProps {
  allTransactions: Transaction[];
  monthTransactions: Transaction[];
  dateGroups: DateGroup[];
  stats: SummaryStats;
  ledgers: string[];
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
  ledgers,
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
  const [entryAnimating, setEntryAnimating] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (!entryAnimating) return;
    const timer = window.setTimeout(() => setEntryAnimating(false), 1450);
    return () => window.clearTimeout(timer);
  }, [entryAnimating]);

  const selectedLedger = filters.ledger || 'ALL';
  const ledgerOptions = useMemo(
    () => [
      { value: 'ALL', label: '全部账本' },
      ...ledgers.map((l) => ({ value: l, label: l })),
    ],
    [ledgers]
  );

  const isAllMonths = isAdmin && filters.month === 'ALL';
  const selectedMonth = isAllMonths
    ? 'ALL'
    : filters.month && allMonths.includes(filters.month)
    ? filters.month
    : allMonths[0] || '';

  const yearMonthOptions = useMemo(() => {
    const monthItems = allMonths.map((ym) => ({ value: ym, label: formatMonthTab(ym) }));
    if (isAdmin) {
      return [{ value: 'ALL', label: '全部' }, ...monthItems];
    }
    return monthItems;
  }, [allMonths, isAdmin]);

  const handleLedgerChange = useCallback(
    (newLedger: string) => {
      onPatchFilters({ ledger: newLedger, category: 'ALL' });
    },
    [onPatchFilters]
  );

  const handleYearMonthChange = useCallback(
    (newMonth: string) => {
      onPatchFilters({ month: newMonth, category: 'ALL' });
    },
    [onPatchFilters]
  );

  // Whether current date/ledger range contains any transfer records
  const hasTransfersInRange = useMemo(
    () => monthTransactions.some((t) => isTransferTransaction(t)),
    [monthTransactions]
  );

  // Reset TRANSFER filter when switching to a date/ledger range with no transfers
  useEffect(() => {
    if (!hasTransfersInRange && filters.type === 'TRANSFER') {
      onPatchFilters({ type: 'ALL' });
    }
  }, [hasTransfersInRange, filters.type, onPatchFilters]);

  const visibleTypeTabs = useMemo<LedgerType[]>(
    () => (hasTransfersInRange ? ['ALL', 'EXPENSE', 'INCOME', 'TRANSFER'] : ['ALL', 'EXPENSE', 'INCOME']),
    [hasTransfersInRange]
  );

  // Collapse detail drawer when month or ledger changes
  useEffect(() => {
    setExpandedId(null);
  }, [selectedMonth, selectedLedger]);

  // Category breakdown: 杂项 aggregates by subcategory, other categories aggregate by main category (excludes transfers)
  const categoryRows = useMemo<BreakdownRow[]>(() => {
    if (filters.type === 'TRANSFER') return [];

    const scope = monthTransactions.filter((t) => {
      if (isTransferTransaction(t)) return false;
      if (filters.member !== 'ALL' && t.member !== filters.member) return false;
      if (filters.type === 'EXPENSE') return t.amount < 0;
      if (filters.type === 'INCOME') return t.amount > 0;
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
    const widths = computeCategoryBarWidths(
      list.map((r) => (hasFullAccess ? r.absVal : r.count))
    );
    list.forEach((r, idx) => {
      r.barPct = widths[idx] ?? 0;
    });

    return list;
  }, [monthTransactions, filters.member, filters.type, hasFullAccess]);

  // Flat index per transaction row (caps entry slot-machine animation to top rows)
  const rowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const group of dateGroups) {
      for (const item of group.items) {
        map.set(item.id, idx);
        idx += 1;
      }
    }
    return map;
  }, [dateGroups]);

  // Stable distinct color mapping for each member (ignore transfers)
  const memberColorMap = useMemo(
    () =>
      buildMemberColorMap(
        allTransactions
          .filter((t) => !isTransferTransaction(t) && t.member?.trim())
          .map((t) => t.member.trim())
      ),
    [allTransactions]
  );

  // Extract visible row text samples for adaptive column width sizing
  const liveListRef = useRef<HTMLDivElement>(null);
  const liveRowSamples = useMemo<LiveRowTextSample[]>(() => {
    const out: LiveRowTextSample[] = [];
    for (const group of dateGroups) {
      for (const tx of group.items) {
        const isTransfer = Boolean(tx.transferLeg) || isTransferTransaction(tx);
        const isTransferIn = tx.transferLeg === 'in';
        const isTransferOut = tx.transferLeg === 'out';
        const legLedger = normalizeLedgerName(tx.ledger);
        const fromLedger = isTransferIn
          ? tx.counterpartyLedger || 'Default'
          : legLedger;
        const toLedger = isTransferOut
          ? tx.counterpartyLedger || normalizeLedgerName(tx.to_ledger)
          : legLedger;
        const cat = categoryLabel(tx);
        const rowCatLabel = isTransferIn
          ? '转账/转入'
          : isTransferOut
          ? '转账/转出'
          : cat || '—';
        const noteText = hasFullAccess
          ? (tx.title || '').trim()
          : tx.title
          ? '***'
          : '';
        const transferLedgerLabel = isTransferOut
          ? fromLedger
          : isTransferIn
          ? toLedger
          : legLedger;

        out.push({
          isTransfer,
          isNonDefaultLedger: legLedger !== 'Default',
          memberName: tx.member || '默认',
          categoryLabel: rowCatLabel,
          noteLabel: isTransfer ? transferLedgerLabel : noteText,
          amountLabel: hasFullAccess ? formatCurrency(tx.amount, true, false) : '***.**',
        });
      }
    }
    return out;
  }, [dateGroups, hasFullAccess]);

  const { hideWho } = useLiveColumnWidths(liveListRef, liveRowSamples);

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
  const ledgerTitleSuffix =
    selectedLedger === 'ALL'
      ? ' · 全部账本'
      : selectedLedger !== 'Default'
      ? ` · ${selectedLedger}`
      : '';
  const monthTitleSuffix = selectedMonth ? ` · ${formatMonthTab(selectedMonth)}` : '';

  return (
    <div className="pt-desk">
      {/* ── Window 1: Main Overview (Matches exe.v2core.com/stats top window) ── */}
      <PlatinumWindow
        title={`Ledger${ledgerTitleSuffix}${monthTitleSuffix}`}
        onClose={onRefresh}
        closeTitle="刷新数据"
      >
        {/* Ledger & Date Range Strip */}
        <div className="pt-strip">
          <PlatinumSelect
            value={selectedLedger}
            options={ledgerOptions}
            onChange={handleLedgerChange}
            ariaLabel="选择账本"
            placeholder="全部账本"
            minWidth={76}
            compact
          />
          <PlatinumSelect
            value={selectedMonth}
            options={yearMonthOptions}
            onChange={handleYearMonthChange}
            ariaLabel="选择年月"
            placeholder={allMonths.length > 0 ? '选择年月' : '暂无数据'}
            minWidth={98}
            compact
          />

          <span
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#333',
              whiteSpace: 'nowrap',
            }}
          >
            <button type="button" className="pt-btn compact" onClick={onOpenAdmin}>
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
                类型{' '}
                <b>
                  {filters.type === 'EXPENSE'
                    ? '仅支出'
                    : filters.type === 'INCOME'
                    ? '仅收入'
                    : '仅转账'}
                </b>
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
              <SlotNumber
                text={maskVal(-stats.totalExpense)}
                animate={entryAnimating && hasFullAccess}
                delayMs={0}
                durationMs={560}
              />
            </div>
          </div>

          <div className="pt-tile">
            <div className="tl">收入</div>
            <div
              className="tv"
              style={{ color: hasFullAccess ? 'var(--income)' : '#666' }}
            >
              <SlotNumber
                text={maskVal(stats.totalIncome, true)}
                animate={entryAnimating && hasFullAccess}
                delayMs={60}
                durationMs={560}
              />
            </div>
          </div>
        </div>
      </PlatinumWindow>

      {/* ── Window 2: Category Breakdown ── */}
      <PlatinumWindow title="分类统计 · Categories">
        <div className="pt-rows" data-category-summary>
          {categoryRows.length === 0 ? (
            <div className="none">{isAllMonths ? '暂无分类数据' : '本月暂无分类数据'}</div>
          ) : (
            categoryRows.map((item, idx) => {
              const isSelected = filters.category === item.name;
              const catAmtText = hasFullAccess ? formatCurrency(item.netTotal, true, false) : '***.**';
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
                    <SlotNumber
                      text={catAmtText}
                      animate={entryAnimating && hasFullAccess && idx < 20}
                      delayMs={Math.min(idx * 22, 220)}
                      durationMs={500}
                    />
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
          {visibleTypeTabs.map((tp) => {
            const label =
              tp === 'ALL'
                ? '全部'
                : tp === 'EXPENSE'
                ? '支出'
                : tp === 'INCOME'
                ? '收入'
                : '转账';
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

        <div ref={liveListRef} className={`pt-live-list${hideWho ? ' no-who' : ''}`}>
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
                    const isTransfer = Boolean(tx.transferLeg) || isTransferTransaction(tx);
                    const isTransferIn = tx.transferLeg === 'in';
                    const isTransferOut = tx.transferLeg === 'out';
                    const legLedger = normalizeLedgerName(tx.ledger);
                    const fromLedger = isTransferIn
                      ? tx.counterpartyLedger || 'Default'
                      : legLedger;
                    const toLedger = isTransferOut
                      ? tx.counterpartyLedger || normalizeLedgerName(tx.to_ledger)
                      : legLedger;
                    const isNonDefaultLedger = legLedger !== 'Default';
                    const cat = categoryLabel(tx);
                    const rowCatLabel = isTransferIn
                      ? '转账/转入'
                      : isTransferOut
                      ? '转账/转出'
                      : cat || '—';
                    const memberName = tx.member || '默认';
                    const noteText = hasFullAccess
                      ? (tx.title || '').trim()
                      : tx.title
                      ? '***'
                      : '';
                    const dotColor =
                      memberColorMap.get(memberName) ?? memberDotColor(memberName);
                    const transferRoute = `${fromLedger} -> ${toLedger}`;
                    const transferLedgerLabel = isTransferOut
                      ? fromLedger
                      : isTransferIn
                      ? toLedger
                      : legLedger;
                    const amountColor = !hasFullAccess
                      ? '#777'
                      : tx.amount >= 0
                      ? 'var(--income)'
                      : 'var(--expense)';

                    return (
                      <React.Fragment key={tx.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-expanded={isActive}
                          className={`pt-live-row${isActive ? ' active' : ''}${
                            isNonDefaultLedger ? ' non-default-ledger' : ''
                          }`}
                          onClick={() => setExpandedId((prev) => (prev === tx.id ? null : tx.id))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setExpandedId((prev) => (prev === tx.id ? null : tx.id));
                            }
                          }}
                        >
                          {isTransfer ? (
                            <span className="who" aria-hidden="true" />
                          ) : (
                            <span className="who" title={memberName}>
                              <PixelDot color={dotColor} />
                              <span>{memberName}</span>
                            </span>
                          )}

                          <span className="cc" title={rowCatLabel}>
                            {rowCatLabel}
                          </span>

                          <span
                            className="pg"
                            title={isTransfer ? transferLedgerLabel : noteText || undefined}
                          >
                            {isTransfer ? (
                              <span className="pt-transfer-route">{transferLedgerLabel}</span>
                            ) : (
                              noteText
                            )}
                          </span>

                          <span
                            className="amt"
                            style={{ color: amountColor }}
                            title={hasFullAccess ? '点击复制金额' : undefined}
                            onClick={(e) => void handleCopyAmount(e, tx.id, tx.amount)}
                          >
                            {copiedId === tx.id ? (
                              '已复制'
                            ) : (
                              <SlotNumber
                                text={
                                  hasFullAccess
                                    ? formatCurrency(tx.amount, true, false)
                                    : '***.**'
                                }
                                animate={
                                  entryAnimating &&
                                  hasFullAccess &&
                                  (rowIndexMap.get(tx.id) ?? 999) < 24
                                }
                                delayMs={Math.min((rowIndexMap.get(tx.id) ?? 0) * 16, 260)}
                                durationMs={480}
                              />
                            )}
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
                              <b style={{ fontSize: 12 }}>
                                {noteText ||
                                  (isTransfer ? `${rowCatLabel} · ${transferLedgerLabel}` : cat) ||
                                  '交易详情'}
                              </b>
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
                              {!isTransfer && (
                                <div>
                                  <span style={{ color: '#666' }}>成员: </span>
                                  <b>{tx.member || '—'}</b>
                                </div>
                              )}
                              <div>
                                <span style={{ color: '#666' }}>类型: </span>
                                <b>
                                  {isTransferIn
                                    ? '转账 · 收入（转入）'
                                    : isTransferOut
                                    ? '转账 · 支出（转出）'
                                    : tx.amount >= 0
                                    ? '收入'
                                    : '支出'}
                                </b>
                              </div>
                              <div>
                                <span style={{ color: '#666' }}>分类: </span>
                                <b>{cat || rowCatLabel}</b>
                              </div>
                              <div>
                                <span style={{ color: '#666' }}>账本: </span>
                                <span>{legLedger}</span>
                              </div>
                              {isTransfer && (
                                <div>
                                  <span style={{ color: '#666' }}>转账路径: </span>
                                  <span>{transferRoute}</span>
                                </div>
                              )}
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
                              ID: {tx.sourceId || tx.id}
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
            净计:{' '}
            <SlotNumber
              text={maskVal(stats.netBalance, true)}
              animate={entryAnimating && hasFullAccess}
              delayMs={100}
              durationMs={560}
            />
          </b>
          <span
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
            }}
          >
            <PixelDot color={isAdmin ? '#333399' : hasFullAccess ? '#336633' : '#999999'} />
            {accessBadge}
          </span>
        </div>
      </PlatinumWindow>
    </div>
  );
};
