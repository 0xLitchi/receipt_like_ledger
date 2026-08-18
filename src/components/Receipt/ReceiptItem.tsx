import React from 'react';
import type { Transaction } from '../../types';
import { formatCurrency, getTransactionName } from '../../utils/formatters';
import { Tag, User, Edit3, Trash2 } from 'lucide-react';

interface ReceiptItemProps {
  transaction: Transaction;
  isAdmin?: boolean;
  onEdit?: (t: Transaction) => void;
  onDelete?: (id: string) => void;
}

export const ReceiptItem: React.FC<ReceiptItemProps> = ({
  transaction,
  isAdmin = false,
  onEdit,
  onDelete,
}) => {
  const isIncome = transaction.amount > 0;
  const name = getTransactionName(transaction);

  return (
    <div className="group relative py-2.5 border-b border-dashed border-current/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors px-1 font-mono text-xs">
      <div className="flex justify-between items-start gap-2">
        {/* 左侧：日期与关联人员 */}
        <div className="w-1/4 flex flex-col">
          <span className="font-semibold opacity-90">{transaction.date}</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] opacity-75 mt-0.5">
            <User className="w-3 h-3 opacity-60" />
            <span className="font-bold">{transaction.member}</span>
          </span>
        </div>

        {/* 中间：主分类/子分类与备注名称 */}
        <div className="w-2/4 flex flex-col">
          <span className="font-bold text-sm leading-snug break-all">{name}</span>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded text-[10px] opacity-80">
              <Tag className="w-2.5 h-2.5 opacity-60" />
              {transaction.category}{transaction.subcategory ? ` / ${transaction.subcategory}` : ''}
            </span>
          </div>
        </div>

        {/* 右侧：格式化金额与管理员操作选项 */}
        <div className="w-1/4 flex flex-col items-end">
          <span
            className={`font-black text-sm font-mono tracking-tight ${
              isIncome
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {formatCurrency(transaction.amount, true)}
          </span>

          {isAdmin && (
            <div className="flex items-center gap-2 mt-1 no-print">
              <button
                onClick={() => onEdit && onEdit(transaction)}
                className="p-1 hover:text-blue-600 transition-colors"
                title="修改"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete && onDelete(transaction.id)}
                className="p-1 hover:text-rose-600 transition-colors"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
