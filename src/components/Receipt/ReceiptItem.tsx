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
    <div className="py-2.5 border-b border-dashed border-current/20 font-mono text-xs select-none">
      <div className="flex justify-between items-start gap-2">
        {/* 左侧：日期与成员 */}
        <div className="w-1/4 flex flex-col">
          <span className="font-bold opacity-90 tracking-tighter">{transaction.date}</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] opacity-75 mt-0.5 font-bold">
            <User className="w-3 h-3 opacity-60" />
            <span>{transaction.member}</span>
          </span>
        </div>

        {/* 中间：备注与分类 */}
        <div className="w-2/4 flex flex-col">
          <span className="font-black text-sm leading-snug break-all tracking-tight">{name}</span>
          <div className="flex items-center gap-1 mt-1">
            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-black/10 dark:bg-white/10 rounded text-[10px] opacity-80 font-mono">
              <Tag className="w-2.5 h-2.5 opacity-60" />
              {transaction.category}{transaction.subcategory ? ` / ${transaction.subcategory}` : ''}
            </span>
          </div>
        </div>

        {/* 右侧：金额 */}
        <div className="w-1/4 flex flex-col items-end">
          <span
            className={`font-black text-sm font-mono tracking-tighter ${
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
