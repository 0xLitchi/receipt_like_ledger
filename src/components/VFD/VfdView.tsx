import React from 'react';
import type { Transaction, SummaryStats } from '../../types';
import { ReceiptHeader } from '../Receipt/ReceiptHeader';
import { ReceiptItem } from '../Receipt/ReceiptItem';
import { ReceiptFooter } from '../Receipt/ReceiptFooter';
import { Tv, PackageOpen, Activity } from 'lucide-react';

interface VfdViewProps {
  transactions: Transaction[];
  stats: SummaryStats;
  selectedMonth: string;
  hasFullAccess?: boolean;
  isAdmin?: boolean;
}

export const VfdView: React.FC<VfdViewProps> = ({
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
      {/* VFD 荧光管收银机外壳 */}
      <div className="w-full bg-[#0d1217] border-4 border-slate-800 rounded-3xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.1)] relative overflow-hidden text-[#14ffec]">
        {/* 顶部收银机操作栏 */}
        <div className="w-full flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#051f22] border border-[#14ffec]/30 rounded-lg text-[#14ffec]">
              <Tv className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-[#14ffec] drop-shadow-[0_0_6px_rgba(20,255,236,0.6)]">
                VFD POS TERMINAL
              </div>
              <div className="text-[9px] text-[#14ffec]/60">MODEL 824-VFD / VACUUM FLUORESCENT</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#14ffec] animate-pulse" />
            <span className="px-2 py-0.5 bg-[#052225] border border-[#14ffec]/40 text-[#14ffec] text-[10px] font-bold rounded shadow-[0_0_8px_rgba(20,255,236,0.3)]">
              {currentMode}
            </span>
          </div>
        </div>

        {/* 荧光亚克力玻璃面板 */}
        <div className="w-full bg-[#051417] rounded-2xl p-4 border-2 border-[#14ffec]/30 shadow-[inset_0_0_25px_rgba(20,255,236,0.15)] relative overflow-hidden min-h-[360px]">
          {/* 玻璃反光与扫描线质感 */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(20,255,236,0.03)_1px,transparent_1px)] [background-size:100%_4px] pointer-events-none z-10" />
          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none z-10" />

          <ReceiptHeader
            selectedMonth={selectedMonth}
            transactions={transactions}
            hasFullAccess={hasFullAccess}
            themeStyle="vfd"
          />

          {/* VFD 数据明细列表 */}
          <div className="my-3 border border-[#14ffec]/30 rounded-xl overflow-hidden bg-[#030d0f] shadow-[0_0_15px_rgba(20,255,236,0.1)]">
            <div className="grid grid-cols-4 divide-x divide-[#14ffec]/20 border-b border-[#14ffec]/30 text-center text-xs font-black py-1.5 bg-[#052226] text-[#14ffec] tracking-widest uppercase">
              <div>DESC</div>
              <div>USER</div>
              <div>CAT</div>
              <div>AMOUNT</div>
            </div>

            {dateGroups.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#14ffec]/50 flex flex-col items-center gap-2">
                <PackageOpen className="w-7 h-7 text-[#14ffec]/40" />
                <span className="font-bold">*** NO TRANSACTIONS ***</span>
              </div>
            ) : (
              dateGroups.map((group) => (
                <React.Fragment key={group.date}>
                  <div className="bg-[#06292e] px-2.5 py-1 font-mono text-xs font-bold border-y border-[#14ffec]/20 text-[#14ffec] text-left tracking-wider flex items-center justify-between">
                    <span>&gt;&gt; DATE: {group.shortDate}</span>
                    <span className="text-[10px] text-[#14ffec]/70">READY</span>
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
    </div>
  );
};
