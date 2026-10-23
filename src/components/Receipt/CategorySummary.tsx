import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import type { Transaction } from '../../types';
import { summaryKey } from '../../features/ledger/use-ledger';
import { AnimatedNumber } from './AnimatedNumber';
import { amountColor } from '../../features/ledger/access-mode';
import { formatCurrency } from '../../utils/formatters';
import { List, PieChart as PieIcon, BarChart2 } from 'lucide-react';

interface CategorySummaryProps {
  transactions: Transaction[];
  hasFullAccess?: boolean;
  isPrinting?: boolean;
  /** 当前选中的分类，'ALL' 表示未筛选 */
  activeCategory?: string;
  /** 点击分类后回传给页面，用于联动过滤明细 */
  onSelectCategory?: (category: string) => void;
}

/**
 * 小票墨色调色板：由深到浅保持足够阶梯，
 * 相邻扇区也能分辨（旧版六档灰过于接近，扇区糊成一片）。
 */
const RECEIPT_PALETTE = [
  '#0f172a',
  '#3f4a5f',
  '#6b7688',
  '#9aa3b2',
  '#c3c9d3',
  '#e0e4ea',
];

/** 饼图图例最多显示的分类数，超出并入“其他”，避免出现滚动条 */
const LEGEND_LIMIT = 5;

interface CategoryItem {
  name: string;
  netTotal: number;
  absVal: number;
  ratioText: string;
  /** 条形宽度百分比（用于列表与柱状进度） */
  barWidth: number;
}

type ViewType = 'bar' | 'pie' | 'list';

