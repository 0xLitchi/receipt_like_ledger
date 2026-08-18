import React from 'react';
import type { SummaryStats } from '../../types';
import { formatCurrency, formatDateShort, generateReceiptNo } from '../../utils/formatters';
import { Receipt, Sparkles } from 'lucide-react';

interface ReceiptHeaderProps {
  stats: SummaryStats;
  ledgerName?: string;
  selectedMonth: string;
  selectedMember: string;
}

export const ReceiptHeader: React.FC<ReceiptHeaderProps> = ({
  stats,
  ledgerName = '小票记账本 (LEDGER)',
  selectedMonth,
  selectedMember,
}) => {
  const todayStr = formatDateShort(new Date().toISOString().split('T')[0]);
  const receiptNo = generateReceiptNo(selectedMonth !== 'ALL' ? `${selectedMonth}-01` : undefined);

  return (
    <div className="text-center pt-2 pb-4 px-4 select-none">
      {/* 品牌 / 标识 */}
      <div className="flex items-center justify-center gap-2 mb-1">
        <Receipt className="w-6 h-6 opacity-80" />
        <span className="font-extrabold text-lg tracking-wider uppercase font-mono">
          {ledgerName}
        </span>
      </div>

      <div className="text-xs opacity-75 font-mono mb-2 flex items-center justify-center gap-1">
        <Sparkles className="w-3.5 h-3.5" />
        <span>OFFICIAL TRANSACTION RECEIPT</span>
      </div>

      {/* 虚线分割 */}
      <div className="thermal-dashed-line my-3" />

      {/* 小票元数据 */}
      <div className="text-xs font-mono space-y-1 text-left opacity-90">
        <div className="flex justify-between">
          <span className="opacity-70">收据单号:</span>
          <span className="font-bold">{receiptNo}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-70">统计月份:</span>
          <span className="font-bold">{selectedMonth === 'ALL' ? '全部历史账单' : selectedMonth}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-70">筛选成员:</span>
          <span className="font-bold">{selectedMember === 'ALL' ? '全员 (荔枝 & 扶正)' : selectedMember}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-70">打印日期:</span>
          <span>{todayStr}</span>
        </div>
      </div>

      {/* 双实线分割 */}
      <div className="thermal-double-line my-3" />

      {/* 顶部统计面板 */}
      <div className="grid grid-cols-3 gap-2 text-center py-2 bg-black/5 dark:bg-white/5 rounded-md my-2 font-mono">
        <div>
          <div className="text-[10px] opacity-60 uppercase">总支出 (EXP)</div>
          <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
            {formatCurrency(stats.totalExpense)}
          </div>
        </div>
        <div>
          <div className="text-[10px] opacity-60 uppercase">总收入 (INC)</div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(stats.totalIncome)}
          </div>
        </div>
        <div>
          <div className="text-[10px] opacity-60 uppercase">结余 (BAL)</div>
          <div className={`text-sm font-bold ${stats.netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(stats.netBalance)}
          </div>
        </div>
      </div>

      {/* 列表表头 */}
      <div className="flex justify-between text-xs font-bold border-b border-current pb-1 mt-4 opacity-80 font-mono">
        <span className="w-1/4 text-left">日期/成员</span>
        <span className="w-2/4 text-left">分类/说明</span>
        <span className="w-1/4 text-right">金额(￥)</span>
      </div>
    </div>
  );
};
