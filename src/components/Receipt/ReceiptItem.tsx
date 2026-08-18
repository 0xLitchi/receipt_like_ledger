import React from 'react';
import type { Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface ReceiptItemProps {
  transaction: Transaction;
  hasFullAccess?: boolean;
}

export const ReceiptItem: React.FC<ReceiptItemProps> = ({
  transaction,
  hasFullAccess = true,
}) => {
  const isIncome = transaction.amount > 0;
  const categoryLabel = transaction.category
    ? transaction.subcategory
      ? `${transaction.category}/${transaction.subcategory}`
      : transaction.category
    : '-';

  const titleText = hasFullAccess
    ? transaction.title || '-'
    : '***';

  const amountText = hasFullAccess
    ? formatCurrency(transaction.amount, true)
    : '￥***.**';

  return (
    <div className="py-1.5 border-b border-dashed border-current/15 font-mono text-xs select-none hover:bg-black/[0.02] transition-colors">
      <div className="grid grid-cols-4 text-center items-center">
        {/* 1. 备注 */}
        <div className="font-bold text-[11px] opacity-95 truncate px-1" title={titleText}>
          {titleText}
        </div>

        {/* 2. 金额 */}
        <div
          className={`font-black text-xs font-mono tracking-tighter px-1 ${
            !hasFullAccess
              ? 'opacity-60'
              : isIncome
              ? 'text-emerald-700'
              : 'text-rose-700'
          }`}
        >
          {amountText}
        </div>

        {/* 3. 成员 */}
        <div className="font-bold opacity-85 text-[11px] truncate px-1">
          {transaction.member || '-'}
        </div>

        {/* 4. 分类 */}
        <div className="font-bold text-[10px] opacity-80 truncate px-1" title={categoryLabel}>
          {categoryLabel}
        </div>
      </div>
    </div>
  );
};
