import React from 'react';
import type { Transaction } from '../../types';
import { AnimatedNumber } from './AnimatedNumber';

interface ReceiptItemProps {
  transaction: Transaction;
  hasFullAccess?: boolean;
  isPrinting?: boolean;
}

export const ReceiptItem: React.FC<ReceiptItemProps> = ({
  transaction,
  hasFullAccess = true,
  isPrinting = false,
}) => {
  const isIncome = transaction.amount > 0;
  const categoryLabel = transaction.category
    ? transaction.subcategory
      ? `${transaction.category}/${transaction.subcategory}`
      : transaction.category
    : '';

  const rawTitle = transaction.title ? transaction.title.trim() : '';
  const titleText = hasFullAccess ? rawTitle : '***';

  return (
    <div className="grid grid-cols-4 divide-x divide-current/30 border-b border-current/30 text-xs font-pixel select-none hover:bg-current/5 transition-colors leading-snug items-center py-1.5 bg-current/[0.01]">
      {/* 1. 备注（为空则留空，不显示 "-"） */}
      <div className="font-bold text-[12px] opacity-95 truncate px-2 text-left" title={titleText}>
        {titleText}
      </div>

      {/* 2. 金额 */}
      <div className="font-black text-xs font-pixel tracking-tighter px-2 text-right">
        <AnimatedNumber
          value={transaction.amount}
          hasFullAccess={hasFullAccess}
          isPrinting={isPrinting}
          className={isIncome ? 'text-emerald-700' : 'text-rose-700'}
        />
      </div>

      {/* 3. 成员 */}
      <div className="font-bold opacity-90 text-[12px] truncate px-1 text-center">
        {transaction.member || ''}
      </div>

      {/* 4. 分类 */}
      <div className="font-bold text-[11px] opacity-85 truncate px-1 text-center" title={categoryLabel}>
        {categoryLabel || ''}
      </div>
    </div>
  );
};
