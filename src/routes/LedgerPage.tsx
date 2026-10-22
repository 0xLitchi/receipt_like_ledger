import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokenStore } from '../lib/api-client';
import { useTransactionsQuery } from '../lib/queries';
import { useLedger } from '../features/ledger/use-ledger';
import { useLedgerFilters } from '../features/ledger/use-ledger-filters';
import { FilterBar } from '../components/FilterBar';
import { ReceiptView } from '../components/Receipt/ReceiptView';
import { ReceiptSkeleton } from '../components/ReceiptSkeleton';
import { AdminAuthModal } from '../components/Admin/AdminAuthModal';

export const LedgerPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useTransactionsQuery();
  const { filters, patch } = useLedgerFilters();

  const [showAuthModal, setShowAuthModal] = useState(false);
  // token 变化后（login/logout）需要重新判断权限；路由切回本页时会重新渲染
  const isAdmin = tokenStore.has();

  const transactions = useMemo(() => data?.data ?? [], [data]);
  const hasFullAccess = data?.hasFullAccess ?? true;

  const { months, stats, dateGroups } = useLedger(transactions, filters);

  // 分类汇总始终基于「当月全量」而非已筛选结果，否则点选分类后汇总面板会自我塌陷
  const monthTransactions = useMemo(
    () => (filters.month ? transactions.filter((t) => t.date?.startsWith(filters.month)) : transactions),
    [transactions, filters.month]
  );

  // URL 里没有月份时，回填最近一个月（用 replace，不污染历史记录）
  useEffect(() => {
    if (!filters.month && months.length > 0) {
      patch({ month: months[0] });
    }
  }, [filters.month, months, patch]);

  const openAdmin = useCallback(() => {
    if (tokenStore.has()) navigate('/admin');
    else setShowAuthModal(true);
  }, [navigate]);

  // 全局快捷键："." 呼出后台
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

  const selectedMonth = filters.month || months[0] || '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-6 pb-10 px-3 font-mono selection:bg-slate-700 selection:text-white relative">
      {/* 月份机械滑块 */}
      <FilterBar
        selectedMonth={selectedMonth}
        onSelectMonth={(m) => patch({ month: m })}
        recentMonths={months}
      />

      {isLoading ? (
        <ReceiptSkeleton />
      ) : isError ? (
        <div className="w-full max-w-md mx-auto my-6 rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center font-mono">
          <p className="text-xs text-rose-400 mb-1">数据加载失败</p>
          <p className="text-[11px] text-slate-500 mb-4 break-all">
            {error instanceof Error ? error.message : '未知错误'}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 text-[11px] font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            重试
          </button>
        </div>
      ) : (
        <main className="w-full max-w-md mx-auto">
          <ReceiptView
            dateGroups={dateGroups}
            transactions={monthTransactions}
            activeCategory={filters.category}
            onSelectCategory={(category) => patch({ category })}
            stats={stats}
            selectedMonth={selectedMonth}
            hasFullAccess={hasFullAccess}
            isAdmin={isAdmin}
          />
        </main>
      )}

      <AdminAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          navigate('/admin');
        }}
      />
    </div>
  );
};
