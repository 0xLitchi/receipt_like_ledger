import React from 'react';
import type { Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface ReceiptItemProps {
  transaction: Transaction;
}

export const ReceiptItem: React.FC<ReceiptItemProps> = ({
  transaction,
}) => {
  const isIncome = transaction.amount > 0;
  const categoryLabel = transaction.category
    ? transaction.subcategory
      ? `${transaction.category}/${transaction.subcategory}`
      : transaction.category
    : '-';

  // 格式化日期为 MM-DD，保持表格紧凑整齐
  const shortDate = transaction.date ? transaction.date.substring(5) : '-';

  return (
    <div className="py-2 border-b border-dashed border-current/20 font-mono text-xs select-none hover:bg-black/[0.02] transition-colors">
      <div className="grid grid-cols-5 text-center items-center">
        {/* 1. 日期 */}
        <div className="font-bold opacity-90 text-[11px] tracking-tight truncate">
          {shortDate}
        </div>

        {/* 2. 成员 */}
        <div className="font-bold opacity-85 text-[11px] truncate px-0.5">
          {transaction.member || '-'}
        </div>

        {/* 3. 分类 */}
        <div className="font-bold text-[10px] opacity-80 truncate px-0.5" title={categoryLabel}>
          {categoryLabel}
        </div>

        {/* 4. 备注 */}
        <div className="font-bold text-[11px] opacity-95 truncate px-0.5" title={transaction.title || '-'}>
          {transaction.title || '-'}
        </div>

        {/* 5. 金额 */}
        <div
          className={`font-black text-xs font-mono tracking-tighter text-right pr-1 ${
            isIncome ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {formatCurrency(transaction.amount, true)}
        </div>
      </div>
    </div>
  );
};
