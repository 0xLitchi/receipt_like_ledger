import React, { useState, useEffect, useMemo } from 'react';
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
import { PieChart as PieIcon, BarChart2, List } from 'lucide-react';

interface CategorySummaryProps {
  transactions: Transaction[];
  hasFullAccess?: boolean;
  isPrinting?: boolean;
  themeStyle?: 'receipt' | 'tractor' | 'passbook' | 'vfd' | 'boarding_pass';
}

// 主题专属图表调色板
const THEME_PALETTES = {
  receipt: ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'],
  tractor: ['#0f766e', '#0369a1', '#1d4ed8', '#4338ca', '#6b21a8', '#991b1b'],
  passbook: ['#7f1d1d', '#991b1b', '#b91c1c', '#c2410c', '#b45309', '#15803d'],
  vfd: ['#00f0ff', '#14ffec', '#00e5a3', '#39ff14', '#00b4d8', '#38bdf8'],
  boarding_pass: ['#1d4ed8', '#dc2626', '#0284c7', '#d97706', '#475569', '#2563eb'],
};

export const CategorySummary: React.FC<CategorySummaryProps> = ({
  transactions,
  hasFullAccess = true,
  isPrinting = false,
  themeStyle = 'receipt',
}) => {
  // 视图切换：默认 'list' (列表视图)，支持 'pie' (环形饼图) | 'bar' (柱状图)
  const [viewType, setViewType] = useState<'pie' | 'bar' | 'list'>('list');
  // 激活的扇区索引
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // 进场/切换月份进度条过渡动画
  const [isAnimated, setIsAnimated] = useState(false);

  // 监听 transactions 与视图切换，触发进度条从 0 到目标的平滑过渡
  useEffect(() => {
    setIsAnimated(false);
    const timer = setTimeout(() => {
      setIsAnimated(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [transactions, viewType]);

  // 按分类汇总金额，并按分类名称拼音/字符升序排序
  const categories = useMemo(() => {
    const categoryMap = new Map<string, number>();
    let totalAbsSum = 0;

    transactions.forEach((t) => {
      let key = t.category || '其它';
      if (t.category === '杂项') {
        key = t.subcategory ? `杂项/${t.subcategory}` : '杂项';
      }

      const val = hasFullAccess ? t.amount : 0;
      const current = categoryMap.get(key) || 0;
      categoryMap.set(key, current + val);
      totalAbsSum += Math.abs(val);
    });

    const catList = Array.from(categoryMap.entries())
      .map(([name, netTotal]) => {
        const absVal = Math.abs(netTotal);
        const rawRatio = totalAbsSum > 0 ? (absVal / totalAbsSum) * 100 : 0;
        const ratio = Math.round(rawRatio);
        const barWidth = netTotal !== 0 ? Math.max(2.5, Math.min(100, rawRatio)) : 0;
        const ratioText = rawRatio > 0 && rawRatio < 1 ? '<1%' : `${ratio}%`;

        return {
          name,
          netTotal,
          absVal,
          value: absVal,
          rawRatio,
          ratio,
          barWidth,
          ratioText,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')); // 按分类名称排序

    return catList;
  }, [transactions, hasFullAccess]);

  const palette = THEME_PALETTES[themeStyle] || THEME_PALETTES.receipt;

  if (categories.length === 0) return null;

  // 自定义 交互 Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/90 text-white px-3 py-2 rounded-lg text-xs font-mono shadow-xl border border-slate-700 backdrop-blur-sm z-50">
          <div className="font-bold flex items-center justify-between gap-3">
            <span>{data.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3 mt-1 font-mono">
            <span className={`font-bold ${data.netTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ￥{data.netTotal.toFixed(2)}
            </span>
            <span className="text-amber-400 font-bold">{data.ratioText}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="my-3 p-3 border-2 border-current rounded-xl text-left font-pixel text-xs space-y-2 bg-current/5 shadow-xs select-none">
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-center gap-3 border-b border-current/25 pb-2 font-pixel">
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
        // ==================== 1. 列表视图 (按分类名称排序 + 进场平滑过渡条) ====================
        <div className="space-y-2 pt-0.5">
          {categories.map((item, index) => {
            const color = palette[index % palette.length];
            return (
              <div key={item.name} className="space-y-1 group">
                <div className="flex justify-between items-center font-pixel text-xs">
                  {/* 分类名称与调色圆点 */}
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0 border border-black/20 opacity-80"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-bold truncate">{item.name}</span>
                    <span className="text-[10px] font-mono opacity-60 shrink-0">
                      ({item.ratioText})
                    </span>
                  </div>

                  {/* 汇总金额 */}
                  <span className="font-black tracking-tight shrink-0 font-mono">
                    <AnimatedNumber
                      value={item.netTotal}
                      hasFullAccess={hasFullAccess}
                      isPrinting={isPrinting}
                      className={item.netTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'}
                    />
                  </span>
                </div>

                {/* 占比进度条 (平滑从无到有过渡) */}
                <div className="w-full h-1.5 bg-current/15 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out min-w-0 ${
                      item.netTotal >= 0 ? 'bg-emerald-600/80' : 'bg-rose-600/80'
                    }`}
                    style={{
                      width: isAnimated ? `${item.barWidth}%` : '0%',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : viewType === 'pie' ? (
        // ==================== 2. 交互式环形饼图 (Recharts PieChart) ====================
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="w-36 h-36 relative shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Pie
                  data={categories}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={56}
                  paddingAngle={3}
                  dataKey="value"
                  onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {categories.map((_, index) => (
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
          </div>

          {/* 右侧 Legend 图例与百分比列表 */}
          <div className="flex-1 w-full space-y-1.5 overflow-y-auto max-h-36 pr-1 font-pixel text-xs">
            {categories.map((item, index) => {
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
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[11px] opacity-75">{item.ratioText}</span>
                    <span className={`font-bold font-mono ${item.netTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      ￥{item.netTotal.toFixed(2)}
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
                data={categories}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fill: 'currentColor', fontSize: 11 }} width={64} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {categories.map((_, index) => (
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
