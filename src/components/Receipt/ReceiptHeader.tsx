import React from 'react';
import type { Transaction } from '../../types';
import { AnimatedNumber } from './AnimatedNumber';
import { Receipt, PieChart } from 'lucide-react';

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
  // 分类汇总：按支出金额从大到小 (排序)
  const categoryStats = React.useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    let grandExpenseTotal = 0;

    transactions.forEach((t) => {
      let key = t.category || '其它';
      if (t.category === '杂项') {
        key = t.subcategory ? `杂项/${t.subcategory}` : '杂项';
      }

      const val = hasFullAccess ? t.amount : 0;
      if (val < 0) grandExpenseTotal += Math.abs(val);

      const prev = map.get(key) || { total: 0, count: 0 };
      map.set(key, {
        total: prev.total + val,
        count: prev.count + 1,
      });
    });

    const list = Array.from(map.entries()).map(([name, stat]) => {
      const absTotal = Math.abs(stat.total);
      const ratio = grandExpenseTotal > 0 && stat.total < 0 ? Math.min(100, Math.round((absTotal / grandExpenseTotal) * 100)) : 0;
      return {
        name,
        total: stat.total,
        count: stat.count,
        ratio,
      };
    });

    // 按数值升序（负值最大的排在前列）
    list.sort((a, b) => a.total - b.total);
    return { list, grandExpenseTotal };
  }, [transactions, hasFullAccess]);

  return (
    <div className="text-center pt-1 pb-1 select-none font-pixel tracking-wider">
      {/* 抬头图标 */}
      <div className="flex items-center justify-center my-1">
        <div className="p-1 border-2 border-current rounded-full opacity-85">
          <Receipt className="w-5 h-5 stroke-[2.5]" />
        </div>
      </div>

      {/* 高调强化的分类汇总卡片 (Category Breakdown Summary Card) */}
      {categoryStats.list.length > 0 && (
        <div className="my-3 p-3 border-2 border-current rounded-xl text-left font-pixel text-xs space-y-2 bg-current/5 shadow-xs">
          {/* 分类汇总 Header 栏 */}
          <div className="flex items-center justify-between font-black text-xs border-b-2 border-dashed border-current/40 pb-1.5 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <PieChart className="w-4 h-4 stroke-[2.5]" />
              <span>★ 分类支出汇总 ★</span>
            </div>
            <span className="opacity-80 text-[11px]">共 {categoryStats.list.length} 类</span>
          </div>

          {/* 各分类列表与占比数据 */}
          <div className="space-y-1.5 pt-1">
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

                {/* 支出占比进度条：仅支出分类显示，收入不体现在进度条上 */}
                {item.total < 0 && item.ratio > 0 && (
                  <div className="w-full h-1.5 bg-current/15 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-rose-600/80 rounded-full transition-all duration-500"
                      style={{ width: `${item.ratio}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 表头居中对齐：备注 | 金额 | 成员 | 分类 */}
      <div className="grid grid-cols-4 text-center text-xs font-black border-b-2 border-current pb-1 mt-2 opacity-95 font-pixel tracking-widest uppercase">
        <div>备注</div>
        <div>金额</div>
        <div>成员</div>
        <div>分类</div>
      </div>
    </div>
  );
};
