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
  // 3 & 7 & 8: 分类汇总按金额从大到小排序，去除英文标语
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

    const list = Array.from(map.entries()).map(([name, stat]) => ({
      name,
      total: stat.total,
      count: stat.count,
    }));

    // 按金额绝对值从大到小排序
    return list.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [transactions]);

  return (
    <div className="text-center pt-2 pb-2 select-none font-mono">
      {/* 抬头小票图标 */}
      <div className="flex items-center justify-center my-1">
        <div className="p-1.5 border-2 border-current rounded-full opacity-85">
          <Receipt className="w-5 h-5 stroke-[2.5]" />
        </div>
      </div>

      {/* 月份 YYYY-MM */}
      <div className="text-xs font-bold opacity-90 flex justify-center font-mono my-2 tracking-widest border-y border-dashed border-current/25 py-1">
        <span>{selectedMonth || 'YYYY-MM'}</span>
      </div>

      {/* 核心统计汇总面板 */}
      <div className="grid grid-cols-3 gap-1 text-center py-2 bg-black/5 rounded my-2 font-mono">
        <div className="px-1">
          <div className="text-[11px] opacity-70 font-semibold mb-0.5">支出</div>
          <div className="text-base sm:text-lg font-black tracking-tight text-rose-700">
            {formatCurrency(stats.totalExpense)}
          </div>
        </div>
        <div className="px-1 border-x border-current/15">
          <div className="text-[11px] opacity-70 font-semibold mb-0.5">收入</div>
          <div className="text-base sm:text-lg font-black tracking-tight text-emerald-700">
            {formatCurrency(stats.totalIncome)}
          </div>
        </div>
        <div className="px-1">
          <div className="text-[11px] opacity-70 font-semibold mb-0.5">结余</div>
          <div className={`text-base sm:text-lg font-black tracking-tight ${stats.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatCurrency(stats.netBalance)}
          </div>
        </div>
      </div>

      {/* 7. 分类汇总区域 (去除了 BY CATEGORY 英文，按金额降序) */}
      {categoryStats.length > 0 && (
        <div className="my-3 py-2 border-y border-dashed border-current/25 text-left font-mono text-[11px] space-y-1 bg-black/[0.02] px-2 rounded">
          <div className="text-[10px] font-black opacity-60 uppercase tracking-wider mb-1.5 border-b border-current/10 pb-0.5 flex justify-between">
            <span>分类汇总</span>
            <span>小计</span>
          </div>
          {categoryStats.map((item) => (
            <div key={item.name} className="flex justify-between items-center opacity-90 font-mono">
              <span className="font-bold">{item.name} <span className="opacity-50 text-[10px]">({item.count})</span></span>
              <span className={`font-black ${item.total > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(item.total, true)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 1 & 2 & 3: 5列居中等宽表头 (日期 20%, 成员 20%, 分类 20%, 备注 20%, 金额 20%) */}
      <div className="grid grid-cols-5 text-center text-xs font-black border-b-2 border-current pb-1.5 mt-3 opacity-90 font-mono">
        <div>日期</div>
        <div>成员</div>
        <div>分类</div>
        <div>备注</div>
        <div className="text-right pr-1">金额</div>
      </div>
    </div>
  );
};
