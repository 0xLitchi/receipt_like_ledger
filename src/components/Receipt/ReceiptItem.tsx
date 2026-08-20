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
      {/* 1. 备注（列间分割符严格保留，为空时通过 non-breaking space 充实高宽） */}
      <div className="font-bold text-[12px] opacity-95 truncate px-2 text-left min-w-0 min-h-[18px]" title={titleText}>
        {titleText || '\u00A0'}
      </div>

      {/* 2. 成员 */}
      <div className="font-bold opacity-90 text-[12px] truncate px-1 text-center min-w-0">
        {transaction.member || ''}
      </div>

      {/* 3. 分类 */}
      <div className="font-bold text-[11px] opacity-85 truncate px-1 text-center min-w-0" title={categoryLabel}>
        {categoryLabel || ''}
      </div>

      {/* 4. 金额（位于第四列，去除 ￥ 前置符号） */}
      <div className="font-black text-xs font-pixel tracking-tighter px-2 text-right min-w-0">
        <AnimatedNumber
          value={transaction.amount}
          hasFullAccess={hasFullAccess}
          isPrinting={isPrinting}
          showSymbol={false}
          className={isIncome ? 'text-emerald-700' : 'text-rose-700'}
        />
      </div>
    </div>
  );
};
