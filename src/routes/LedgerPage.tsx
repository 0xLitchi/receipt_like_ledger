import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokenStore } from '../lib/api-client';
import { queryKeys, useTransactionsQuery } from '../lib/queries';
import { queryClient } from '../lib/query-client';
import {
  buildAvailableLedgers,
  buildAvailableYearMonths,
  matchesLedgerFilter,
  useLedger,
} from '../features/ledger/use-ledger';
import { useLedgerFilters } from '../features/ledger/use-ledger-filters';
import { LedgerDesk } from '../components/Platinum/LedgerDesk';
import { PlatinumWindow } from '../components/Platinum/PlatinumChrome';
import { ReceiptSkeleton } from '../components/ReceiptSkeleton';
import { AdminAuthModal } from '../components/Admin/AdminAuthModal';

export const LedgerPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useTransactionsQuery();
  const { filters, patch } = useLedgerFilters();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const isAdmin = tokenStore.hasSession();

  const transactions = useMemo(() => data?.data ?? [], [data]);
  const hasFullAccess = data?.hasFullAccess ?? true;

  // 兜底：本地存有会话但服务端仍判为脱敏（token 在别处签发、刚好过期、换过部署），
  // 自动重拉一次，避免用户必须手动 F5。只触发一次，防止服务端会话无效时死循环。
  const refetchedForSession = useRef(false);
  useEffect(() => {
    if (refetchedForSession.current) return;
    if (!isAdmin || !data || data.hasFullAccess) return;
    refetchedForSession.current = true;
    void refetch();
  }, [isAdmin, data, refetch]);

  // All available ledgers (Default always included)
  const ledgers = useMemo(() => buildAvailableLedgers(transactions), [transactions]);

  // Ledger-scoped transactions for deriving available years/months and category breakdown
  const ledgerTransactions = useMemo(
    () => transactions.filter((t) => matchesLedgerFilter(t, filters.ledger)),
    [transactions, filters.ledger]
  );

  // Extract all months that actually have transaction data in current ledger scope
  const { allMonths } = useMemo(
    () => buildAvailableYearMonths(ledgerTransactions),
    [ledgerTransactions]
  );

  // Resolve default latest month synchronously to avoid a 1-frame all-months flash on entry
  const effectiveMonth = useMemo(() => {
    if (filters.month === 'ALL' && isAdmin) return 'ALL';
    if (filters.month && allMonths.includes(filters.month)) return filters.month;
    return allMonths[0] || '';
  }, [filters.month, allMonths, isAdmin]);

  const effectiveFilters = useMemo(
    () => (effectiveMonth !== filters.month ? { ...filters, month: effectiveMonth } : filters),
    [filters, effectiveMonth]
  );

  const { stats, dateGroups } = useLedger(transactions, effectiveFilters);

  // Ledger + month scoped transactions (used for Category breakdown & transfer tab visibility)
  const monthTransactions = useMemo(
    () =>
      effectiveMonth && effectiveMonth !== 'ALL'
        ? ledgerTransactions.filter((t) => t.date?.startsWith(effectiveMonth))
        : ledgerTransactions,
    [ledgerTransactions, effectiveMonth]
  );

  // Default to most recent month with data on initial load (preserve 'ALL' for admin)
  useEffect(() => {
    if (filters.month === 'ALL' && isAdmin) return;
    if (allMonths.length > 0 && (!filters.month || !allMonths.includes(filters.month))) {
      patch({ month: allMonths[0] });
    }
  }, [filters.month, allMonths, isAdmin, patch]);

  const openAdmin = useCallback(() => {
    if (tokenStore.hasSession()) navigate('/admin');
    else setShowAuthModal(true);
  }, [navigate]);

  // Global shortcut: "." opens Admin
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === '.' || e.code === 'Period' || e.code === 'NumpadDecimal') {
        e.preventDefault();
        openAdmin();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openAdmin]);

  return (
    <main>
      {isLoading ? (
        <ReceiptSkeleton />
      ) : isError ? (
        <div className="pt-desk" style={{ maxWidth: 480 }}>
          <PlatinumWindow title="Error · 数据加载失败">
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', fontWeight: 'bold', color: 'var(--danger)' }}>
                无法加载账本数据
              </p>
              <p
                style={{
                  margin: '0 0 14px',
                  fontSize: 11,
                  color: '#555',
                  fontFamily: 'var(--font-mono)',
                  wordBreak: 'break-all',
                }}
              >
                {error instanceof Error ? error.message : '未知错误'}
              </p>
              <button type="button" className="pt-btn primary" onClick={() => void refetch()}>
                重试
              </button>
            </div>
          </PlatinumWindow>
        </div>
      ) : (
        <LedgerDesk
          allTransactions={transactions}
          monthTransactions={monthTransactions}
          dateGroups={dateGroups}
          stats={stats}
          ledgers={ledgers}
          allMonths={allMonths}
          filters={filters}
          onPatchFilters={patch}
          hasFullAccess={hasFullAccess}
          isAdmin={isAdmin}
          onOpenAdmin={openAdmin}
          onRefresh={() => void refetch()}
        />
      )}

      <AdminAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          // 登录前缓存的脱敏数据（title='***'、amount=0、hasFullAccess=false）必须丢弃：
          // staleTime 内 AdminPage 与返回的首页都会直接复用它，导致金额仍被遮罩。
          queryClient.removeQueries({ queryKey: queryKeys.transactions });
          navigate('/admin');
        }}
      />
    </main>
  );
};
