import React from 'react';
import type { Transaction, SummaryStats } from '../../types';
import { ReceiptHeader } from '../Receipt/ReceiptHeader';
import { ReceiptItem } from '../Receipt/ReceiptItem';
import { ReceiptFooter } from '../Receipt/ReceiptFooter';
import { CreditCard, PackageOpen } from 'lucide-react';

interface WalletViewProps {
  transactions: Transaction[];
  stats: SummaryStats;
  selectedMonth: string;
  hasFullAccess?: boolean;
  isAdmin?: boolean;
}

export const WalletView: React.FC<WalletViewProps> = ({
  transactions,
  stats,
  selectedMonth,
  hasFullAccess = true,
  isAdmin = false,
}) => {
  // 按日期分组
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
    <div className="flex flex-col items-center justify-start my-2 px-1 relative w-full max-w-md mx-auto select-none font-sans">
      {/* iOS 极简 Apple Wallet 纯白卡片 */}
      <div className="w-full bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-[32px] p-6 shadow-[0_20px_50px_rgba(15,23,42,0.35)] relative overflow-hidden text-slate-800">
        {/* 顶部 Apple Pass 卡片顶栏 */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-700 text-white rounded-2xl shadow-md">
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 tracking-tight">Apple Wallet Ledger</h2>
              <p className="text-[11px] text-slate-400 font-mono">Receipt-Like Pass</p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider ${
              currentMode === 'ADMIN'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : currentMode === 'DECRYPTED'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {currentMode}
          </span>
        </div>

        {/* 账单 Header */}
        <ReceiptHeader
          selectedMonth={selectedMonth}
          transactions={transactions}
          hasFullAccess={hasFullAccess}
        />

        {/* 账单列表项 */}
        <div className="my-3 min-h-[140px]">
          {dateGroups.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <PackageOpen className="w-7 h-7 text-slate-300" />
              <span>暂无本月账单数据</span>
            </div>
          ) : (
            dateGroups.map((group) => (
              <div key={group.date} className="my-3">
                <div className="px-3 py-1 bg-slate-100/60 rounded-lg text-[11px] font-mono font-bold text-slate-400 my-1.5 text-left w-fit">
                  {group.shortDate}
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

        {/* 账单 Footer 汇总 */}
        <ReceiptFooter
          stats={stats}
          hasFullAccess={hasFullAccess}
        />
      </div>
    </div>
  );
};
