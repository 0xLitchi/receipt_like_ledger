import React from 'react';
import type { SummaryStats } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Download } from 'lucide-react';

interface ReceiptFooterProps {
  stats: SummaryStats;
  onExport?: () => void;
}

export const ReceiptFooter: React.FC<ReceiptFooterProps> = ({
  stats,
  onExport,
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
          <span className={stats.netBalance >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
            {formatCurrency(stats.netBalance)}
          </span>
        </div>
      </div>

      {/* 仅保留保存图片按钮 */}
      <div className="mt-5 flex justify-center no-print">
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-mono font-bold transition-colors shadow-md"
        >
          <Download className="w-4 h-4" />
          保存小票图片
        </button>
      </div>
    </div>
  );
};
