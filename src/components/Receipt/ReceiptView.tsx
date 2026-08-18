import React from 'react';
import type { Transaction, SummaryStats } from '../../types';
import { ReceiptHeader } from './ReceiptHeader';
import { ReceiptItem } from './ReceiptItem';
import { ReceiptFooter } from './ReceiptFooter';
import { PackageOpen } from 'lucide-react';

interface ReceiptViewProps {
  transactions: Transaction[];
  stats: SummaryStats;
  selectedMonth: string;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({
  transactions,
  stats,
  selectedMonth,
}) => {
  return (
    <div className="flex justify-center my-2 px-1">
      <div className="receipt-container receipt-paper-box receipt-both-sawtooth font-mono relative w-full max-w-md p-4 sm:p-5 transition-all duration-300 rounded-sm">
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-black/10 to-transparent pointer-events-none" />

        <ReceiptHeader
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

        <ReceiptFooter stats={stats} />

        <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
