import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Transaction, SummaryStats } from '../../types';
import { ReceiptHeader } from './ReceiptHeader';
import { ReceiptItem } from './ReceiptItem';
import { ReceiptFooter } from './ReceiptFooter';
import { PackageOpen, Printer } from 'lucide-react';

interface ReceiptViewProps {
  transactions: Transaction[];
  stats: SummaryStats;
  selectedMonth: string;
  hasFullAccess?: boolean;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({
  transactions,
  stats,
  selectedMonth,
  hasFullAccess = true,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const prevMonthRef = useRef(selectedMonth);

  // 当切换月份时触发 1.65s 拍立得暗房热感显影与出纸效果
  useEffect(() => {
    if (prevMonthRef.current !== selectedMonth) {
      prevMonthRef.current = selectedMonth;
      setIsPrinting(true);
      const timer = setTimeout(() => {
        setIsPrinting(false);
      }, 1650);
      return () => clearTimeout(timer);
    }
  }, [selectedMonth]);

  // 将交易记录按日期分组倒序排列
  const dateGroups = React.useMemo(() => {
    const map = new Map<string, Transaction[]>();

    transactions.forEach((t) => {
      const d = t.date || '未知日期';
      const list = map.get(d) || [];
      list.push(t);
      map.set(d, list);
    });

    const sortedDates = Array.from(map.keys()).sort().reverse();

    return sortedDates.map((d) => ({
      date: d,
      shortDate: d.length >= 10 ? d.substring(5) : d,
      items: map.get(d) || [],
    }));
  }, [transactions]);

  return (
    <div className="flex flex-col items-center justify-start my-2 px-1 relative w-full max-w-md mx-auto">
      {/* 顶部拟真热敏打印机机头 */}
      <div
        className={`w-[104%] z-30 printer-slot-head border border-slate-700/80 rounded-t-xl p-2.5 shadow-2xl flex items-center justify-between font-pixel relative no-print mb-[-6px] transition-transform ${
          isPrinting ? 'animate-machine-vibrate' : ''
        }`}
      >
        <div className="flex items-center">
          <Printer className="w-4 h-4 text-rose-400 opacity-90 animate-pulse" />
        </div>

        <div className="flex items-center">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              isPrinting
                ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-ping'
                : 'bg-emerald-500/80 shadow-[0_0_6px_#10b981]'
            }`}
          />
        </div>

        <div className="absolute inset-x-3 bottom-0 h-1 bg-black rounded-full shadow-inner border-t border-slate-900" />
      </div>

      {/* 小票展示区域 (拍立得暗房热感显影效果) */}
      <div className="w-full relative overflow-hidden pt-1 min-h-[300px]">
        {/* 拍立得暗房热感显影激光光束 (暖红+金橙色发光线 z-50 顶层) */}
        {isPrinting && (
          <div className="absolute inset-x-0 h-2.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_30px_#f43f5e,0_0_50px_#fb923c] pointer-events-none z-50 animate-polaroid-laser" />
        )}

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={selectedMonth}
            initial={{
              opacity: 0.2,
              y: -80,
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

            {/* 小票内容区域 (在显影过程中执行由浅入深 animate-ink-develop 墨迹呈现) */}
            <div className={isPrinting ? 'animate-ink-develop' : ''}>
              <ReceiptHeader
                selectedMonth={selectedMonth}
                transactions={transactions}
                hasFullAccess={hasFullAccess}
                isPrinting={isPrinting}
              />

              <div className="my-2 min-h-[140px]">
                {dateGroups.length === 0 ? (
                  <div className="py-12 text-center text-xs opacity-50 font-pixel flex flex-col items-center gap-2">
                    <PackageOpen className="w-7 h-7 opacity-40" />
                    <span>本月暂无记账明细</span>
                  </div>
                ) : (
                  dateGroups.map((group) => (
                    <div key={group.date} className="my-2">
                      <div className="bg-black/5 py-0.5 px-2 my-1 font-pixel text-xs font-black border-y border-dashed border-current/30 text-left tracking-wider">
                        <span>{group.shortDate}</span>
                      </div>

                      {group.items.map((t) => (
                        <ReceiptItem
                          key={t.id}
                          transaction={t}
                          hasFullAccess={hasFullAccess}
                          isPrinting={isPrinting}
                        />
                      ))}
                    </div>
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
