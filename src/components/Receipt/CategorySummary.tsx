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
import { summaryKey } from '../../features/ledger/use-ledger';
import { AnimatedNumber } from './AnimatedNumber';
import { amountColor } from '../../features/ledger/access-mode';
import { PieChart as PieIcon, BarChart2, List } from 'lucide-react';

interface CategorySummaryProps {
  transactions: Transaction[];
  hasFullAccess?: boolean;
  isPrinting?: boolean;
  /** 当前选中的分类，'ALL' 表示未筛选 */
  activeCategory?: string;
  /** 点击分类后回传给页面，用于联动过滤明细 */
  onSelectCategory?: (category: string) => void;
}

/** 小票主题的墨色阶梯（黑白灰），保证打印质感 */
const RECEIPT_PALETTE = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'];

export const CategorySummary: React.FC<CategorySummaryProps> = ({
  transactions,
  hasFullAccess = true,
  isPrinting = false,
  activeCategory = 'ALL',
  onSelectCategory,
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
      const key = summaryKey(t);

      const val = hasFullAccess ? t.amount : 0;
      const current = categoryMap.get(key) || 0;
      categoryMap.set(key, current + val);
      totalAbsSum += Math.abs(val);
    });

    return Array.from(categoryMap.entries())
      .map(([name, netTotal]) => {
        const absVal = Math.abs(netTotal);
        const rawRatio = totalAbsSum > 0 ? (absVal / totalAbsSum) * 100 : 0;
        const ratio = Math.round(rawRatio);
        const barWidth = netTotal !== 0 ? Math.max(2.5, Math.min(100, rawRatio)) : 0;
        const ratioText = rawRatio > 0 && rawRatio < 1 ? '<1%' : `${ratio}%`;

        return { name, netTotal, absVal, value: absVal, rawRatio, ratio, barWidth, ratioText };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [transactions, hasFullAccess]);

  if (categories.length === 0) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/90 text-white px-3 py-2 rounded-lg text-xs font-mono shadow-xl border border-slate-700 backdrop-blur-sm z-50">
          <div className="font-bold">{data.name}</div>
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
          {(
            [
              { key: 'list', icon: List, title: '列表视图' },
              { key: 'pie', icon: PieIcon, title: '环形饼图' },
              { key: 'bar', icon: BarChart2, title: '柱状图' },
            ] as const
          ).map(({ key, icon: Icon, title }) => (
            <button
              key={key}
              onClick={() => setViewType(key)}
              className={`p-1 rounded transition-colors cursor-pointer ${
                viewType === key ? 'bg-current/20 opacity-100 font-bold' : 'opacity-50 hover:opacity-100'
              }`}
              title={title}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* 1. 列表视图 */}
      {viewType === 'list' && (
        <div className="space-y-2 pt-0.5">
          {categories.map((item) => {
            const isActive = activeCategory === item.name;
            return (
              <button
                key={item.name}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectCategory?.(isActive ? 'ALL' : item.name)}
                className={`block w-full text-left space-y-1 group rounded-md px-1 py-0.5 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-current/40 ${
                  isActive ? 'bg-current/10' : 'hover:bg-current/5'
                }`}
                title={isActive ? '取消分类筛选' : `只看 ${item.name}`}
              >
                <div className="flex justify-between items-center font-pixel text-xs">
                  <div className="flex items-center min-w-0 pr-2">
                    <span className={`truncate ${isActive ? 'font-black underline decoration-dotted underline-offset-2' : 'font-bold'}`}>
                      {item.name}
                    </span>
                  </div>
                  <span className="font-black tracking-tight shrink-0 font-mono">
                    <AnimatedNumber
                      value={item.netTotal}
                      hasFullAccess={hasFullAccess}
                      isPrinting={isPrinting}
                      className={amountColor(item.netTotal)}
                    />
                  </span>
                </div>

                {/* 占比进度条 */}
                <div className="w-full h-1.5 bg-current/15 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out min-w-0 ${
                      item.netTotal >= 0 ? 'bg-emerald-600/80' : 'bg-rose-600/80'
                    }`}
                    style={{ width: isAnimated ? `${item.barWidth}%` : '0%' }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 2. 交互式环形饼图 */}
      {viewType === 'pie' && (
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
                  onClick={(_: unknown, index: number) => {
                    const target = categories[index];
                    if (!target) return;
                    onSelectCategory?.(activeCategory === target.name ? 'ALL' : target.name);
                  }}
                >
                  {categories.map((item, index) => (
                    <Cell
                      key={`cell-${item.name}`}
                      fill={RECEIPT_PALETTE[index % RECEIPT_PALETTE.length]}
                      stroke="currentColor"
                      strokeWidth={activeCategory === item.name ? 2 : 1}
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

          <div className="flex-1 w-full space-y-1.5 overflow-y-auto max-h-36 pr-1 font-pixel text-xs">
            {categories.map((item, index) => {
              const color = RECEIPT_PALETTE[index % RECEIPT_PALETTE.length];
              const isHovered = activeIndex === index;
              const isActive = activeCategory === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  aria-pressed={isActive}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={() => onSelectCategory?.(isActive ? 'ALL' : item.name)}
                  className={`w-full flex items-center justify-between p-1 rounded transition-colors cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-current/40 ${
                    isHovered || isActive ? 'bg-current/10 font-bold' : 'hover:bg-current/5'
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
                    <span className={`font-bold font-mono ${amountColor(item.netTotal)}`}>
                      ￥{item.netTotal.toFixed(2)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. 交互式水平柱状图 */}
      {viewType === 'bar' && (
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
                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  onClick={(data: any) => {
                    const name = data?.name ?? data?.payload?.name;
                    if (!name) return;
                    onSelectCategory?.(activeCategory === name ? 'ALL' : name);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {categories.map((item, index) => (
                    <Cell
                      key={`bar-${item.name}`}
                      fill={RECEIPT_PALETTE[index % RECEIPT_PALETTE.length]}
                      opacity={activeCategory === 'ALL' || activeCategory === item.name ? 1 : 0.35}
                    />
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
