import React from 'react';
import type { Transaction, SummaryStats } from '../../types';
import { ReceiptHeader } from '../Receipt/ReceiptHeader';
import { ReceiptItem } from '../Receipt/ReceiptItem';
import { ReceiptFooter } from '../Receipt/ReceiptFooter';
import { Plane, PackageOpen, QrCode } from 'lucide-react';

interface BoardingPassViewProps {
  transactions: Transaction[];
  stats: SummaryStats;
  selectedMonth: string;
  hasFullAccess?: boolean;
  isAdmin?: boolean;
}

export const BoardingPassView: React.FC<BoardingPassViewProps> = ({
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

  return (
    <div className="flex flex-col items-center justify-start my-2 px-1 relative w-full max-w-md mx-auto select-none font-mono">
      {/* 航空登机牌机票卡片 */}
      <div className="w-full bg-[#faf9f5] border-2 border-slate-300 rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.15)] relative overflow-hidden text-slate-800">
        {/* 顶部红蓝航空磁条 */}
        <div className="w-full h-3 bg-[repeating-linear-gradient(45deg,#1d4ed8,#1d4ed8_12px,#ef4444_12px,#ef4444_24px,#ffffff_24px,#ffffff_32px)] border-b border-slate-300" />

        {/* 登机牌顶栏信息 */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black tracking-widest text-white uppercase">BOARDING PASS / 航班账单</div>
              <div className="text-[10px] text-blue-200 font-mono">FLIGHT: {selectedMonth.replace('-', '')} · GATE: 08 · SEAT: 24A</div>
            </div>
          </div>
          <div className="text-right">
            <span className="px-2 py-0.5 bg-blue-500/30 border border-blue-400 text-blue-200 text-[10px] font-bold rounded">
              {currentMode}
            </span>
            <div className="text-[9px] text-blue-300/80 mt-1">CLASS: FIRST</div>
          </div>
        </div>

        {/* 登机牌主联正文 */}
        <div className="p-4 bg-[#faf9f5] relative">
          <ReceiptHeader
            selectedMonth={selectedMonth}
            transactions={transactions}
            hasFullAccess={hasFullAccess}
            themeStyle="boarding_pass"
          />

          {/* 行李流水明细表 */}
          <div className="my-3 border-2 border-slate-800/80 rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="grid grid-cols-4 divide-x divide-slate-800/30 border-b-2 border-slate-800/80 text-center text-xs font-black py-2 bg-slate-100 text-slate-900 tracking-wider uppercase">
              <div>ITEM</div>
              <div>PASSENGER</div>
              <div>TAG</div>
              <div>CHARGE</div>
            </div>

            {dateGroups.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <PackageOpen className="w-7 h-7 text-slate-300" />
                <span className="font-bold">NO BAGGAGE / EXPENSES RECORDED</span>
              </div>
            ) : (
              dateGroups.map((group) => (
                <React.Fragment key={group.date}>
                  <div className="bg-blue-50 px-3 py-1 font-mono text-xs font-black border-y border-slate-800/20 text-blue-900 text-left tracking-wider flex items-center justify-between">
                    <span>FLT-DATE: {group.shortDate}</span>
                    <span className="text-[10px] text-blue-600 uppercase font-bold">VERIFIED</span>
                  </div>

                  {group.items.map((t) => (
                    <ReceiptItem
                      key={t.id}
                      transaction={t}
                      hasFullAccess={hasFullAccess}
                    />
                  ))}
                </React.Fragment>
              ))
            )}
          </div>

          <ReceiptFooter
            stats={stats}
            hasFullAccess={hasFullAccess}
          />

          {/* 底部条形码与二维码联 */}
          <div className="mt-3 pt-3 border-t-2 border-dashed border-slate-300 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="text-[9px] font-bold text-slate-500 tracking-wider">ELECTRONIC TICKET / ETKT</div>
              <div className="h-6 flex items-center gap-0.5">
                {Array.from({ length: 42 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-full bg-slate-900 ${i % 3 === 0 ? 'w-1' : i % 5 === 0 ? 'w-1.5' : 'w-0.5'}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-lg border border-slate-200 text-slate-700">
              <QrCode className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
