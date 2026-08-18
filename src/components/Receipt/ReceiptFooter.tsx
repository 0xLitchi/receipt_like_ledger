import React from 'react';
import type { SummaryStats } from '../../types';
import { AnimatedNumber } from './AnimatedNumber';

interface ReceiptFooterProps {
  stats: SummaryStats;
  hasFullAccess?: boolean;
  isPrinting?: boolean;
}

export const ReceiptFooter: React.FC<ReceiptFooterProps> = ({
  stats,
  hasFullAccess = true,
  isPrinting = false,
}) => {
  return (
    <div className="pt-2 pb-2 px-2 font-pixel text-xs select-none tracking-wider">
      <div className="thermal-dashed-line my-2" />

      {/* 像素风统计总计 */}
      <div className="space-y-1 text-right my-1 opacity-95">
        <div className="flex justify-between font-pixel text-xs">
          <span className="opacity-75">交易共计:</span>
          <span className="font-bold">{stats.count} 笔</span>
        </div>

        <div className="flex justify-between text-sm font-black pt-1 border-t border-dashed border-current/30 mt-1.5 font-pixel">
          <span>净计:</span>
          <AnimatedNumber
            value={stats.netBalance}
            hasFullAccess={hasFullAccess}
            isPrinting={isPrinting}
            className={stats.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}
          />
        </div>
      </div>
    </div>
  );
};
