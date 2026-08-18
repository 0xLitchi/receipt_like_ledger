import React, { useRef } from 'react';
import type { Transaction, SummaryStats, ThemeType } from '../../types';
import { ReceiptHeader } from './ReceiptHeader';
import { ReceiptItem } from './ReceiptItem';
import { ReceiptFooter } from './ReceiptFooter';
import { toPng } from 'html-to-image';
import { PackageOpen } from 'lucide-react';

interface ReceiptViewProps {
  transactions: Transaction[];
  stats: SummaryStats;
  theme: ThemeType;
  selectedMonth: string;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({
  transactions,
  stats,
  theme,
  selectedMonth,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleExportPNG = async () => {
    if (!receiptRef.current) return;
    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        quality: 0.95,
        backgroundColor: theme === 'paper-white' ? '#faf9f6' : '#18181b',
      });
      const link = document.createElement('a');
      link.download = `receipt_${selectedMonth}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export PNG', err);
      alert('导出图片失败');
    }
  };

  return (
    <div className="flex justify-center my-2 px-1">
      <div
        ref={receiptRef}
        className={`receipt-container receipt-both-sawtooth theme-${theme} font-mono relative w-full max-w-md p-4 sm:p-5 shadow-2xl transition-all duration-300 rounded-sm`}
        style={{
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-black/5 to-transparent pointer-events-none" />

        <ReceiptHeader
          stats={stats}
          selectedMonth={selectedMonth}
        />

        <div className="my-2 min-h-[140px]">
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-xs opacity-50 font-mono flex flex-col items-center gap-2">
              <PackageOpen className="w-7 h-7 opacity-40" />
              <span>本月暂无记账明细</span>
            </div>
          ) : (
            transactions.map((t) => (
              <ReceiptItem
                key={t.id}
                transaction={t}
              />
            ))
          )}
        </div>

        <ReceiptFooter
          stats={stats}
          onExport={handleExportPNG}
        />

        <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
