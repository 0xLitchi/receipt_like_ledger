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

  // 当月份改变时，触发拟真热敏打印头激光逐行扫描吐纸动画
  useEffect(() => {
    if (prevMonthRef.current !== selectedMonth) {
      prevMonthRef.current = selectedMonth;
      setIsPrinting(true);
      const timer = setTimeout(() => {
        setIsPrinting(false);
      }, 950);
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
      {/* 顶部拟真热敏打印机机头 (Metallic Thermal Printer Machine Head) */}
      <div className="w-[104%] z-30 printer-slot-head border border-slate-700/80 rounded-t-xl p-2.5 shadow-2xl flex items-center justify-between font-mono relative no-print mb-[-6px]">
        {/* 打印机品牌标与机头图标 */}
        <div className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-widest text-slate-300 uppercase">
            THERMAL PRINT HEAD
          </span>
        </div>

        {/* 热敏打印机运行/工作指示灯 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono">
            {isPrinting ? 'PRINTING...' : 'READY'}
          </span>
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              isPrinting
                ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] animate-ping'
                : 'bg-emerald-500/80 shadow-[0_0_6px_#10b981]'
            }`}
          />
        </div>

        {/* 机头底部出纸口细缝 */}
        <div className="absolute inset-x-3 bottom-0 h-1 bg-black rounded-full shadow-inner border-t border-slate-900" />
      </div>

      {/* 小票展示区域（带有 Framer Motion 逐行吐纸与激光打字扫描效果） */}
      <div className="w-full relative overflow-hidden pt-1">
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
              y: 100,
              scale: 0.95,
              transition: { duration: 0.25 },
            }}
            transition={{
              type: 'spring',
              stiffness: 180,
              damping: 22,
              mass: 0.8,
            }}
            className="receipt-container receipt-paper-box receipt-both-sawtooth font-mono relative w-full p-4 sm:p-5 rounded-sm shadow-2xl"
          >
            {/* 激光扫描打字光束 (仅在打印出纸过程中显现) */}
            {isPrinting && (
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399,0_0_30px_#10b981] pointer-events-none z-40 animate-laser-scan" />
            )}

            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-black/10 to-transparent pointer-events-none" />

            <ReceiptHeader
              selectedMonth={selectedMonth}
              transactions={transactions}
              hasFullAccess={hasFullAccess}
            />

            <div className="my-2 min-h-[140px]">
              {dateGroups.length === 0 ? (
                <div className="py-12 text-center text-xs opacity-50 font-mono flex flex-col items-center gap-2">
                  <PackageOpen className="w-7 h-7 opacity-40" />
                  <span>本月暂无记账明细</span>
                </div>
              ) : (
                dateGroups.map((group) => (
                  <div key={group.date} className="my-2">
                    {/* 子抬头 */}
                    <div className="bg-black/5 py-0.5 px-2 my-1 font-mono text-[11px] font-black border-y border-dashed border-current/30 text-left tracking-wider">
                      <span>{group.shortDate}</span>
                    </div>

                    {/* 行明细 */}
                    {group.items.map((t) => (
                      <ReceiptItem
                        key={t.id}
                        transaction={t}
                        hasFullAccess={hasFullAccess}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>

            <ReceiptFooter
              stats={stats}
              hasFullAccess={hasFullAccess}
            />

            <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
