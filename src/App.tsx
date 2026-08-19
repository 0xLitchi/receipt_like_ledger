import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Transaction, SummaryStats } from './types';
import { storage, type FxSettingKey, type GlobalSettings, type ThemeStyle } from './utils/storage';
import { ReceiptView } from './components/Receipt/ReceiptView';
import { GameBoyView } from './components/GameBoy/GameBoyView';
import { WalletView } from './components/Wallet/WalletView';
import { TractorPaperView } from './components/Tractor/TractorPaperView';
import { FilterBar } from './components/FilterBar';
import { AdminAuthModal } from './components/Admin/AdminAuthModal';
import { AdminPanel } from './components/Admin/AdminPanel';
import { SoundFx } from './components/Fx/SoundFx';
import { PaperRain } from './components/Fx/PaperRain';
import { CoinRain } from './components/Fx/CoinRain';

export function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasFullAccess, setHasFullAccess] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  // UI 界面风格状态 ('receipt' | 'gameboy' | 'wallet' | 'tractor')
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>(() => storage.getThemeStyle());
  const [fxSettings, setFxSettings] = useState<GlobalSettings>({
    themeStyle: storage.getThemeStyle(),
    fxSound: true,
    fxPaperRain: true,
    fxCoinRain: true,
  });

  // 强制白天模式
  useEffect(() => {
    document.body.classList.remove('mode-night');
    document.body.classList.add('mode-day');
  }, []);

  // 加载服务端持久化的全局设置（主题 + 特效开关，管理员配置后所有访客延续）
  useEffect(() => {
    let cancelled = false;
    storage.getGlobalSettings().then((settings) => {
      if (cancelled) return;
      setThemeStyle(settings.themeStyle);
      setFxSettings(settings);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 弹窗与视图控制
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // 1. 加载交易数据
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

  // 当前是否具备管理员凭证
  const isAdmin = !!storage.getAdminToken();

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
    if (storage.getAdminToken()) {
      setShowAdminPanel(true);
    } else {
      setShowAuthModal(true);
    }
  }, []);

  // 主题切换：本地立即生效 + 服务端持久化
  const handleThemeStyleChange = useCallback(async (style: ThemeStyle) => {
    setThemeStyle(style);
    storage.setThemeStyle(style);
    await storage.setGlobalSetting('themeStyle', style);
  }, []);

  // 特效开关：本地立即生效 + 服务端持久化
  const handleFxSettingChange = useCallback((key: FxSettingKey, value: boolean) => {
    setFxSettings((prev) => {
      const next = { ...prev, [key]: value };
      storage.setGlobalSetting(key, value ? 'on' : 'off');
      return next;
    });
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

  const handleAdminLogout = async () => {
    await storage.logoutAdmin();
    setShowAdminPanel(false);
    loadData();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-6 px-3 font-mono selection:bg-slate-700 selection:text-white relative">
      {/* 背景特效：硬币雨（低透明度背景层） */}
      <CoinRain enabled={fxSettings.fxCoinRain} />

      {/* 拟物音效与纸片飘落 */}
      <SoundFx enabled={fxSettings.fxSound} trigger={selectedMonth || (recentMonths[0] || '')} />
      <PaperRain enabled={fxSettings.fxPaperRain} trigger={selectedMonth || (recentMonths[0] || '')} />

      {/* 纯粹拟物化月份滑动切换控件 */}
      <FilterBar
        selectedMonth={selectedMonth || (recentMonths[0] || '')}
        onSelectMonth={setSelectedMonth}
        recentMonths={recentMonths}
      />

      {/* 动态 4 大 UI 主题展示区 */}
      <main className="w-full max-w-md mx-auto relative z-10">
        {loading ? (
          <div className="py-20 text-center font-mono text-slate-500 text-xs">
            加载中...
          </div>
        ) : themeStyle === 'gameboy' ? (
          <GameBoyView
            transactions={filteredTransactions}
            stats={stats}
            selectedMonth={selectedMonth || (recentMonths[0] || '')}
            hasFullAccess={hasFullAccess}
            isAdmin={isAdmin}
          />
        ) : themeStyle === 'wallet' ? (
          <WalletView
            transactions={filteredTransactions}
            stats={stats}
            selectedMonth={selectedMonth || (recentMonths[0] || '')}
            hasFullAccess={hasFullAccess}
            isAdmin={isAdmin}
          />
        ) : themeStyle === 'tractor' ? (
          <TractorPaperView
            transactions={filteredTransactions}
            stats={stats}
            selectedMonth={selectedMonth || (recentMonths[0] || '')}
            hasFullAccess={hasFullAccess}
            isAdmin={isAdmin}
          />
        ) : (
          <ReceiptView
            transactions={filteredTransactions}
            stats={stats}
            selectedMonth={selectedMonth || (recentMonths[0] || '')}
            hasFullAccess={hasFullAccess}
            isAdmin={isAdmin}
          />
        )}
      </main>

      {/* 管理员验证弹窗 */}
      <AdminAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={async () => {
          setShowAuthModal(false);
          setShowAdminPanel(true);
          await loadData();
        }}
      />

      {/* Admin Panel 全屏整页后台管理 */}
      <AdminPanel
        isOpen={showAdminPanel}
        onClose={() => {
          setShowAdminPanel(false);
          loadData();
        }}
        transactions={transactions}
        onBatchSave={handleBatchSave}
        onLogout={handleAdminLogout}
        themeStyle={themeStyle}
        onThemeStyleChange={handleThemeStyleChange}
        fxSettings={fxSettings}
        onFxSettingChange={handleFxSettingChange}
      />
    </div>
  );
}

export default App;
