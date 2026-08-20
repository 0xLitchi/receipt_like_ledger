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
      <div className="w-full bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl shadow-md">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white">Apple Wallet Pass</h2>
              <p className="text-[11px] text-slate-400 font-mono">Monthly Statement</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-[10px] font-mono font-bold rounded-full border border-slate-700">
            {currentMode}
          </span>
        </div>

        <div className="bg-white text-slate-900 rounded-2xl p-4 shadow-xl border border-slate-200">
          <ReceiptHeader
            selectedMonth={selectedMonth}
            transactions={transactions}
            hasFullAccess={hasFullAccess}
          />

          {/* 结构化表格组件 */}
          <div className="my-3 border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-4 divide-x divide-slate-300 border-b-2 border-slate-300 text-center text-xs font-black py-1.5 bg-slate-100 tracking-widest uppercase">
              <div>备注</div>
              <div>金额</div>
              <div>成员</div>
              <div>分类</div>
            </div>

            {dateGroups.length === 0 ? (
              <div className="py-12 text-center text-xs font-pixel flex flex-col items-center gap-2 text-slate-400">
                <PackageOpen className="w-7 h-7 text-slate-300" />
                <span>本月暂无记账明细</span>
              </div>
            ) : (
              dateGroups.map((group) => (
                <React.Fragment key={group.date}>
                  <div className="bg-slate-100 px-2.5 py-1 font-mono text-xs font-black border-y border-slate-300 text-slate-800 text-left tracking-wider">
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
    </div>
  );
};