export const CategorySummary: React.FC<CategorySummaryProps> = ({
  transactions,
  hasFullAccess = true,
  isPrinting = false,
  activeCategory = 'ALL',
  onSelectCategory,
}) => {
  // 默认展示条形图：按金额排序后最直观，也最像小票上的分类排行
  const [viewType, setViewType] = useState<ViewType>('bar');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // 进场动画：条形宽度从 0 展开到目标值
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    setIsAnimated(false);
    const timer = window.setTimeout(() => setIsAnimated(true), 40);
    return () => window.clearTimeout(timer);
  }, [transactions, viewType]);

  const { categories, totalAbs } = useMemo(() => {
    const categoryMap = new Map<string, number>();
    let totalAbsSum = 0;

    transactions.forEach((t) => {
      const key = summaryKey(t);
      const value = hasFullAccess ? t.amount : 0;
      categoryMap.set(key, (categoryMap.get(key) || 0) + value);
      totalAbsSum += Math.abs(value);
    });

    const list: CategoryItem[] = Array.from(categoryMap.entries())
      .map(([name, netTotal]) => {
        const absVal = Math.abs(netTotal);
        const rawRatio = totalAbsSum > 0 ? (absVal / totalAbsSum) * 100 : 0;
        const ratio = Math.round(rawRatio);
        const ratioText = rawRatio > 0 && rawRatio < 1 ? '<1%' : `${ratio}%`;
        return {
          name,
          netTotal,
          absVal,
          ratioText,
          barWidth: absVal > 0 ? Math.max(2, Math.min(100, rawRatio)) : 0,
        };
      })
      // 按金额绝对值从大到小：条形图天然按大小阅读，比按名称排序更有信息量
      .sort((a, b) => b.absVal - a.absVal);

    return { categories: list, totalAbs: totalAbsSum };
  }, [transactions, hasFullAccess]);

  // 饼图：超出图例上限时合并尾部为「其他」
  const pieCategories = useMemo(() => {
    if (categories.length <= LEGEND_LIMIT + 1) {
      return categories.map((c) => ({ ...c, value: c.absVal }));
    }
    const head = categories.slice(0, LEGEND_LIMIT);
    const rest = categories.slice(LEGEND_LIMIT);
    const restTotal = rest.reduce((sum, c) => sum + c.absVal, 0);
    return [
      ...head.map((c) => ({ ...c, value: c.absVal })),
      {
        name: `其他 ${rest.length} 项`,
        netTotal: rest.reduce((sum, c) => sum + c.netTotal, 0),
        absVal: restTotal,
        value: restTotal,
        ratioText: `${Math.round((restTotal / Math.max(1, totalAbs)) * 100)}%`,
        barWidth: 0,
        isGrouped: true,
      },
    ];
  }, [categories, totalAbs]);

  if (categories.length === 0) return null;

  // 是否处于「已选中某个分类」的过滤状态，用于淡化其余分类
  const hasSelection = activeCategory !== 'ALL' && categories.some((c) => c.name === activeCategory);

  const showAmount = (value: number) =>
    hasFullAccess ? formatCurrency(value, false, true) : '￥***.**';

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/92 text-white px-3 py-2 rounded-lg text-[0.747em] font-mono shadow-xl border border-slate-700 backdrop-blur-sm z-50">
        <div className="font-bold mb-1">{data.name}</div>
        <div className="flex items-center justify-between gap-3">
          <span className={amountColor(data.netTotal, hasFullAccess)}>{showAmount(data.netTotal)}</span>
          <span className="text-amber-300 font-bold">{data.ratioText}</span>
        </div>
      </div>
    );
  };

  const select = (name: string) => {
    if (name.includes('其他 ')) return; // 合并分组不可点选
    onSelectCategory?.(activeCategory === name ? 'ALL' : name);
  };

  const VIEW_TABS: { key: ViewType; icon: typeof List; title: string }[] = [
    { key: 'bar', icon: BarChart2, title: '分类排行' },
    { key: 'pie', icon: PieIcon, title: '占比环形图' },
    { key: 'list', icon: List, title: '紧凑列表' },
  ];

  return (
    <div className="my-3 p-3 border-2 border-current rounded-xl text-left font-pixel text-[0.815em] space-y-2 bg-current/5 shadow-xs select-none">
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-center gap-3 border-b border-current/25 pb-2">
        <div className="flex items-center gap-1 bg-current/10 p-0.5 rounded-lg border border-current/20">
          {VIEW_TABS.map(({ key, icon: Icon, title }) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewType(key)}
              className={`p-1 rounded transition-colors cursor-pointer ${
                viewType === key ? 'bg-current/20 opacity-100' : 'opacity-50 hover:opacity-100'
              }`}
              title={title}
              aria-pressed={viewType === key}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* 1. 分类排行（横向条形，默认视图） */}
      {viewType === 'bar' && (
        <div className="space-y-2.5 pt-0.5">
          {categories.map((item, index) => {
            const isActive = activeCategory === item.name;
            const dimmed = hasSelection && !isActive;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => select(item.name)}
                aria-pressed={isActive}
                title={isActive ? '取消分类筛选' : `只看 ${item.name}`}
                className={`block w-full text-left rounded-md px-1 py-0.5 transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-current/40 ${
                  isActive ? 'bg-current/10' : dimmed ? 'opacity-35 hover:opacity-70' : 'hover:bg-current/5'
                }`}
              >
                <div className="flex justify-between items-baseline gap-2">
                  <span
                    className={`truncate min-w-0 ${
                      isActive ? 'font-black underline decoration-dotted underline-offset-2' : 'font-bold'
                    }`}
                  >
                    {item.name}
                  </span>
                  <span className="shrink-0 flex items-baseline gap-1.5 font-mono">
                    <span className="text-[0.815em] opacity-55">{item.ratioText}</span>
                    <AnimatedNumber
                      value={item.netTotal}
                      hasFullAccess={hasFullAccess}
                      isPrinting={isPrinting}
                      className={`text-[0.951em] ${isActive ? 'font-black' : 'font-bold'} ${
                        isActive ? amountColor(item.netTotal, hasFullAccess) : ''
                      }`}
                    />
                  </span>
                </div>

                {/* 条形：从左向右展开，负值暖色、正值冷绿色 */}
                <div className="mt-1 h-1.5 w-full bg-current/15 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      item.netTotal >= 0 ? 'bg-emerald-600/80' : 'bg-rose-600/80'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: isAnimated ? `${item.barWidth}%` : 0 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: index * 0.035 }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 2. 占比环形图 */}
      {viewType === 'pie' && (
        <div className="pt-1 space-y-3">
          <div className="relative mx-auto w-44 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Pie
                  data={pieCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  isAnimationActive={false}
                  stroke="currentColor"
                  strokeWidth={1}
                  onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(_: unknown, index: number) => {
                    const target = pieCategories[index];
                    if (target) select(target.name);
                  }}
                >
                  {pieCategories.map((item, index) => {
                    const dim = hasSelection && activeCategory !== item.name;
                    const hovered = activeIndex === index;
                    return (
                      <Cell
                        key={`cell-${item.name}`}
                        fill={RECEIPT_PALETTE[index % RECEIPT_PALETTE.length]}
                        style={{
                          transform: hovered ? 'scale(1.04)' : 'scale(1)',
                          transformOrigin: 'center center',
                          transition: 'transform 180ms ease-out, opacity 180ms ease-out',
                          opacity: dim ? 0.3 : 1,
                          cursor: 'pointer',
                        }}
                      />
                    );
                  })}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* 环心信息：未悬停时显示总额，悬停/选中时显示该项 */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              {(() => {
                const focus =
                  activeIndex !== null ? pieCategories[activeIndex] : categories.find((c) => c.name === activeCategory);
                return focus ? (
                  <>
                    <span className="text-[0.679em] opacity-55 truncate max-w-[6.5em]">{focus.name}</span>
                    <span className={`font-black font-mono text-[0.951em] ${amountColor(focus.netTotal, hasFullAccess)}`}>
                      {focus.ratioText}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[0.679em] opacity-55">合计</span>
                    <span className="font-black font-mono text-[0.815em]">
                      {hasFullAccess ? formatCurrency(totalAbs, false, true) : '***'}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>

          {/* 图例：不再滚动，最多 5 项 + 其他 */}
          <div className="space-y-1">
            {pieCategories.map((item, index) => {
              const isActive = activeCategory === item.name;
              const dimmed = hasSelection && !isActive;
              return (
                <button
                  key={item.name}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={() => select(item.name)}
                  aria-pressed={isActive}
                  className={`w-full flex items-center justify-between gap-2 px-1 py-0.5 rounded transition-all duration-200 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-current/40 ${
                    isActive
                      ? 'bg-current/10 font-black'
                      : activeIndex === index
                      ? 'bg-current/5 font-bold'
                      : dimmed
                      ? 'opacity-35 font-bold hover:opacity-70'
                      : 'font-bold hover:bg-current/5'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0 border border-black/20"
                      style={{ backgroundColor: RECEIPT_PALETTE[index % RECEIPT_PALETTE.length] }}
                    />
                    <span className={`truncate ${isActive ? 'underline decoration-dotted underline-offset-2' : ''}`}>
                      {item.name}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 font-mono">
                    <span className="text-[0.747em] opacity-55">{item.ratioText}</span>
                    <span className={`text-[0.815em] ${isActive ? 'font-black' : 'font-bold'}`}>
                      {showAmount(item.netTotal)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. 紧凑列表 */}
      {viewType === 'list' && (
        <AnimatePresence initial={false} mode="popLayout">
          <div className="space-y-1 pt-0.5">
            {categories.map((item) => {
              const isActive = activeCategory === item.name;
              const dimmed = hasSelection && !isActive;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => select(item.name)}
                  aria-pressed={isActive}
                  className={`w-full flex items-center justify-between gap-2 rounded-md px-1 py-1 transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-current/40 ${
                    isActive ? 'bg-current/10' : dimmed ? 'opacity-35 hover:opacity-70' : 'hover:bg-current/5'
                  }`}
                >
                  <span
                    className={`truncate min-w-0 ${
                      isActive ? 'font-black underline decoration-dotted underline-offset-2' : 'font-bold'
                    }`}
                  >
                    {item.name}
                  </span>
                  <span className="shrink-0 font-mono">
                    <AnimatedNumber
                      value={item.netTotal}
                      hasFullAccess={hasFullAccess}
                      isPrinting={isPrinting}
                      className={`text-[0.815em] ${isActive ? 'font-black' : 'font-bold'}`}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};
