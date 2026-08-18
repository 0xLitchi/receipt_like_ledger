import { useState, useEffect, useMemo } from 'react';
import type { Transaction, FilterState, ThemeType, SummaryStats } from './types';
import { storage } from './utils/storage';
import { ReceiptView } from './components/Receipt/ReceiptView';
import { FilterBar } from './components/FilterBar';
import { AdminAuthModal } from './components/Admin/AdminAuthModal';
import { AdminPanel } from './components/Admin/AdminPanel';
import { TransactionFormModal } from './components/Admin/TransactionFormModal';
import { Receipt, Cloud, ShieldCheck } from 'lucide-react';

export function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeType>('paper-white');
  const [isAdmin, setIsAdmin] = useState(false);

  // 弹窗控制
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // 筛选器状态
  const [filters, setFilters] = useState<FilterState>({
    month: 'ALL',
    member: 'ALL',
    category: 'ALL',
    type: 'ALL',
    search: '',
  });

  // 初始化加载数据
  const loadData = async () => {
    setLoading(true);
    const data = await storage.getTransactions();
    setTransactions(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // 检查本地是否有保存的管理员密码
    if (storage.getSavedAdminPassword()) {
      setIsAdmin(true);
    }
  }, []);

  // 提取月份、人员、分类下拉选项
  const months = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.date) {
        const m = t.date.substring(0, 7);
        set.add(m);
      }
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const members = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.member) set.add(t.member);
    });
    return Array.from(set);
  }, [transactions]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [transactions]);

  // 过滤数据计算
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // 月份过滤
      if (filters.month !== 'ALL' && !t.date.startsWith(filters.month)) {
        return false;
      }
      // 成员过滤
      if (filters.member !== 'ALL' && t.member !== filters.member) {
        return false;
      }
      // 分类过滤
      if (filters.category !== 'ALL' && t.category !== filters.category) {
        return false;
      }
      // 收支类型过滤
      if (filters.type === 'EXPENSE' && t.amount >= 0) return false;
      if (filters.type === 'INCOME' && t.amount < 0) return false;

      // 关键词搜索
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const titleMatch = t.title && t.title.toLowerCase().includes(q);
        const memberMatch = t.member && t.member.toLowerCase().includes(q);
        const categoryMatch = t.category && t.category.toLowerCase().includes(q);
        const subcategoryMatch = t.subcategory && t.subcategory.toLowerCase().includes(q);
        return titleMatch || memberMatch || categoryMatch || subcategoryMatch;
      }

      return true;
    });
  }, [transactions, filters]);

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

  // 处理新增/修改交易
  const handleSaveTransaction = async (txData: Transaction | Omit<Transaction, 'id'>) => {
    if ('id' in txData) {
      await storage.updateTransaction(txData);
    } else {
      await storage.addTransaction(txData);
    }
    await loadData();
  };

  // 处理删除
  const handleDeleteTransaction = async (id: string) => {
    if (confirm('确定要删除该条记账明细吗？此操作无法撤销。')) {
      await storage.deleteTransaction(id);
      await loadData();
    }
  };

  // 快捷重置 Demo
  const handleResetDemo = async () => {
    if (confirm('确定要恢复预设的 9 条 Demo 数据吗？')) {
      const data = await storage.resetToDemo();
      setTransactions(data);
    }
  };

  // 管理员切换控制
  const handleAdminToggle = () => {
    if (isAdmin) {
      setShowAdminPanel(true);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleAdminLogout = () => {
    storage.logoutAdmin();
    setIsAdmin(false);
    setShowAdminPanel(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* 顶部导航 Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 py-3 no-print">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
                购物小票记账本
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full border border-slate-700">
                  CF Pages & D1
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                Receipt-Style Personal Ledger for Cloudflare Pages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 rounded-full text-slate-400 border border-slate-700">
              <Cloud className="w-3.5 h-3.5 text-indigo-400" />
              <span>D1 DATABASE CONNECTED</span>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="font-bold">ADMIN MODE</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {/* 顶部控制栏 */}
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          months={months}
          members={members}
          categories={categories}
          theme={theme}
          onThemeChange={setTheme}
          isAdmin={isAdmin}
          onToggleAdminModal={handleAdminToggle}
          onResetDemo={handleResetDemo}
        />

        {/* 热敏纸小票展示区域 */}
        {loading ? (
          <div className="py-24 text-center font-mono text-slate-400 text-sm">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
            加载小票数据中...
          </div>
        ) : (
          <ReceiptView
            transactions={filteredTransactions}
            stats={stats}
            theme={theme}
            selectedMonth={filters.month}
            selectedMember={filters.member}
            isAdmin={isAdmin}
            onEditTransaction={(t) => {
              setEditingTx(t);
              setShowFormModal(true);
            }}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}
      </main>

      {/* 页脚 Footer */}
      <footer className="w-full border-t border-slate-900 py-6 text-center text-xs text-slate-500 font-mono no-print">
        <div>Receipt Like Ledger &copy; 2026 Powered by Cloudflare Pages & D1</div>
        <div className="text-[10px] opacity-60 mt-1">Built with React, Vite, TypeScript & Tailwind CSS</div>
      </footer>

      {/* 管理员验证弹窗 */}
      <AdminAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setIsAdmin(true);
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
        onImportDemo={handleResetDemo}
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

