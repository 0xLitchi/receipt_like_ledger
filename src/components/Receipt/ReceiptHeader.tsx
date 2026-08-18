import React from 'react';
import type { SummaryStats } from '../../types';
import { formatCurrency, generateReceiptNo } from '../../utils/formatters';
import { Receipt } from 'lucide-react';

interface ReceiptHeaderProps {
  stats: SummaryStats;
  ledgerName?: string;
  selectedMonth: string;
}

export const ReceiptHeader: React.FC<ReceiptHeaderProps> = ({
  stats,
  ledgerName = '小票记账本',
  selectedMonth,
}) => {
  const receiptNo = generateReceiptNo(selectedMonth !== 'ALL' ? `${selectedMonth}-01` : undefined);

  return (
    <div className="text-center pt-2 pb-2 px-3 select-none font-mono">
      {/* 品牌标题 */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <Receipt className="w-5 h-5 opacity-80" />
        <span className="font-extrabold text-base tracking-widest uppercase font-mono">
          {ledgerName}
        </span>
      </div>

      {/* 小票单号 */}
      <div className="text-xs opacity-80 flex justify-between font-mono my-2 border-y border-dashed border-current/25 py-1.5 tracking-wider">
        <span>NO: {receiptNo}</span>
        <span>{selectedMonth === 'ALL' ? '全部记录' : selectedMonth}</span>
      </div>

      {/* 放大字号的核心统计汇总面板 */}
      <div className="grid grid-cols-3 gap-2 text-center py-2.5 bg-black/5 dark:bg-white/5 rounded my-2 font-mono">
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

      {/* 明细列名 */}
      <div className="flex justify-between text-xs font-black border-b border-current pb-1 mt-3 opacity-85 font-mono tracking-wider">
        <span className="w-1/4 text-left">日期/成员</span>
        <span className="w-2/4 text-left">分类/说明</span>
        <span className="w-1/4 text-right">金额</span>
      </div>
    </div>
  );
};
