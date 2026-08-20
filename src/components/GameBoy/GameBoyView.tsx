import React from 'react';
import type { Transaction, SummaryStats } from '../../types';
import { ReceiptHeader } from '../Receipt/ReceiptHeader';
import { ReceiptItem } from '../Receipt/ReceiptItem';
import { ReceiptFooter } from '../Receipt/ReceiptFooter';
import { Gamepad2, PackageOpen } from 'lucide-react';

interface GameBoyViewProps {
  transactions: Transaction[];
  stats: SummaryStats;
  selectedMonth: string;
  hasFullAccess?: boolean;
  isAdmin?: boolean;
}

export const GameBoyView: React.FC<GameBoyViewProps> = ({
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
      <div className="w-full bg-[#d0d0d7] border-4 border-[#b0b0b8] rounded-[36px] p-5 shadow-2xl relative overflow-hidden flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-3 px-2">
          <div className="flex items-center gap-1.5 text-[11px] font-pixel font-bold text-slate-700 tracking-widest uppercase">
            <Gamepad2 className="w-4 h-4 text-rose-600" />
            <span>GAMEBOY LEDGER</span>
          </div>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-500 shadow-inner" />
            <div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-500 shadow-inner" />
          </div>
        </div>

        <div className="w-full bg-[#525266] rounded-2xl p-4 border-2 border-slate-700 shadow-inner relative overflow-hidden">
          <div className="flex justify-between items-center mb-2 px-1 text-[9px] font-pixel tracking-widest">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_#ef4444] animate-pulse" />
              <span className="text-slate-300 font-bold">BATTERY</span>
            </div>
            <div className="text-slate-300 font-bold flex items-center gap-1">
              <span className="text-rose-400">DOT MATRIX</span> WITH STEREO SOUND
            </div>
          </div>

          <div className="w-full bg-[#e2f4c7] text-[#082008] font-pixel p-3.5 rounded-lg border-4 border-[#2b582b] gameboy-lcd-shadow relative overflow-hidden min-h-[360px]">
            <div className="absolute inset-0 gameboy-scanline pointer-events-none z-10" />

            <div className="flex justify-between items-center border-b-2 border-[#2b582b] pb-1.5 mb-2.5 text-xs font-black tracking-widest">
              <span className="text-[#082008] font-bold">★ 8-BIT LEDGER ★</span>
              <span className="px-2 py-0.5 bg-[#c8e6a4] border border-[#2b582b] rounded text-[10px] font-bold text-[#082008]">
                {currentMode}
              </span>
            </div>

            <ReceiptHeader
              selectedMonth={selectedMonth}
              transactions={transactions}
              hasFullAccess={hasFullAccess}
              themeStyle="gameboy"
            />

            {/* 结构化表格组件 */}
            <div className="my-3 border-2 border-[#2b582b] rounded-xl overflow-hidden bg-[#d8ecc0]/50">
              <div className="grid grid-cols-4 divide-x divide-[#2b582b] border-b-2 border-[#2b582b] text-center text-xs font-black py-1.5 bg-[#c8e6a4] tracking-widest uppercase">
                <div>备注</div>
                <div>金额</div>
                <div>成员</div>
                <div>分类</div>
              </div>

              {dateGroups.length === 0 ? (
                <div className="py-12 text-center text-xs font-pixel flex flex-col items-center gap-2 text-[#2b582b]">
                  <PackageOpen className="w-7 h-7 text-[#2b582b]" />
                  <span className="font-bold">NO DATA THIS MONTH</span>
                </div>
              ) : (
                dateGroups.map((group) => (
                  <React.Fragment key={group.date}>
                    <div className="bg-[#c8e6a4] px-2.5 py-1 font-pixel text-xs font-black border-y border-[#2b582b] text-[#082008] text-left tracking-wider">
                      <span>{group.shortDate}</span>
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
          </div>
        </div>

        <div className="w-full flex justify-between items-center mt-5 px-3">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute w-16 h-5 bg-[#3a3a42] rounded-sm border border-slate-700 shadow-md" />
            <div className="absolute w-5 h-16 bg-[#3a3a42] rounded-sm border border-slate-700 shadow-md" />
            <div className="absolute w-3 h-3 bg-slate-800 rounded-full" />
          </div>

          <div className="flex gap-3 transform -rotate-12">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-[#8c1d40] border-2 border-[#61122a] shadow-md flex items-center justify-center font-bold text-white text-xs font-mono">
                B
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-[#8c1d40] border-2 border-[#61122a] shadow-md flex items-center justify-center font-bold text-white text-xs font-mono">
                A
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <div className="flex flex-col items-center">
            <div className="w-10 h-3 bg-[#71717a] rounded-full border border-slate-600 transform -rotate-25 shadow-inner" />
            <span className="text-[8px] font-bold text-slate-500 mt-1 font-mono">SELECT</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-10 h-3 bg-[#71717a] rounded-full border border-slate-600 transform -rotate-25 shadow-inner" />
            <span className="text-[8px] font-bold text-slate-500 mt-1 font-mono">START</span>
          </div>
        </div>
      </div>
    </div>
  );
};
