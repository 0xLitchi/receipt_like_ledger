import React from 'react';
import type { Transaction, SummaryStats } from '../../types';
import { ReceiptHeader } from '../Receipt/ReceiptHeader';
import { ReceiptItem } from '../Receipt/ReceiptItem';
import { ReceiptFooter } from '../Receipt/ReceiptFooter';
import { Printer, PackageOpen } from 'lucide-react';

interface TractorPaperViewProps {
  transactions: Transaction[];
  stats: SummaryStats;
  selectedMonth: string;
  hasFullAccess?: boolean;
  isAdmin?: boolean;
}

export const TractorPaperView: React.FC<TractorPaperViewProps> = ({
  transactions,
  stats,
  selectedMonth,
  hasFullAccess = true,
  isAdmin = false,
}) => {
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

  const currentMode = isAdmin ? 'ADMIN' : hasFullAccess ? 'DECRYPTED' : 'MASKED';

  // 两侧针式连打孔数组 (14 个定位孔)
  const holes = Array.from({ length: 14 });

  return (
    <div className="flex flex-col items-center justify-start my-2 px-1 relative w-full max-w-md mx-auto select-none font-mono">
      {/* 90s 复古针式连续打印纸 (经典暖黄白斑马条纹纸 + 深灰定位边孔，绝不混色，高对比度清晰大字) */}
      <div className="w-full bg-[#fbf9f4] border-2 border-slate-700/40 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden flex text-slate-900 rounded-sm">
        {/* 左侧连打拉纸边框 (Left Tractor Feed Margin) */}
        <div className="w-7 border-r-2 border-dashed border-slate-400/40 bg-[#eee9dc] flex flex-col justify-between py-4 items-center shrink-0">
          {holes.map((_, i) => (
            <div
              key={i}
              className="w-3.5 h-3.5 rounded-full bg-slate-900 shadow-inner border border-slate-400"
            />
          ))}
        </div>

        {/* 中间主打印区 (斑马线淡黄白相间纸面) */}
        <div className="flex-1 p-4 bg-[linear-gradient(to_bottom,#fbf9f4_50%,#f1ece0_50%)] bg-[length:100%_48px] overflow-hidden">
          {/* 顶栏 */}
          <div className="flex items-center justify-between border-b-2 border-slate-900/40 pb-2 mb-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-900">
              <Printer className="w-4 h-4 text-slate-700" />
              <span>CONTINUOUS PRINT-OUT</span>
            </div>
            <span className="px-2 py-0.5 bg-slate-800 text-slate-100 text-[10px] font-bold rounded">
              {currentMode}
            </span>
          </div>

          <ReceiptHeader
            selectedMonth={selectedMonth}
            transactions={transactions}
            hasFullAccess={hasFullAccess}
          />

          <div className="my-3 min-h-[140px]">
            {dateGroups.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-600 flex flex-col items-center gap-2">
                <PackageOpen className="w-7 h-7 text-slate-500" />
                <span className="font-bold">*** NO DATA PRINTED ***</span>
              </div>
            ) : (
              dateGroups.map((group) => (
                <div key={group.date} className="my-2">
                  <div className="py-0.5 px-2 bg-slate-900/5 border-y border-slate-900/20 text-slate-500 font-bold text-xs my-1 text-left">
                    === {group.shortDate} ===
                  </div>

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
        </div>

        {/* 右侧连打拉纸边框 (Right Tractor Feed Margin) */}
        <div className="w-7 border-l-2 border-dashed border-slate-400/40 bg-[#eee9dc] flex flex-col justify-between py-4 items-center shrink-0">
          {holes.map((_, i) => (
            <div
              key={i}
              className="w-3.5 h-3.5 rounded-full bg-slate-900 shadow-inner border border-slate-400"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
