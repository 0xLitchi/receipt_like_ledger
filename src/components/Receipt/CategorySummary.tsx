import React, { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Transaction } from '../../types';
import { summaryKey } from '../../features/ledger/use-ledger';
import { AnimatedNumber } from './AnimatedNumber';

interface CategorySummaryProps {
  transactions: Transaction[];
  hasFullAccess?: boolean;
  isPrinting?: boolean;
  /** 当前选中的分类，'ALL' 表示未筛选 */
  activeCategory?: string;
  /** 点击分类后回传给页面，用于联动过滤明细 */
  onSelectCategory?: (category: string) => void;
}

interface CategoryItem {
  name: string;
  netTotal: number;
  absVal: number;
  /** 相对最大分类的宽度百分比 */
  barWidth: number;
}

/**
 * 分类汇总：单一条目式的「墨条 » 金额」列表，配一条网点填充的占比条。
 * 网点填充模拟热敏打印机打出的灰度，条越长网点越密，像印在纸上的墨条。
 */
export const CategorySummary: React.FC<CategorySummaryProps> = ({
  transactions,
  hasFullAccess = true,
  isPrinting = false,
  activeCategory = 'ALL',
  onSelectCategory,
}) => {
  // 数据变化时换 key，让墨条重新从 0 展开
  const [motionKey, setMotionKey] = useState(0);
  useEffect(() => {
    setMotionKey((k) => k + 1);
  }, [transactions]);

  const categories = useMemo<CategoryItem[]>(() => {
    const map = new Map<string, number>();

    transactions.forEach((t) => {
      const key = summaryKey(t);
      const value = hasFullAccess ? t.amount : 0;
      map.set(key, (map.get(key) || 0) + value);
    });

    const list = Array.from(map.entries()).map(([name, netTotal]) => {
      const absVal = Math.abs(netTotal);
      return {
        name,
        netTotal,
        absVal,
        barWidth: 0,
      };
    });

    // 按金额绝对值降序；条形取「相对最大分类」比例，避免收入过大把支出压成细线
    list.sort((a, b) => b.absVal - a.absVal);
    const maxAbs = list.reduce((m, c) => Math.max(m, c.absVal), 0);
    list.forEach((c) => {
      c.barWidth = maxAbs > 0 ? Math.max(c.absVal > 0 ? 3 : 0, (c.absVal / maxAbs) * 100) : 0;
    });

    return list;
  }, [transactions, hasFullAccess]);

  if (categories.length === 0) return null;

  const hasSelection = activeCategory !== 'ALL' && categories.some((c) => c.name === activeCategory);

  return (
    <div
      data-category-summary
      className="my-3 p-3 border-2 border-current rounded-xl text-left font-pixel text-[0.815em] bg-current/5 shadow-xs select-none"
    >
      <div className="space-y-1.5">
        {categories.map((item, index) => {
          const isActive = activeCategory === item.name;
          const dimmed = hasSelection && !isActive;
          const isIncome = item.netTotal >= 0;

          return (
            <button
              key={item.name}
              type="button"
              onClick={() => onSelectCategory?.(isActive ? 'ALL' : item.name)}
              aria-pressed={isActive}
              title={isActive ? '取消分类筛选' : `只看 ${item.name}`}
              className={`block w-full text-left rounded-md px-1 py-1 transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-current/40 ${
                isActive ? 'bg-current/10' : dimmed ? 'opacity-35 hover:opacity-70' : 'hover:bg-current/5'
              }`}
            >
              {/* 名称 » 占比 » 金额 */}
              <div className="flex items-baseline justify-between gap-2">
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
                    className={`text-[0.951em] ${isActive ? 'font-black' : 'font-bold'}`}
                  />
                </span>
              </div>

              {/* 网点墨条：点阵填充模拟热敏打印的灰度 */}
              <div className="mt-1 h-[8px] rounded-[1px] overflow-hidden bg-current/[0.10] border border-current/[0.12]">
                <motion.div
                  className="h-full"
                  key={motionKey}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.barWidth}%` }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.03 }}
                  style={{
                    backgroundImage: isIncome
                      ? 'radial-gradient(rgba(4,108,75,1) 1px, transparent 1.1px)'
                      : 'radial-gradient(rgba(180,16,55,1) 1px, transparent 1.1px)',
                    backgroundSize: '3px 3px',
                    backgroundColor: isIncome ? 'rgba(5,150,105,0.20)' : 'rgba(225,29,72,0.20)',
                    filter: dimmed ? 'grayscale(0.5)' : 'none',
                    WebkitPrintColorAdjust: 'exact',
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
