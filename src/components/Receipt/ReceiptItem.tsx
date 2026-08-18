import React from 'react';
import type { Transaction } from '../../types';
import { formatCurrency, getTransactionName } from '../../utils/formatters';
import { Tag, User } from 'lucide-react';

interface ReceiptItemProps {
  transaction: Transaction;
}

export const ReceiptItem: React.FC<ReceiptItemProps> = ({
  transaction,
}) => {
  const isIncome = transaction.amount > 0;
  const name = getTransactionName(transaction);

  return (
    <div className="py-2 border-b border-dashed border-current/20 font-mono text-xs select-none hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center justify-between">
        {/* 6. 左列 (32%): 日期 & 人员 */}
        <div className="w-[32%] flex flex-col text-left pr-1">
          <span className="font-bold opacity-90 tracking-tighter text-[11px] leading-tight">
            {transaction.date}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[10px] opacity-75 mt-0.5 font-bold truncate">
            <User className="w-2.5 h-2.5 opacity-60 shrink-0" />
            <span className="truncate">{transaction.member}</span>
          </span>
        </div>

        {/* 6. 中列 (43%): 说明/分类 */}
        <div className="w-[43%] flex flex-col text-left px-1">
          <span className="font-black text-xs leading-tight break-all tracking-tight opacity-95">
            {name}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-black/10 dark:bg-white/10 rounded text-[9px] opacity-75 font-mono truncate">
              <Tag className="w-2.5 h-2.5 opacity-50 shrink-0" />
              <span className="truncate">
                {transaction.category}{transaction.subcategory ? `/${transaction.subcategory}` : ''}
              </span>
            </span>
          </div>
        </div>

        {/* 6. 右列 (25%): 金额 */}
        <div className="w-[25%] flex flex-col items-end text-right pl-1">
          <span
            className={`font-black text-xs font-mono tracking-tighter ${
              isIncome
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {formatCurrency(transaction.amount, true)}
          </span>
        </div>
      </div>
    </div>
  );
};
