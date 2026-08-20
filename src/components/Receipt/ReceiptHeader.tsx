import React from 'react';
import type { Transaction } from '../../types';
import { AnimatedNumber } from './AnimatedNumber';
import { Receipt } from 'lucide-react';

interface ReceiptHeaderProps {
  selectedMonth: string;
  transactions: Transaction[];
  hasFullAccess?: boolean;
  isPrinting?: boolean;
}

export const ReceiptHeader: React.FC<ReceiptHeaderProps> = ({
  transactions,
  hasFullAccess = true,
  isPrinting = false,
}) => {
  // 分类汇总计算
  const categoryStats = React.useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    let grandExpenseTotal = 0;
    let grandIncomeTotal = 0;

    transactions.forEach((t) => {
      let key = t.category || '其它';
      if (t.category === '杂项') {
        key = t.subcategory ? `杂项/${t.subcategory}` : '杂项';
      }

      const val = hasFullAccess ? t.amount : 0;
      if (val < 0) grandExpenseTotal += Math.abs(val);
      if (val > 0) grandIncomeTotal += val;

      const prev = map.get(key) || { total: 0, count: 0 };
      map.set(key, {
        total: prev.total + val,
        count: prev.count + 1,
      });
    });

    const allItems = Array.from(map.entries()).map(([name, stat]) => {
      const absTotal = Math.abs(stat.total);
      let ratio = 0;

      if (stat.total < 0 && grandExpenseTotal > 0) {
        ratio = Math.min(100, Math.round((absTotal / grandExpenseTotal) * 100));
      } else if (stat.total > 0 && grandIncomeTotal > 0) {
        ratio = Math.min(100, Math.round((stat.total / grandIncomeTotal) * 100));
      }

      return {
        name,
        total: stat.total,
        count: stat.count,
        ratio,
      };
    });

    // 1. 支出由绝对值从大到小
    const expenses = allItems
      .filter((i) => i.total < 0)
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    // 2. 收入由大到小
    const incomes = allItems
      .filter((i) => i.total >= 0)
      .sort((a, b) => b.total - a.total);

    return { list: [...expenses, ...incomes] };
  }, [transactions, hasFullAccess]);

  return (
    <div className="text-center pt-1 pb-1 select-none font-pixel tracking-wider">
      {/* 抬头图标 */}
      <div className="flex items-center justify-center my-1">
        <div className="p-1 border-2 border-current rounded-full opacity-85">
          <Receipt className="w-5 h-5 stroke-[2.5]" />
        </div>
      </div>

      {/* 分类汇总卡片 */}
      {categoryStats.list.length > 0 && (
        <div className="my-3 p-3 border-2 border-current rounded-xl text-left font-pixel text-xs space-y-2 bg-current/5 shadow-xs">
          <div className="space-y-2">
            {categoryStats.list.map((item) => (
              <div key={item.name} className="space-y-0.5">
                <div className="flex justify-between items-center font-pixel text-xs">
                  <span className="font-bold">
                    {item.name} <span className="opacity-60 text-[10px]">({item.count}笔)</span>
                  </span>
                  <span className="font-black tracking-tight">
                    <AnimatedNumber
                      value={item.total}
                      hasFullAccess={hasFullAccess}
                      isPrinting={isPrinting}
                      className={item.total > 0 ? 'text-emerald-700' : 'text-rose-700'}
                    />
                  </span>
                </div>

                {/* 支出与收入均显示占比进度条 */}
                {item.ratio > 0 && (
                  <div className="w-full h-1.5 bg-current/15 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.total > 0 ? 'bg-emerald-600/80' : 'bg-rose-600/80'
                      }`}
                      style={{ width: `${item.ratio}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
