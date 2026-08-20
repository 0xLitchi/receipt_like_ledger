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
  // 分类汇总：收入与支出不进行正负抵消，分别分类独立汇总
  const categoryStats = React.useMemo(() => {
    const expenseMap = new Map<string, { total: number; count: number }>();
    const incomeMap = new Map<string, { total: number; count: number }>();

    let grandExpenseTotal = 0;
    let grandIncomeTotal = 0;

    transactions.forEach((t) => {
      let key = t.category || '其它';
      if (t.category === '杂项') {
        key = t.subcategory ? `杂项/${t.subcategory}` : '杂项';
      }

      const val = hasFullAccess ? t.amount : 0;
      if (val < 0) {
        grandExpenseTotal += Math.abs(val);
        const prev = expenseMap.get(key) || { total: 0, count: 0 };
        expenseMap.set(key, {
          total: prev.total + val,
          count: prev.count + 1,
        });
      } else if (val > 0) {
        grandIncomeTotal += val;
        const prev = incomeMap.get(key) || { total: 0, count: 0 };
        incomeMap.set(key, {
          total: prev.total + val,
          count: prev.count + 1,
        });
      }
    });

    // 1. 支出类目（按绝对值由大到小排序）
    const expenses = Array.from(expenseMap.entries())
      .map(([name, stat]) => ({
        name,
        total: stat.total,
        count: stat.count,
        ratio: grandExpenseTotal > 0 ? Math.min(100, Math.round((Math.abs(stat.total) / grandExpenseTotal) * 100)) : 0,
        isIncome: false,
      }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    // 2. 收入类目（按金额由大到小排序）
    const incomes = Array.from(incomeMap.entries())
      .map(([name, stat]) => ({
        name,
        total: stat.total,
        count: stat.count,
        ratio: grandIncomeTotal > 0 ? Math.min(100, Math.round((stat.total / grandIncomeTotal) * 100)) : 0,
        isIncome: true,
      }))
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
            {categoryStats.list.map((item, idx) => (
              <div key={`${item.name}_${item.isIncome ? 'inc' : 'exp'}_${idx}`} className="space-y-0.5">
                <div className="flex justify-between items-center font-pixel text-xs">
                  <span className="font-bold">
                    {item.name} <span className="opacity-60 text-[10px]">({item.count}笔)</span>
                  </span>
                  <span className="font-black tracking-tight">
                    <AnimatedNumber
                      value={item.total}
                      hasFullAccess={hasFullAccess}
                      isPrinting={isPrinting}
                      className={item.isIncome ? 'text-emerald-700' : 'text-rose-700'}
                    />
                  </span>
                </div>

                {/* 支出与收入均显示独立比例进度条 */}
                {item.ratio > 0 && (
                  <div className="w-full h-1.5 bg-current/15 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.isIncome ? 'bg-emerald-600/80' : 'bg-rose-600/80'
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
