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
    <div className="py-1 border-b border-dashed border-current/20 font-pixel text-xs select-none hover:bg-black/[0.03] transition-colors leading-snug">
      <div className="grid grid-cols-4 text-left items-center">
        {/* 1. 备注 */}
        <div className="font-bold text-[12px] opacity-95 truncate px-1 font-pixel" title={titleText}>
          {titleText}
        </div>

        {/* 2. 80年代复古老虎机像素滚轮金额 */}
        <div className="font-black text-xs font-pixel tracking-tighter px-1">
          <AnimatedNumber
            value={transaction.amount}
            hasFullAccess={hasFullAccess}
            isPrinting={isPrinting}
            className={isIncome ? 'text-emerald-700' : 'text-rose-700'}
          />
        </div>

        {/* 3. 成员 */}
        <div className="font-bold opacity-90 text-[12px] truncate px-1 font-pixel">
          {transaction.member || ''}
        </div>

        {/* 4. 分类 */}
        <div className="font-bold text-[11px] opacity-80 truncate px-1 font-pixel" title={categoryLabel}>
          {categoryLabel}
        </div>
      </div>
    </div>
  );
};
