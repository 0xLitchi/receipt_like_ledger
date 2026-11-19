import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokenStore } from '../lib/api-client';
import { useTransactionsQuery } from '../lib/queries';
import { buildAvailableYearMonths, useLedger } from '../features/ledger/use-ledger';
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

  // Extract all years and months that actually have transaction data (no 4-month limit)
  const { years, monthsByYear, allMonths } = useMemo(
    () => buildAvailableYearMonths(transactions),
    [transactions]
  );
  const { stats, dateGroups } = useLedger(transactions, filters);

  // Month-scoped transactions (used for Category breakdown window)
  const monthTransactions = useMemo(
    () =>
      filters.month && filters.month !== 'ALL'
        ? transactions.filter((t) => t.date?.startsWith(filters.month))
        : transactions,
    [transactions, filters.month]
  );

  // Default to most recent month with data on initial load
  useEffect(() => {
    if (allMonths.length > 0 && (!filters.month || !allMonths.includes(filters.month))) {
      patch({ month: allMonths[0] });
    }
  }, [filters.month, allMonths, patch]);

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
          years={years}
          monthsByYear={monthsByYear}
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
          navigate('/admin');
        }}
      />
    </main>
  );
};
