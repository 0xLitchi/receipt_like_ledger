import React, { useState, useEffect, useRef } from 'react';
import type { Transaction, SummaryStats } from '../../types';
import { ReceiptHeader } from './ReceiptHeader';
import { ReceiptItem } from './ReceiptItem';
import { ReceiptFooter } from './ReceiptFooter';
import { PackageOpen } from 'lucide-react';

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
  const [isAnimating, setIsAnimating] = useState(false);
  const prevMonthRef = useRef(selectedMonth);

  // 4. 当切换月份时触发纸张撕裂碎裂再重组拼装动画
  useEffect(() => {
    if (prevMonthRef.current !== selectedMonth) {
      prevMonthRef.current = selectedMonth;
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 650);
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
    <div className="flex justify-center my-2 px-1">
      {/* 拟物化小票主体 (附带纸张撕裂粉碎重组动画 animate-paper-shred) */}
      <div
        className={`receipt-container receipt-paper-box receipt-both-sawtooth font-mono relative w-full max-w-md p-4 sm:p-5 transition-all duration-300 rounded-sm ${
          isAnimating ? 'animate-paper-shred' : ''
        }`}
      >
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
                {/* 1. 子抬头仅保留日期，去除了数据条数 */}
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
      </div>
    </div>
  );
};
