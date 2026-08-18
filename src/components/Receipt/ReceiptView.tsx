import React, { useRef } from 'react';
import type { Transaction, SummaryStats } from '../../types';
import { ReceiptHeader } from './ReceiptHeader';
import { ReceiptItem } from './ReceiptItem';
import { ReceiptFooter } from './ReceiptFooter';
import { toPng } from 'html-to-image';
import { PackageOpen } from 'lucide-react';

interface ReceiptViewProps {
  transactions: Transaction[];
  stats: SummaryStats;
  selectedMonth: string;
  isNightMode?: boolean;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({
  transactions,
  stats,
  selectedMonth,
  isNightMode = false,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handleExportPNG = async () => {
    if (!receiptRef.current) return;
    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        quality: 0.95,
        backgroundColor: isNightMode ? '#121418' : '#faf7f0',
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
      {/* 拟物化热敏小票外壳 */}
      <div
        ref={receiptRef}
        className="receipt-container receipt-paper-box receipt-both-sawtooth font-mono relative w-full max-w-md p-4 sm:p-6 transition-all duration-300 rounded-sm"
      >
        {/* 顶部自然纸张撕口微光影 */}
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-black/10 to-transparent pointer-events-none" />

        <ReceiptHeader
          stats={stats}
          selectedMonth={selectedMonth}
          transactions={transactions}
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

        {/* 底部小票卷角折痕 */}
        <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
