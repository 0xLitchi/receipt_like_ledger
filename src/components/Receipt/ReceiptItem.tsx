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
      className={`group grid grid-cols-[1.9fr_0.9fr_1.25fr_1.15fr] divide-x divide-current/30 border-b border-current/30 text-[0.815em] font-pixel select-none transition-[background-color,box-shadow] duration-200 leading-snug items-center py-1.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-current/40 focus-visible:ring-inset focus-visible:bg-current/10 ${
        isActive
          ? 'bg-current/15'
          : 'bg-current/[0.01] can-hover:hover:bg-current/10 can-hover:hover:shadow-[inset_2px_0_0_currentColor] active:bg-current/15'
      }`}
    >
      {/* 1. 备注：悬停 / 展开时露出展开箭头；触屏设备展开后箭头常显 */}
      <div className="relative font-bold text-[0.815em] opacity-95 truncate px-2 text-left min-w-0 min-h-[18px]" title={titleText}>
        <ChevronDown
          className={`inline w-2.5 h-2.5 mr-0.5 -mt-0.5 transition-all duration-200 ease-out no-print ${
            isActive
              ? 'rotate-180 opacity-70'
              : 'opacity-0 -translate-y-px group-hover:opacity-40 group-hover:translate-y-0 group-focus-visible:opacity-50'
          }`}
        />
        {titleText || '\u00A0'}
      </div>

      {/* 2. 成员 */}
      <div className="font-bold opacity-90 text-[0.815em] truncate px-1 text-center min-w-0">
        {transaction.member || ''}
      </div>

      {/* 3. 分类 */}
      <div className="font-bold text-[0.747em] opacity-85 truncate px-1 text-center min-w-0" title={categoryLabel}>
        {categoryLabel || ''}
      </div>

      {/* 4. 金额（居中对齐，无 ￥ 符号） */}
      <div className="font-black text-[0.815em] font-pixel tracking-tighter px-1 text-center min-w-0">
        <AnimatedNumber
          value={transaction.amount}
          hasFullAccess={hasFullAccess}
          isPrinting={isPrinting}
          showSymbol={false}
          copyable
          className={amountColor(transaction.amount, hasFullAccess)}
        />
      </div>
    </div>
  );
};
