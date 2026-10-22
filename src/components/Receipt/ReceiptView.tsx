import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DateGroup, SummaryStats, Transaction } from '../../types';
import { ReceiptHeader } from './ReceiptHeader';
import { CategorySummary } from './CategorySummary';
import { ReceiptItem } from './ReceiptItem';
import { ReceiptFooter } from './ReceiptFooter';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { resolveAccessMode } from '../../features/ledger/access-mode';
import { PackageOpen, Printer } from 'lucide-react';

interface ReceiptViewProps {
  /** 已按日期分组的交易（由 use-ledger 统一计算） */
  dateGroups: DateGroup[];
  /** 当前筛选后的交易，用于分类汇总 */
  transactions: Transaction[];
  stats: SummaryStats;
  selectedMonth: string;
  hasFullAccess?: boolean;
  isAdmin?: boolean;
  /** 当前选中的分类，用于汇总面板高亮 */
  activeCategory?: string;
  onSelectCategory?: (category: string) => void;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({
  dateGroups,
  transactions,
  stats,
  selectedMonth,
  hasFullAccess = true,
  isAdmin = false,
  activeCategory = 'ALL',
  onSelectCategory,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prevMonthRef = useRef(selectedMonth);

  // 当切换月份时触发 1.65s 的激光打字与出纸效果
  useEffect(() => {
    if (prevMonthRef.current !== selectedMonth) {
      prevMonthRef.current = selectedMonth;
      setIsPrinting(true);
      setExpandedId(null);
      const timer = setTimeout(() => {
        setIsPrinting(false);
      }, 1650);
      return () => clearTimeout(timer);
    }
  }, [selectedMonth]);

  const currentMode = resolveAccessMode(isAdmin, hasFullAccess);

  const printerIconColorClass =
    currentMode === 'admin'
      ? 'text-emerald-400'
      : currentMode === 'decrypted'
      ? 'text-blue-400'
      : 'text-rose-500';

  const indicatorLedClass =
    currentMode === 'admin'
      ? isPrinting
        ? 'bg-emerald-400 shadow-[0_0_12px_#34d399] animate-ping'
        : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
      : currentMode === 'decrypted'
      ? isPrinting
        ? 'bg-blue-400 shadow-[0_0_12px_#60a5fa] animate-ping'
        : 'bg-blue-500 shadow-[0_0_8px_#3b82f6]'
      : isPrinting
      ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-ping'
      : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]';

  const laserBeamClass =
    currentMode === 'admin'
      ? 'via-emerald-300 shadow-[0_0_25px_#34d399,0_0_45px_#10b981]'
      : currentMode === 'decrypted'
      ? 'via-cyan-300 shadow-[0_0_25px_#22d3ee,0_0_45px_#3b82f6]'
      : 'via-rose-400 shadow-[0_0_25px_#f43f5e,0_0_45px_#e11d48]';

  return (
    <div className="flex flex-col items-center justify-start my-2 px-1 relative w-full max-w-md mx-auto">
      {/* 顶部拟真热敏打印机机头 */}
      <div
        className={`w-[104%] z-30 printer-slot-head border border-slate-700/80 rounded-t-xl p-2.5 shadow-2xl flex items-center justify-between font-pixel relative no-print mb-[-6px] transition-transform ${
          isPrinting ? 'animate-machine-vibrate' : ''
        }`}
      >
        <Printer className={`w-4 h-4 mx-auto ${printerIconColorClass} transition-colors duration-300 animate-pulse`} />

        <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full transition-all duration-300 ${indicatorLedClass}`} />

        <div className="absolute inset-x-3 bottom-0 h-1 bg-black rounded-full shadow-inner border-t border-slate-900" />
      </div>

      {/* 小票展示区域 */}
      <div className="w-full relative overflow-hidden pt-1 min-h-[300px]">
        {isPrinting && (
          <div
            className={`absolute inset-x-0 h-2 bg-gradient-to-r from-transparent ${laserBeamClass} to-transparent pointer-events-none z-50 animate-laser-scan-slow`}
          />
        )}

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={selectedMonth || 'all'}
            initial={{
              opacity: 0.1,
              y: -90,
              clipPath: 'inset(0% 0% 100% 0%)',
            }}
            animate={{
              opacity: 1,
              y: 0,
              clipPath: 'inset(0% 0% 0% 0%)',
            }}
            exit={{
              opacity: 0,
              y: 120,
              scale: 0.94,
              transition: { duration: 0.3, ease: 'easeIn' },
            }}
            transition={{
              duration: 1.65,
              ease: [0.25, 1, 0.5, 1],
            }}
            className="receipt-container receipt-paper-box receipt-both-sawtooth font-pixel relative w-full p-4 sm:p-5 rounded-sm shadow-2xl"
          >
            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-black/10 to-transparent pointer-events-none" />

            <div className={isPrinting ? 'animate-ink-develop' : ''}>
              <ReceiptHeader />

              <CategorySummary
                transactions={transactions}
                hasFullAccess={hasFullAccess}
                isPrinting={isPrinting}
                activeCategory={activeCategory}
                onSelectCategory={onSelectCategory}
              />

              {/* 明细清单框线表格 */}
              <div className="my-3 border-2 border-current/40 rounded-xl overflow-hidden shadow-xs">
                <div className="grid grid-cols-[1.9fr_0.9fr_1.25fr_1.15fr] divide-x divide-current/30 border-b-2 border-current/40 text-center text-xs font-black py-1.5 bg-current/10 font-pixel tracking-wide">
                  <div>备注</div>
                  <div>成员</div>
                  <div>分类</div>
                  <div>金额</div>
                </div>

                {dateGroups.length === 0 ? (
                  <div className="py-12 text-center text-xs opacity-50 font-pixel flex flex-col items-center gap-2">
                    <PackageOpen className="w-7 h-7 opacity-40" />
                    <span>本月暂无记账明细</span>
                  </div>
                ) : (
                  dateGroups.map((group) => (
                    <React.Fragment key={group.date}>
                      {/* 日期子抬头 */}
                      <div className="bg-current/20 px-2.5 py-1 font-pixel text-xs font-black border-y border-current/30 text-center tracking-normal opacity-90 shadow-inner">
                        <span>{group.shortDate}</span>
                      </div>

                      {group.items.map((t) => (
                        <React.Fragment key={t.id}>
                          <ReceiptItem
                            transaction={t}
                            hasFullAccess={hasFullAccess}
                            isPrinting={isPrinting}
                            isActive={expandedId === t.id}
                            onClick={() => setExpandedId((prev) => (prev === t.id ? null : t.id))}
                          />
                          {expandedId === t.id && (
                            <TransactionDetailSheet
                              transaction={t}
                              hasFullAccess={hasFullAccess}
                              isPrinting={isPrinting}
                              onClose={() => setExpandedId(null)}
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </div>

              <ReceiptFooter
                stats={stats}
                hasFullAccess={hasFullAccess}
                isPrinting={isPrinting}
              />
            </div>

            <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
