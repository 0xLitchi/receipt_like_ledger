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

  // 2. 放慢打印吐纸与激光打字扫描速度至 1.65s (1650ms)
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
      {/* 1. 顶部拟真热敏打印机机头，修改标头为“荔枝牌小票打印机”，附带马达高频微幅震动 */}
      <div
        className={`w-[104%] z-30 printer-slot-head border border-slate-700/80 rounded-t-xl p-2.5 shadow-2xl flex items-center justify-between font-mono relative no-print mb-[-6px] transition-transform ${
          isPrinting ? 'animate-machine-vibrate' : ''
        }`}
      >
        {/* 打印机品牌标 */}
        <div className="flex items-center gap-2">
          <Printer className="w-4.5 h-4.5 text-emerald-400 animate-pulse" />
          <span className="text-[12px] font-black tracking-widest text-slate-200 uppercase font-mono">
            荔枝牌小票打印机
          </span>
        </div>

        {/* 打印工作状态指示灯 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono font-bold">
            {isPrinting ? '打印中...' : '就绪'}
          </span>
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              isPrinting
                ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] animate-ping'
                : 'bg-emerald-500/80 shadow-[0_0_6px_#10b981]'
            }`}
          />
        </div>

        {/* 出纸缝隙 */}
        <div className="absolute inset-x-3 bottom-0 h-1 bg-black rounded-full shadow-inner border-t border-slate-900" />
      </div>

      {/* 小票出纸与放慢后的激光打字扫描区域 */}
      <div className="w-full relative overflow-hidden pt-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={selectedMonth}
            initial={{
              opacity: 0.1,
              y: -100,
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
              transition: { duration: 0.35, ease: 'easeIn' },
            }}
            transition={{
              duration: 1.65,
              ease: [0.25, 1, 0.5, 1],
            }}
            className="receipt-container receipt-paper-box receipt-both-sawtooth font-mono relative w-full p-4 sm:p-5 rounded-sm shadow-2xl"
          >
            {/* 放慢后的激光扫描打字光束 (1.65s 从上至下滑动显影) */}
            {isPrinting && (
              <div className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_#34d399,0_0_35px_#10b981] pointer-events-none z-40 animate-laser-scan-slow" />
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
