import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Transaction, SummaryStats } from './types';
import { storage } from './utils/storage';
import { ReceiptView } from './components/Receipt/ReceiptView';
import { FilterBar } from './components/FilterBar';
import { AdminAuthModal } from './components/Admin/AdminAuthModal';
import { AdminPanel } from './components/Admin/AdminPanel';
import { TransactionFormModal } from './components/Admin/TransactionFormModal';
import { Sun, Moon } from 'lucide-react';

export function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNightMode, setIsNightMode] = useState(false);

  // 8. 切换 Day / Night 模式样式应用到 body
  useEffect(() => {
    if (isNightMode) {
      document.body.classList.remove('mode-day');
      document.body.classList.add('mode-night');
    } else {
      document.body.classList.remove('mode-night');
      document.body.classList.add('mode-day');
    }
  }, [isNightMode]);

  // 弹窗控制
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // 加载交易数据
  const loadData = async () => {
    setLoading(true);
    const data = await storage.getTransactions();
    setTransactions(data);
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

  // 快捷触发后台模式（按 "." 键触发）
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

  // 新增/修改交易
  const handleSaveTransaction = async (txData: Transaction | Omit<Transaction, 'id'>) => {
    if ('id' in txData) {
      await storage.updateTransaction(txData);
    } else {
      await storage.addTransaction(txData);
    }
    await loadData();
  };

  // 删除交易
  const handleDeleteTransaction = async (id: string) => {
    if (confirm('确定要删除该条记录吗？')) {
      await storage.deleteTransaction(id);
      await loadData();
    }
  };

  const handleAdminLogout = () => {
    storage.logoutAdmin();
    setShowAdminPanel(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-6 px-3 font-mono selection:bg-slate-700 selection:text-white relative">
      {/* 8. Day / Night 模式切换按钮 (右上角) */}
      <div className="fixed top-4 right-4 z-40 no-print">
        <button
          onClick={() => setIsNightMode(!isNightMode)}
          className="p-2 rounded-full bg-slate-900/80 border border-slate-700/80 text-slate-200 hover:text-amber-400 backdrop-blur-md shadow-lg transition-all duration-200"
          title={isNightMode ? '切换为白天模式' : '切换为夜间模式'}
        >
          {isNightMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
        </button>
      </div>

      {/* 3. 机械滑块月份切换器 */}
      <FilterBar
        selectedMonth={selectedMonth || (recentMonths[0] || '')}
        onSelectMonth={setSelectedMonth}
        recentMonths={recentMonths}
      />

      {/* 7. 拟物化购物小票展示区 */}
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
            isNightMode={isNightMode}
          />
        )}
      </main>

      {/* 管理员验证弹窗 (按 "." 键触发) */}
      <AdminAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAdminPanel(true);
        }}
      />

      {/* 后台数据管理面板 */}
      <AdminPanel
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        transactions={transactions}
        onAdd={() => {
          setEditingTx(null);
          setShowFormModal(true);
        }}
        onEdit={(t) => {
          setEditingTx(t);
          setShowFormModal(true);
        }}
        onDelete={handleDeleteTransaction}
        onLogout={handleAdminLogout}
      />

      {/* 交易编辑/新增弹窗 */}
      <TransactionFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingTx(null);
        }}
        onSave={handleSaveTransaction}
        initialData={editingTx}
      />
    </div>
  );
}

export default App;
