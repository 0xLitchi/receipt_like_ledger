import React from 'react';
import type { Transaction } from '../../types';
import { AnimatedNumber } from './AnimatedNumber';
import { amountColor } from '../../features/ledger/access-mode';
import { ChevronDown } from 'lucide-react';

interface ReceiptItemProps {
  transaction: Transaction;
  hasFullAccess?: boolean;
  isPrinting?: boolean;
  /** 当前行是否展开了详情 */
  isActive?: boolean;
  onClick?: () => void;
}

export const ReceiptItem: React.FC<ReceiptItemProps> = ({
  transaction,
  hasFullAccess = true,
  isPrinting = false,
  isActive = false,
  onClick,
}) => {
  const categoryLabel = transaction.category
    ? transaction.subcategory
      ? `${transaction.category}/${transaction.subcategory}`
      : transaction.category
    : '';

  const rawTitle = transaction.title ? transaction.title.trim() : '';
  const titleText = hasFullAccess ? rawTitle : '***';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-expanded={onClick ? isActive : undefined}
      className={`group grid grid-cols-[2fr_1fr_1.3fr_1fr] divide-x divide-current/30 border-b border-current/30 text-xs font-pixel select-none transition-all duration-150 leading-snug items-center py-1.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-current/40 focus-visible:ring-inset ${
        isActive ? 'bg-current/15' : 'bg-current/[0.01] hover:bg-current/10'
      }`}
    >
      {/* 1. 备注 */}
      <div className="relative font-bold text-[12px] opacity-95 truncate px-2 text-left min-w-0 min-h-[18px]" title={titleText}>
        <ChevronDown
          className={`inline w-2.5 h-2.5 mr-0.5 -mt-0.5 transition-transform duration-200 no-print ${
            isActive ? 'rotate-180 opacity-70' : 'opacity-0 group-hover:opacity-40'
          }`}
        />
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

      {/* 4. 金额（居中对齐，无 ￥ 符号） */}
      <div className="font-black text-xs font-pixel tracking-tighter px-1 text-center min-w-0">
        <AnimatedNumber
          value={transaction.amount}
          hasFullAccess={hasFullAccess}
          isPrinting={isPrinting}
          showSymbol={false}
          className={amountColor(transaction.amount, hasFullAccess)}
        />
      </div>
    </div>
  );
};
