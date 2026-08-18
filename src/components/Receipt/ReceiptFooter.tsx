import React from 'react';
import type { SummaryStats } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface ReceiptFooterProps {
  stats: SummaryStats;
}

export const ReceiptFooter: React.FC<ReceiptFooterProps> = ({
  stats,
}) => {
  return (
    <div className="pt-2 pb-3 px-3 font-mono text-xs select-none">
      <div className="thermal-dashed-line my-3" />

      {/* 统计总计 */}
      <div className="space-y-1 text-right my-2 opacity-95">
        <div className="flex justify-between font-mono text-xs">
          <span className="opacity-75">交易共计:</span>
          <span className="font-bold">{stats.count} 笔</span>
        </div>

        <div className="flex justify-between text-base font-black pt-1.5 border-t border-dashed border-current/30 mt-2 font-mono">
          <span>净计:</span>
          <span className={stats.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
            {formatCurrency(stats.netBalance)}
          </span>
        </div>
      </div>
    </div>
  );
};
