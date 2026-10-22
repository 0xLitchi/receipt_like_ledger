import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Transaction } from '../../types';
import { categoryLabel } from '../../features/ledger/use-ledger';
import { amountColor } from '../../features/ledger/access-mode';
import { AnimatedNumber } from '../Receipt/AnimatedNumber';
import { getTransactionName } from '../../utils/formatters';
import { ArrowDownLeft, ArrowUpRight, X } from 'lucide-react';

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  onClose: () => void;
  hasFullAccess?: boolean;
  isPrinting?: boolean;
}

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-current/15 last:border-0">
    <span className="text-[11px] opacity-60 shrink-0 tracking-widest">{label}</span>
    <span className="text-xs font-bold text-right break-all">{value || '—'}</span>
  </div>
);

/** 小票内行的详情抽屉：复用拟物纸张质感，向下展开 */
export const TransactionDetailSheet: React.FC<TransactionDetailSheetProps> = ({
  transaction,
  onClose,
  hasFullAccess = true,
  isPrinting = false,
}) => {
  return (
    <AnimatePresence initial={false}>
      {transaction && (
        <motion.div
          key={transaction.id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
          className="overflow-hidden border-b-2 border-current/40 bg-current/5"
        >
          <div className="px-3 py-2.5 relative">
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭详情"
              className="absolute top-2 right-2 p-1 rounded-md opacity-50 hover:opacity-100 hover:bg-current/10 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5 mb-2 pr-8">
              {transaction.amount >= 0 ? (
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              ) : (
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-700 shrink-0" />
              )}
              <span className="text-xs font-black truncate">
                {hasFullAccess ? getTransactionName(transaction) : '***'}
              </span>
            </div>

            <div className="space-y-0">
              <Field label="日期" value={transaction.date} />
              <Field label="成员" value={transaction.member} />
              <Field label="分类" value={categoryLabel(transaction)} />
              <Field label="账本" value={transaction.ledger} />
              <Field
                label="金额"
                value={
                  <AnimatedNumber
                    value={transaction.amount}
                    hasFullAccess={hasFullAccess}
                    isPrinting={isPrinting}
                    className={`font-pixel text-sm ${amountColor(transaction.amount, hasFullAccess)}`}
                  />
                }
              />
              {transaction.title && (
                <Field label="备注" value={hasFullAccess ? transaction.title : '***'} />
              )}
            </div>

            <div className="mt-2 pt-1.5 border-t border-dashed border-current/30 text-[10px] opacity-50 tracking-widest truncate">
              ID · {transaction.id}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
