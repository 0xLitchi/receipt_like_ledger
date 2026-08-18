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
  isAdmin?: boolean;
  onEditTransaction?: (t: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({
  transactions,
  stats,
  theme,
  selectedMonth,
  isAdmin = false,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPNG = async () => {
    if (!receiptRef.current) return;
    try {
      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        quality: 0.95,
        backgroundColor: theme === 'paper-white' ? '#faf9f6' : theme === 'paper-vintage' ? '#f4ecd8' : theme === 'paper-receipt-blue' ? '#e0f2fe' : '#18181b',
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
    <div className="flex justify-center my-4 px-2">
      <div
        ref={receiptRef}
        className={`receipt-container receipt-both-sawtooth theme-${theme} relative w-full max-w-md p-4 sm:p-6 shadow-2xl transition-all duration-300 rounded-sm`}
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
                isAdmin={isAdmin}
                onEdit={onEditTransaction}
                onDelete={onDeleteTransaction}
              />
            ))
          )}
        </div>

        <ReceiptFooter
          stats={stats}
          onPrint={handlePrint}
          onExport={handleExportPNG}
        />

        <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
