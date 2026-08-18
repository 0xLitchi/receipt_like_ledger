import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Transaction, SummaryStats } from './types';
import { storage } from './utils/storage';
import { ReceiptView } from './components/Receipt/ReceiptView';
import { FilterBar } from './components/FilterBar';
import { AdminAuthModal } from './components/Admin/AdminAuthModal';
import { AdminPanel } from './components/Admin/AdminPanel';

export function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasFullAccess, setHasFullAccess] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  // 强制白天模式
  useEffect(() => {
    document.body.classList.remove('mode-night');
    document.body.classList.add('mode-day');
  }, []);

  // 弹窗控制
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // 1. 加载交易数据 (自动透传已验证的管理员 Header 或 URL Token)
  const loadData = async () => {
    setLoading(true);
    const result = await storage.getTransactions();
    setTransactions(result.data);
    setHasFullAccess(result.hasFullAccess);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // 动态提取最近三个月 YYYY-MM
  const recentMonths = useMemo(() => {
    const monthSet = new Set<string>();

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    for (let i = 0; i < 3; i++) {
      const d = new Date(curYear, curMonth - 1 - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      monthSet.add(`${y}-${m}`);
    }

    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        monthSet.add(t.date.substring(0, 7));
      }
    });

    return Array.from(monthSet).sort().reverse().slice(0, 3);
  }, [transactions]);

  // 选中的月份
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    if (recentMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(recentMonths[0]);
    }
  }, [recentMonths, selectedMonth]);

  // 按选中月份过滤
  const filteredTransactions = useMemo(() => {
    if (!selectedMonth) return transactions;
    return transactions.filter((t) => t.date && t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // 统计数值
  const stats: SummaryStats = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((t) => {
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
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // 2. 快捷触发后台模式（按 "." 键触发）
  const handleAdminToggle = useCallback(() => {
    if (storage.getSavedAdminPassword()) {
      setShowAdminPanel(true);
    } else {
      setShowAuthModal(true);
    }
  }, []);

  // 全局键盘监听 "." 按键触发后台
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === '.' || e.code === 'Period' || e.code === 'NumpadDecimal') {
        e.preventDefault();
        handleAdminToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAdminToggle]);

  // Excel 批量保存处理
  const handleBatchSave = async (items: Transaction[], deletedIds: string[]) => {
    await storage.batchSaveTransactions(items, deletedIds);
    await loadData();
  };

  const handleAdminLogout = () => {
    storage.logoutAdmin();
    setShowAdminPanel(false);
    loadData();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-6 px-3 font-mono selection:bg-slate-700 selection:text-white relative">
      {/* 机械滑块月份切换器 */}
      <FilterBar
        selectedMonth={selectedMonth || (recentMonths[0] || '')}
        onSelectMonth={setSelectedMonth}
        recentMonths={recentMonths}
      />

      {/* 拟物化购物小票展示区 */}
      <main className="w-full max-w-md mx-auto">
        {loading ? (
          <div className="py-20 text-center font-mono text-slate-500 text-xs">
            加载小票中...
          </div>
        ) : (
          <ReceiptView
            transactions={filteredTransactions}
            stats={stats}
            selectedMonth={selectedMonth || (recentMonths[0] || '')}
            hasFullAccess={hasFullAccess}
          />
        )}
      </main>

      {/* 管理员验证弹窗 (按 "." 键触发) */}
      <AdminAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={async () => {
          setShowAuthModal(false);
          setShowAdminPanel(true);

          // 核心优化 2：管理员验证成功后，自动重新加载数据，全额解密明细与金额！
          await loadData();
        }}
      />

      {/* Excel 风格后台数据批量管理面板 */}
      <AdminPanel
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        transactions={transactions}
        onBatchSave={handleBatchSave}
        onLogout={handleAdminLogout}
      />
    </div>
  );
}

export default App;
