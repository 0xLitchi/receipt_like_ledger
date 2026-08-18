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
    <div className="text-center pt-2 pb-3 px-4 select-none font-mono">
      {/* 品牌 / 标题 */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <Receipt className="w-5 h-5 opacity-80" />
        <span className="font-extrabold text-base tracking-wider uppercase">
          {ledgerName}
        </span>
      </div>

      {/* 小票简明单号 */}
      <div className="text-[11px] opacity-75 flex justify-between font-mono my-2 border-y border-dashed border-current/20 py-1.5">
        <span>NO: {receiptNo}</span>
        <span>{selectedMonth === 'ALL' ? '全部记录' : selectedMonth}</span>
      </div>

      {/* 核心统计 */}
      <div className="grid grid-cols-3 gap-2 text-center py-2 bg-black/5 dark:bg-white/5 rounded my-2 font-mono text-xs">
        <div>
          <div className="text-[10px] opacity-60">支出</div>
          <div className="font-bold text-rose-600 dark:text-rose-400">
            {formatCurrency(stats.totalExpense)}
          </div>
        </div>
        <div>
          <div className="text-[10px] opacity-60">收入</div>
          <div className="font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(stats.totalIncome)}
          </div>
        </div>
        <div>
          <div className="text-[10px] opacity-60">结余</div>
          <div className={`font-bold ${stats.netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(stats.netBalance)}
          </div>
        </div>
      </div>

      {/* 明细表头 */}
      <div className="flex justify-between text-[11px] font-bold border-b border-current pb-1 mt-3 opacity-80 font-mono">
        <span className="w-1/4 text-left">日期/成员</span>
        <span className="w-2/4 text-left">分类/说明</span>
        <span className="w-1/4 text-right">金额</span>
      </div>
    </div>
  );
};
