import React from 'react';
import type { Transaction, SummaryStats } from '../../types';
import { ReceiptHeader } from '../Receipt/ReceiptHeader';
import { ReceiptItem } from '../Receipt/ReceiptItem';
import { ReceiptFooter } from '../Receipt/ReceiptFooter';
import { BookOpen, PackageOpen, Stamp } from 'lucide-react';

interface PassbookViewProps {
  transactions: Transaction[];
  stats: SummaryStats;
  selectedMonth: string;
  hasFullAccess?: boolean;
  isAdmin?: boolean;
}

export const PassbookView: React.FC<PassbookViewProps> = ({
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
      {/* 经典复古银行存折外壳 (酒红深色仿皮纹路外框) */}
      <div className="w-full bg-[#3b1216] border-4 border-[#24080a] rounded-2xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative overflow-hidden text-[#1f1a30]">
        {/* 存折顶部烫金标题栏 */}
        <div className="w-full bg-[#4a171c] border border-[#6b252c] rounded-xl px-4 py-2.5 mb-2.5 flex items-center justify-between text-amber-200 shadow-inner">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-300" />
            <div>
              <div className="text-xs font-bold tracking-widest text-amber-100">活期储蓄存折</div>
              <div className="text-[9px] tracking-wider text-amber-300/70 font-mono">PASSBOOK NO. {selectedMonth.replace('-', '')}</div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="px-2 py-0.5 bg-[#2c0b0f] text-amber-300 border border-amber-400/40 text-[9px] font-bold rounded">
              {currentMode}
            </span>
            <span className="text-[8px] text-amber-200/50 mt-0.5">网点号: 0824</span>
          </div>
        </div>

        {/* 存折内页米黄色网格流水纸面 */}
        <div className="w-full bg-[#fbf7ee] rounded-xl p-4 border border-[#e3dbc7] shadow-sm relative overflow-hidden bg-[radial-gradient(#d6cbb2_0.75px,transparent_0.75px)] [background-size:12px_12px]">
          {/* 红色业务印章装饰 */}
          <div className="absolute right-3 bottom-14 pointer-events-none opacity-20 rotate-[-12deg] z-0">
            <div className="w-20 h-20 rounded-full border-4 border-red-600 flex flex-col items-center justify-center text-red-600 text-[10px] font-black p-1 text-center leading-tight">
              <span>★ 业务核算 ★</span>
              <span className="text-[8px]">专用章</span>
              <span className="text-[7px]">{selectedMonth}</span>
            </div>
          </div>

          <ReceiptHeader
            selectedMonth={selectedMonth}
            transactions={transactions}
            hasFullAccess={hasFullAccess}
            themeStyle="passbook"
          />

          {/* 存折流水表格 */}
          <div className="my-3 border border-[#c7ba9d] rounded-lg overflow-hidden bg-[#fffdf8] shadow-xs relative z-10">
            <div className="grid grid-cols-4 divide-x divide-[#c7ba9d] border-b border-[#c7ba9d] text-center text-xs font-black py-1.5 bg-[#ede4ce] text-[#3f2e1a] tracking-widest">
              <div>摘要/备注</div>
              <div>经办/成员</div>
              <div>科目/分类</div>
              <div>发生额</div>
            </div>

            {dateGroups.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#82745a] flex flex-col items-center gap-2">
                <PackageOpen className="w-7 h-7 text-[#ab9b7d]" />
                <span className="font-bold">本期无发生存取记录</span>
              </div>
            ) : (
              dateGroups.map((group) => (
                <React.Fragment key={group.date}>
                  <div className="bg-[#f4ebd7] px-2.5 py-1 font-mono text-xs font-bold border-y border-[#c7ba9d] text-[#4a3621] text-left tracking-wider flex items-center justify-between">
                    <span>记账日: {group.shortDate}</span>
                    <span className="text-[10px] opacity-70">柜员: 01</span>
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

          {/* 存折底部翻页与盖章提示 */}
          <div className="mt-2 pt-2 border-t border-dashed border-[#c7ba9d] flex items-center justify-between text-[9px] text-[#857457]">
            <div className="flex items-center gap-1">
              <Stamp className="w-3 h-3 text-red-600/70" />
              <span>微机打印 · 涂改无效</span>
            </div>
            <span>第 01 页 / 共 01 页</span>
          </div>
        </div>
      </div>
    </div>
  );
};
