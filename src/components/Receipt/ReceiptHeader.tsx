import React from 'react';
import type { Transaction, SummaryStats } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Receipt } from 'lucide-react';

interface ReceiptHeaderProps {
  stats: SummaryStats;
  selectedMonth: string;
  transactions: Transaction[];
}

export const ReceiptHeader: React.FC<ReceiptHeaderProps> = ({
  stats,
  selectedMonth,
  transactions,
}) => {
  // 按规则计算分类汇总：一级分类汇总数据，"杂项"按二级分类汇总
  const categoryStats = React.useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();

    transactions.forEach((t) => {
      let key = t.category || '其它';
      if (t.category === '杂项') {
        key = t.subcategory ? `杂项/${t.subcategory}` : '杂项';
      }

      const prev = map.get(key) || { total: 0, count: 0 };
      map.set(key, {
        total: prev.total + t.amount,
        count: prev.count + 1,
      });
    });

    return Array.from(map.entries()).map(([name, stat]) => ({
      name,
      total: stat.total,
      count: stat.count,
    }));
  }, [transactions]);

  return (
    <div className="text-center pt-2 pb-2 select-none font-mono">
      {/* 4. 抬头仅保留小票图标 */}
      <div className="flex items-center justify-center my-1.5">
        <div className="p-2 border-2 border-current rounded-full opacity-85">
          <Receipt className="w-6 h-6 stroke-[2.5]" />
        </div>
      </div>

      {/* 5. 日期 YYYY-MM (去除了 NO: REC 编号) */}
      <div className="text-xs font-bold opacity-90 flex justify-center font-mono my-2 tracking-widest border-y border-dashed border-current/25 py-1">
        <span>{selectedMonth || 'YYYY-MM'}</span>
      </div>

      {/* 5. 放大字号的核心统计汇总面板 */}
      <div className="grid grid-cols-3 gap-1 text-center py-2.5 bg-black/5 dark:bg-white/5 rounded my-2 font-mono">
        <div className="px-1">
          <div className="text-[11px] opacity-70 font-semibold mb-0.5">支出</div>
          <div className="text-base sm:text-lg font-black tracking-tight text-rose-700 dark:text-rose-400">
            {formatCurrency(stats.totalExpense)}
          </div>
        </div>
        <div className="px-1 border-x border-current/15">
          <div className="text-[11px] opacity-70 font-semibold mb-0.5">收入</div>
          <div className="text-base sm:text-lg font-black tracking-tight text-emerald-700 dark:text-emerald-400">
            {formatCurrency(stats.totalIncome)}
          </div>
        </div>
        <div className="px-1">
          <div className="text-[11px] opacity-70 font-semibold mb-0.5">结余</div>
          <div className={`text-base sm:text-lg font-black tracking-tight ${stats.netBalance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
            {formatCurrency(stats.netBalance)}
          </div>
        </div>
      </div>

      {/* 3. 分类汇总区域 */}
      {categoryStats.length > 0 && (
        <div className="my-3 py-2 border-y border-dashed border-current/25 text-left font-mono text-[11px] space-y-1 bg-black/[0.02] dark:bg-white/[0.02] px-2 rounded">
          <div className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1.5 border-b border-current/10 pb-0.5 flex justify-between">
            <span>分类汇总 (BY CATEGORY)</span>
            <span>小计</span>
          </div>
          {categoryStats.map((item) => (
            <div key={item.name} className="flex justify-between items-center opacity-90 font-mono">
              <span className="font-bold">{item.name} <span className="opacity-50 text-[10px]">({item.count})</span></span>
              <span className={`font-black ${item.total > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {formatCurrency(item.total, true)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 6. 明细列对齐表头 (与 Row 严格 32% / 43% / 25% 对齐) */}
      <div className="flex items-center text-xs font-black border-b-2 border-current pb-1.5 mt-4 opacity-90 font-mono tracking-wider">
        <span className="w-[32%] text-left">日期/成员</span>
        <span className="w-[43%] text-left px-1">说明/分类</span>
        <span className="w-[25%] text-right">金额</span>
      </div>
    </div>
  );
};
