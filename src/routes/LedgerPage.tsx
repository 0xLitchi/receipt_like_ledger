import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokenStore } from '../lib/api-client';
import { queryKeys, useTransactionsQuery } from '../lib/queries';
import { queryClient } from '../lib/query-client';
import { useLedger } from '../features/ledger/use-ledger';
import { useLedgerFilters } from '../features/ledger/use-ledger-filters';
import { FilterBar } from '../components/FilterBar';
import { LedgerFilterBar } from '../components/LedgerFilterBar';
import { ReceiptView } from '../components/Receipt/ReceiptView';
import { ReceiptSkeleton } from '../components/ReceiptSkeleton';
import { AdminAuthModal } from '../components/Admin/AdminAuthModal';
import { CommandPalette } from '../components/CommandPalette';
import { useCommandPalette } from '../hooks/use-keyboard-shortcuts';

interface LedgerPageProps {
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
}

export const LedgerPage: React.FC<LedgerPageProps> = ({ commandOpen, setCommandOpen }) => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch, isFetching } = useTransactionsQuery();
  const { filters, patch, reset, activeCount } = useLedgerFilters();

  const [showAuthModal, setShowAuthModal] = useState(false);
  // token 变化后（login/logout）需要重新判断权限；路由切回本页时会重新渲染
  const isAdmin = tokenStore.has();

  const transactions = useMemo(() => data?.data ?? [], [data]);
  const hasFullAccess = data?.hasFullAccess ?? true;

  const { months, options, stats, dateGroups } = useLedger(transactions, filters);

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

  // 全局快捷键：⌘K 命令面板、"." 呼出后台
  useCommandPalette(commandOpen, setCommandOpen);

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

  const isFiltered = useMemo(
    () => activeCount > 0 || (!!filters.month && filters.month !== (months[0] ?? '')),
    [activeCount, filters.month, months]
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-6 px-3 font-mono selection:bg-slate-700 selection:text-white relative">
      <div className="w-full max-w-md mx-auto mb-1 flex items-center justify-between no-print select-none">
        <span className="text-[10px] font-mono tracking-widest text-slate-500">
          RECEIPT LEDGER
          {isFetching && !isLoading && <span className="ml-1.5 text-slate-600 animate-pulse">刷新中…</span>}
        </span>
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-800 bg-slate-900/70 text-[10px] font-mono text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors cursor-pointer"
        >
          <kbd className="font-mono">⌘K</kbd>
          <span>命令</span>
        </button>
      </div>

      {/* 月份机械滑块 */}
      <FilterBar
        selectedMonth={filters.month || months[0] || ''}
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
        <>
          <LedgerFilterBar
            filters={filters}
            members={options.members}
            categories={options.categories}
            activeCount={activeCount}
            onChange={patch}
            onReset={reset}
          />

          <main className="w-full max-w-md mx-auto">
            <ReceiptView
              dateGroups={dateGroups}
              transactions={monthTransactions}
              activeCategory={filters.category}
              onSelectCategory={(category) => patch({ category })}
              stats={stats}
              selectedMonth={filters.month || months[0] || ''}
              hasFullAccess={hasFullAccess}
              isAdmin={isAdmin}
              isFiltered={isFiltered}
              onResetFilters={() => {
                reset();
                if (months[0]) patch({ month: months[0] });
              }}
            />
          </main>
        </>
      )}

      <AdminAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          // 登录后立刻让旧缓存失效，返回小票页时拿到的就是解密数据
          void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
          navigate('/admin');
        }}
      />

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        transactions={transactions}
        month={filters.month}
        hasFullAccess={hasFullAccess}
        isAdmin={isAdmin}
        onSelectMonth={(m) => patch({ month: m })}
        onSearch={(keyword) => patch({ month: 'ALL', search: keyword })}
        onOpenAdmin={openAdmin}
        onResetFilters={reset}
      />
    </div>
  );
};
