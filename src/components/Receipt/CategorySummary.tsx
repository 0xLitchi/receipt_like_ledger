import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Transaction } from '../../types';
import { AnimatedNumber } from './AnimatedNumber';
import { PieChart as PieIcon, BarChart2, List, TrendingDown, TrendingUp } from 'lucide-react';

interface CategorySummaryProps {
  transactions: Transaction[];
  hasFullAccess?: boolean;
  isPrinting?: boolean;
  themeStyle?: 'receipt' | 'gameboy' | 'wallet' | 'tractor';
}

// 主题专属图表调色板
const THEME_PALETTES = {
  receipt: ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'],
  gameboy: ['#1b381b', '#2b582b', '#3d6c3d', '#4c7c4c', '#609060', '#7aa07a'],
  wallet: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'],
  tractor: ['#0f766e', '#0369a1', '#1d4ed8', '#4338ca', '#6b21a8', '#991b1b'],
};

export const CategorySummary: React.FC<CategorySummaryProps> = ({
  transactions,
  hasFullAccess = true,
  isPrinting = false,
  themeStyle = 'receipt',
}) => {
  // 视图切换：默认 'list' (列表视图)，支持 'pie' (环形饼图) | 'bar' (柱状图)
  const [viewType, setViewType] = useState<'pie' | 'bar' | 'list'>('list');
  // 收支方向：'expense' (支出) | 'income' (收入) - 用于 Pie/Bar 图表视图
  const [activeDirection, setActiveDirection] = useState<'expense' | 'income'>('expense');
  // 激活的扇区索引
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 1. 数据统计处理：支出与收入完全独立计算，小金额优化比例尺与最小 2.5% 渲染条
  const { expenses, incomes, grandExpenseTotal, grandIncomeTotal } = useMemo(() => {
    const expenseMap = new Map<string, { total: number; count: number }>();
    const incomeMap = new Map<string, { total: number; count: number }>();

    let gExpense = 0;
    let gIncome = 0;

    transactions.forEach((t) => {
      let key = t.category || '其它';
      if (t.category === '杂项') {
        key = t.subcategory ? `杂项/${t.subcategory}` : '杂项';
      }

      const val = hasFullAccess ? t.amount : 0;
      if (val < 0) {
        gExpense += Math.abs(val);
        const prev = expenseMap.get(key) || { total: 0, count: 0 };
        expenseMap.set(key, { total: prev.total + Math.abs(val), count: prev.count + 1 });
      } else if (val > 0) {
        gIncome += val;
        const prev = incomeMap.get(key) || { total: 0, count: 0 };
        incomeMap.set(key, { total: prev.total + val, count: prev.count + 1 });
      }
    });

    const expList = Array.from(expenseMap.entries())
      .map(([name, stat]) => {
        const rawRatio = gExpense > 0 ? (stat.total / gExpense) * 100 : 0;
        const ratio = Math.round(rawRatio);
        const barWidth = stat.total > 0 ? Math.max(2.5, Math.min(100, rawRatio)) : 0;
        const ratioText = rawRatio > 0 && rawRatio < 1 ? '<1%' : `${ratio}%`;

        return {
          name,
          value: stat.total,
          displayTotal: -stat.total,
          count: stat.count,
          rawRatio,
          ratio,
          barWidth,
          ratioText,
        };
      })
      .sort((a, b) => b.value - a.value);

    const incList = Array.from(incomeMap.entries())
      .map(([name, stat]) => {
        const rawRatio = gIncome > 0 ? (stat.total / gIncome) * 100 : 0;
        const ratio = Math.round(rawRatio);
        const barWidth = stat.total > 0 ? Math.max(2.5, Math.min(100, rawRatio)) : 0;
        const ratioText = rawRatio > 0 && rawRatio < 1 ? '<1%' : `${ratio}%`;

        return {
          name,
          value: stat.total,
          displayTotal: stat.total,
          count: stat.count,
          rawRatio,
          ratio,
          barWidth,
          ratioText,
        };
      })
      .sort((a, b) => b.value - a.value);

    return {
      expenses: expList,
      incomes: incList,
      grandExpenseTotal: gExpense,
      grandIncomeTotal: gIncome,
    };
  }, [transactions, hasFullAccess]);

  const activeData = activeDirection === 'expense' ? expenses : incomes;
  const palette = THEME_PALETTES[themeStyle] || THEME_PALETTES.receipt;

  if (expenses.length === 0 && incomes.length === 0) return null;

  // 自定义 交互 Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/90 text-white px-3 py-2 rounded-lg text-xs font-mono shadow-xl border border-slate-700 backdrop-blur-sm z-50">
          <div className="font-bold flex items-center justify-between gap-3">
            <span>{data.name}</span>
            <span className="text-slate-400 text-[10px]">({data.count}笔)</span>
          </div>
          <div className="flex items-center justify-between gap-3 mt-1 font-mono">
            <span className="text-amber-400 font-bold">￥{Math.abs(data.value).toFixed(2)}</span>
            <span className="text-emerald-400 font-bold">{data.ratioText}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="my-3 p-3 border-2 border-current rounded-xl text-left font-pixel text-xs space-y-2 bg-current/5 shadow-xs select-none">
      {/* 顶部控制栏 (居中显示图表切换按钮，已移除“分类汇总明细”标题) */}
      <div className="flex items-center justify-center gap-3 border-b border-current/25 pb-2 font-pixel">
        {/* 仅在 图表模式 (Pie / Bar) 下显示 支出/收入 单选切换 */}
        {viewType !== 'list' && (
          <div className="flex items-center gap-1 bg-current/10 p-0.5 rounded-lg border border-current/20">
            {expenses.length > 0 && (
              <button
                onClick={() => {
                  setActiveDirection('expense');
                  setActiveIndex(null);
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  activeDirection === 'expense'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-current opacity-70 hover:opacity-100'
                }`}
              >
                <TrendingDown className="w-3 h-3" />
                <span>支出 ({expenses.length})</span>
              </button>
            )}

            {incomes.length > 0 && (
              <button
                onClick={() => {
                  setActiveDirection('income');
                  setActiveIndex(null);
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  activeDirection === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-current opacity-70 hover:opacity-100'
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                <span>收入 ({incomes.length})</span>
              </button>
            )}
          </div>
        )}

        {/* 居中对齐的视图模式切换 */}
        <div className="flex items-center gap-1 bg-current/10 p-0.5 rounded-lg border border-current/20">
          <button
            onClick={() => setViewType('list')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewType === 'list' ? 'bg-current/20 opacity-100 font-bold' : 'opacity-50 hover:opacity-100'
            }`}
            title="列表视图"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setViewType('pie')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewType === 'pie' ? 'bg-current/20 opacity-100 font-bold' : 'opacity-50 hover:opacity-100'
            }`}
            title="环形饼图"
          >
            <PieIcon className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setViewType('bar')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              viewType === 'bar' ? 'bg-current/20 opacity-100 font-bold' : 'opacity-50 hover:opacity-100'
            }`}
            title="柱状图"
          >
            <BarChart2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 核心展示区域 */}
      {viewType === 'list' ? (
        // ==================== 1. 列表视图 (默认显示：收入和支出同时展示，无需点按钮切换) ====================
        <div className="space-y-2 pt-0.5">
          {/* 支出列表 */}
          {expenses.map((item) => (
            <div key={`exp_${item.name}`} className="space-y-0.5">
              <div className="flex justify-between items-center font-pixel text-xs">
                <span className="font-bold">
                  {item.name} <span className="opacity-60 text-[10px]">({item.count}笔)</span>
                </span>
                <span className="font-black tracking-tight">
                  <AnimatedNumber
                    value={item.displayTotal}
                    hasFullAccess={hasFullAccess}
                    isPrinting={isPrinting}
                    className="text-rose-700"
                  />
                </span>
              </div>

              <div className="w-full h-1.5 bg-current/15 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-rose-600/80 rounded-full transition-all duration-500 min-w-[3px]"
                  style={{ width: `${item.barWidth}%` }}
                />
              </div>
            </div>
          ))}

          {/* 收入列表 */}
          {incomes.map((item) => (
            <div key={`inc_${item.name}`} className="space-y-0.5">
              <div className="flex justify-between items-center font-pixel text-xs">
                <span className="font-bold">
                  {item.name} <span className="opacity-60 text-[10px]">({item.count}笔)</span>
                </span>
                <span className="font-black tracking-tight">
                  <AnimatedNumber
                    value={item.displayTotal}
                    hasFullAccess={hasFullAccess}
                    isPrinting={isPrinting}
                    className="text-emerald-700"
                  />
                </span>
              </div>

              <div className="w-full h-1.5 bg-current/15 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-600/80 rounded-full transition-all duration-500 min-w-[3px]"
                  style={{ width: `${item.barWidth}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : activeData.length === 0 ? (
        <div className="py-6 text-center text-xs opacity-50 font-pixel">
          暂无{activeDirection === 'expense' ? '支出' : '收入'}数据
        </div>
      ) : viewType === 'pie' ? (
        // ==================== 2. 交互式环形饼图 (Recharts PieChart) ====================
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="w-36 h-36 relative shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Pie
                  data={activeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={56}
                  paddingAngle={3}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {activeData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={palette[index % palette.length]}
                      stroke="currentColor"
                      strokeWidth={1}
                      style={{
                        transform: activeIndex === index ? 'scale(1.06)' : 'scale(1)',
                        transformOrigin: 'center center',
                        transition: 'transform 0.2s ease-in-out',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* 环形图中心文本 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-[9px] opacity-60 font-pixel">
                {activeDirection === 'expense' ? '总支出' : '总收入'}
              </span>
              <span className="text-[11px] font-black tracking-tighter">
                ￥{Math.abs(activeDirection === 'expense' ? grandExpenseTotal : grandIncomeTotal).toFixed(0)}
              </span>
            </div>
          </div>

          {/* 右侧 Legend 图例与百分比列表 */}
          <div className="flex-1 w-full space-y-1.5 overflow-y-auto max-h-36 pr-1 font-pixel text-xs">
            {activeData.map((item, index) => {
              const color = palette[index % palette.length];
              const isHovered = activeIndex === index;
              return (
                <div
                  key={item.name}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  className={`flex items-center justify-between p-1 rounded transition-colors cursor-pointer ${
                    isHovered ? 'bg-current/10 font-bold' : 'hover:bg-current/5'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{item.name}</span>
                    <span className="opacity-50 text-[10px]">({item.count})</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[11px] opacity-75">{item.ratioText}</span>
                    <span className={`font-bold font-mono ${item.displayTotal > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      ￥{Math.abs(item.displayTotal).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // ==================== 3. 交互式水平柱状图 (Recharts BarChart) ====================
        <div className="pt-2 font-pixel">
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeData}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fill: 'currentColor', fontSize: 11 }} width={64} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {activeData.map((_, index) => (
                    <Cell key={`bar-${index}`} fill={palette[index % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
