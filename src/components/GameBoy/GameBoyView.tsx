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
  // 分组日期倒序
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
    <div className="flex flex-col items-center justify-start my-2 px-1 relative w-full max-w-md mx-auto select-none">
      {/* GameBoy 经典 DMG 掌上游戏机外壳 */}
      <div className="w-full bg-[#d0d0d7] border-4 border-[#b0b0b8] rounded-[36px] p-5 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* 顶部左侧斜切纹路装饰 */}
        <div className="w-full flex justify-between items-center mb-3 px-2">
          <div className="flex items-center gap-1.5 text-[11px] font-pixel font-bold text-slate-600 tracking-widest uppercase">
            <Gamepad2 className="w-4 h-4 text-rose-600" />
            <span>GAMEBOY LEDGER</span>
          </div>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-500 shadow-inner" />
            <div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-500 shadow-inner" />
          </div>
        </div>

        {/* 屏幕外框 (Dot Matrix Bezel) */}
        <div className="w-full bg-[#525266] rounded-2xl p-4 border-2 border-slate-700 shadow-inner relative overflow-hidden">
          {/* 经典 DOT MATRIX WITH STEREO SOUND 标语 */}
          <div className="flex justify-between items-center mb-2 px-1 text-[9px] font-pixel tracking-widest">
            <div className="flex items-center gap-1.5">
              {/* 电量/模式指示灯 */}
              <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_#ef4444] animate-pulse" />
              <span className="text-slate-300 font-bold">BATTERY</span>
            </div>
            <div className="text-slate-300 font-bold flex items-center gap-1">
              <span className="text-rose-400">DOT MATRIX</span> WITH STEREO SOUND
            </div>
          </div>

          {/* 🕹️ GameBoy LCD 绿光点阵屏幕 */}
          <div className="w-full bg-[#9bbc0f] text-[#0f380f] font-pixel p-3.5 rounded-lg border-4 border-[#306230] gameboy-lcd-shadow relative overflow-hidden min-h-[360px]">
            {/* 屏幕 Scanline 微粒感 */ }
            <div className="absolute inset-0 gameboy-scanline pointer-events-none z-10" />

            {/* 屏幕顶端模式 Token Badge */}
            <div className="flex justify-between items-center border-b-2 border-[#306230] pb-1 mb-2 text-xs font-black tracking-widest">
              <span>★ 8-BIT LEDGER ★</span>
              <span className="px-1.5 py-0.5 bg-[#8bac0f] border border-[#306230] rounded text-[10px]">
                {currentMode}
              </span>
            </div>

            {/* 账单内容（复用通用账单组件，完美呈现点阵绿屏） */}
            <ReceiptHeader
              selectedMonth={selectedMonth}
              transactions={transactions}
              hasFullAccess={hasFullAccess}
            />

            <div className="my-2 min-h-[140px]">
              {dateGroups.length === 0 ? (
                <div className="py-12 text-center text-xs opacity-75 font-pixel flex flex-col items-center gap-2">
                  <PackageOpen className="w-7 h-7 text-[#306230]" />
                  <span>NO DATA THIS MONTH</span>
                </div>
              ) : (
                dateGroups.map((group) => (
                  <div key={group.date} className="my-2">
                    <div className="bg-[#8bac0f] py-0.5 px-2 my-1 font-pixel text-xs font-black border-y border-[#306230] text-left tracking-wider">
                      <span>{group.shortDate}</span>
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
        </div>

        {/* GameBoy 底部物理按键区装饰 (十字键 + A/B 键) */}
        <div className="w-full flex justify-between items-center mt-5 px-3">
          {/* 左侧：黑灰 3D 十字键 (D-Pad) */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute w-16 h-5 bg-[#3a3a42] rounded-sm border border-slate-700 shadow-md" />
            <div className="absolute w-5 h-16 bg-[#3a3a42] rounded-sm border border-slate-700 shadow-md" />
            <div className="absolute w-3 h-3 bg-slate-800 rounded-full" />
          </div>

          {/* 右侧：经典暗红紫 A/B 按键 */}
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

        {/* SELECT / START 按键 */}
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
