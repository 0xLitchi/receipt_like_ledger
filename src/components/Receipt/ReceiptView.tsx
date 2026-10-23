import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DateGroup, SummaryStats, Transaction } from '../../types';
import { MonthSwitcher } from './MonthSwitcher';
import { CategorySummary } from './CategorySummary';
import { ReceiptItem } from './ReceiptItem';
import { ReceiptFooter } from './ReceiptFooter';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { resolveAccessMode } from '../../features/ledger/access-mode';
import { PackageOpen, Printer } from 'lucide-react';

interface ReceiptViewProps {
  /** 已按日期分组的交易（由 use-ledger 统一计算） */
  dateGroups: DateGroup[];
  /** 当前筛选后的交易，用于分类汇总 */
  transactions: Transaction[];
  stats: SummaryStats;
  selectedMonth: string;
  /** 可选月份（倒序），用于纸内左右箭头切换 */
  months: string[];
  onSelectMonth: (month: string) => void;
  hasFullAccess?: boolean;
  isAdmin?: boolean;
  /** 当前选中的分类，用于汇总面板高亮 */
  activeCategory?: string;
  onSelectCategory?: (category: string) => void;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({
  dateGroups,
  transactions,
  stats,
  selectedMonth,
  months,
  onSelectMonth,
  hasFullAccess = true,
  isAdmin = false,
  activeCategory = 'ALL',
  onSelectCategory,
}) => {
  // 首次渲染即为「正在打印」，切换月份时同样进入打印态
  const [isPrinting, setIsPrinting] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prevMonthRef = useRef(selectedMonth);
  const expandedRef = useRef<HTMLDivElement | null>(null);

  // 切换月份：收起明细并重新出纸（打印态在动画完成回调里结束）
  useEffect(() => {
    if (prevMonthRef.current !== selectedMonth) {
      prevMonthRef.current = selectedMonth;
      setIsPrinting(true);
      setExpandedId(null);
    }
  }, [selectedMonth]);

  /**
   * 点击展开区域以外的地方收起明细。
   * 用 pointerdown 而非 click：行自身的 onClick 在 click 阶段会先切换状态，
   * 若在 click 里判断，会把「刚被点上那一行」误判为仍在展开区内。
   * 点在别的行上时，这里先收起，再由该行 onClick 重新展开，最终效果就是切换。
   */
  useEffect(() => {
    if (!expandedId) return;
    const handlePress = (e: Event) => {
      const target = e.target as Node | null;
      if (target && expandedRef.current?.contains(target)) return;
      setExpandedId(null);
    };
    document.addEventListener('pointerdown', handlePress, true);
    document.addEventListener('mousedown', handlePress, true);
    document.addEventListener('touchstart', handlePress, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', handlePress, true);
      document.removeEventListener('mousedown', handlePress, true);
      document.removeEventListener('touchstart', handlePress, true);
    };
  }, [expandedId]);

  const currentMode = resolveAccessMode(isAdmin, hasFullAccess);

  const printerIconColorClass =
    currentMode === 'admin'
      ? 'text-emerald-400'
      : currentMode === 'decrypted'
      ? 'text-blue-400'
      : 'text-rose-500';

  const indicatorLedClass =
    currentMode === 'admin'
      ? isPrinting
        ? 'bg-emerald-400 shadow-[0_0_12px_#34d399] animate-ping'
        : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
      : currentMode === 'decrypted'
      ? isPrinting
        ? 'bg-blue-400 shadow-[0_0_12px_#60a5fa] animate-ping'
        : 'bg-blue-500 shadow-[0_0_8px_#3b82f6]'
      : isPrinting
      ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-ping'
      : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]';

  const laserBeamClass =
    currentMode === 'admin'
      ? 'via-emerald-300 shadow-[0_0_25px_#34d399,0_0_45px_#10b981]'
      : currentMode === 'decrypted'
      ? 'via-cyan-300 shadow-[0_0_25px_#22d3ee,0_0_45px_#3b82f6]'
      : 'via-rose-400 shadow-[0_0_25px_#f43f5e,0_0_45px_#e11d48]';

  return (
    <div className="flex flex-col items-center justify-start my-2 px-1 relative w-full max-w-md mx-auto">
      {/* 顶部拟真热敏打印机机头 */}
      <div
        className={`w-[104%] z-30 printer-slot-head border border-slate-700/80 rounded-t-xl p-2.5 shadow-2xl flex items-center justify-between font-pixel relative no-print mb-[-6px] transition-transform ${
          isPrinting ? 'animate-machine-vibrate' : ''
        }`}
      >
        <Printer className={`w-4 h-4 mx-auto ${printerIconColorClass} transition-colors duration-300 animate-pulse`} />

        <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full transition-all duration-300 ${indicatorLedClass}`} />

        <div className="absolute inset-x-3 bottom-0 h-1 bg-black rounded-full shadow-inner border-t border-slate-900" />
      </div>

      {/* 出纸缝：金属槽口，纸张从这条缝里吐出 */}
      <div className="relative z-30 w-[98%] h-2.5 -mt-px no-print printer-slot-lip" />

      {/* 小票展示区域：出纸过程中高度随纸张增长，不留大块空白。
          layout 让旧纸回卷后腾出的空间立刻被新纸接上，切换月份时不会塌陷。 */}
      <motion.div layout className="w-full relative overflow-hidden">
        {/* 缝口基线：纸被收走后仍有一条暗色底边，机器不会悬空 */}
        <div className="pointer-events-none absolute inset-x-[1%] top-0 h-1.5 rounded-b-[3px] bg-gradient-to-b from-black/55 to-black/10 no-print z-20" />
        {/* 出纸缝处的热感扫描线：纸张吐出时同步下移 */}
        {isPrinting && (
          <motion.div
            initial={{ top: 0, opacity: 0 }}
            animate={{ top: ['0%', '0%', '100%'], opacity: [0.95, 0.95, 0] }}
            transition={{ duration: 2.28, times: [0, 0.03, 0.5, 1], ease: ['linear', 'linear', 'linear'] }}
            className={`absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent ${laserBeamClass} to-transparent pointer-events-none z-50`}
          />
        )}

        <AnimatePresence mode="popLayout" initial={true}>
          {/* 出纸：外层高度从 0 长到内容高度，纸面贴顶不动，像被一点点吐出 */}
          <motion.div
            key={selectedMonth || 'all'}
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{
              // 回卷：高度收到 0（纸被吸回缝里）。比出纸快得多，且越收越快
              height: 0,
              transition: { duration: 0.26, ease: [0.32, 0, 0.85, 0.45] },
            }}
            transition={{
              // 预热 → 匀速吐出（匀速最能体现「纸在持续送出来」）→ 末尾极轻收住
              // delay 与回卷重叠一小段，衔接更连续，几乎没有空档
              duration: 2.2,
              delay: 0.06,
              times: [0, 0.06, 0.94, 1],
              ease: ['easeOut', 'linear', 'linear', 'easeInOut'],
            }}
            onAnimationComplete={() => setIsPrinting(false)}
            onAnimationStart={() => setIsPrinting(true)}
            className="relative w-full overflow-hidden"
          >
            <motion.div
              initial={{ y: -6 }}
              animate={{ y: 0 }}
              // 回卷时纸面反向贴回缝口，和出纸的位移对称
              exit={{ y: 4, transition: { duration: 0.26, ease: [0.32, 0, 0.85, 0.45] } }}
              transition={{ duration: 2.2, delay: 0.06, ease: 'linear' }}
              className="receipt-container receipt-paper-box receipt-both-sawtooth font-pixel relative w-full p-4 sm:p-5 rounded-sm shadow-2xl"
            >
            {/* 纸从缝口出来的地方压一道阴影，强化「被夹住」的层次 */}
            <div className="absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-black/25 via-black/10 to-transparent pointer-events-none z-10" />

            <div>
              {/* 纸面顶部的月份切换：左右箭头 + 当前月份 */}
              <div
                className={`mb-2 transition-all duration-300 ${
                  expandedId ? 'opacity-40 blur-[2px]' : 'opacity-100 blur-none'
                }`}
              >
                <MonthSwitcher
                  selectedMonth={selectedMonth}
                  months={months}
                  onChange={onSelectMonth}
                />
              </div>

              <div
                className={`transition-all duration-300 ${
                  expandedId ? 'opacity-40 blur-[2px]' : 'opacity-100 blur-none'
                }`}
              >
              <CategorySummary
                transactions={transactions}
                hasFullAccess={hasFullAccess}
                isPrinting={isPrinting}
                activeCategory={activeCategory}
                onSelectCategory={onSelectCategory}
              />
              </div>

              {/* 明细清单框线表格 */}
              <div className="my-3 border-2 border-current/40 rounded-xl overflow-hidden shadow-xs">
                <div className={`grid grid-cols-[1.9fr_0.9fr_1.25fr_1.15fr] divide-x divide-current/30 border-b-2 border-current/40 text-center text-[0.815em] font-black py-1.5 bg-current/10 font-pixel tracking-wide transition-all duration-300 ${
                  expandedId ? 'opacity-45 blur-[2px]' : 'opacity-100 blur-none'
                }`}>
                  <div>备注</div>
                  <div>成员</div>
                  <div>分类</div>
                  <div>金额</div>
                </div>

                {dateGroups.length === 0 ? (
                  <div className="py-12 text-center text-[0.815em] opacity-50 font-pixel flex flex-col items-center gap-2">
                    <PackageOpen className="w-7 h-7 opacity-40" />
                    <span>本月暂无记账明细</span>
                  </div>
                ) : (
                  dateGroups.map((group) => (
                    <React.Fragment key={group.date}>
                      {/* 日期子抬头 */}
                      <div className={`bg-current/20 px-2.5 py-1 font-pixel text-[0.815em] font-black border-y border-current/30 text-center tracking-normal shadow-inner transition-all duration-300 ${
                        expandedId ? 'opacity-40 blur-[2px]' : 'opacity-90 blur-none'
                      }`}>
                        <span>{group.shortDate}</span>
                      </div>

                      {group.items.map((t) => (
                        <div
                          key={t.id}
                          ref={expandedId === t.id ? expandedRef : undefined}
                          className={`relative transition-all duration-300 ${
                            expandedId === t.id
                              ? 'z-50 opacity-100 blur-none shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)]'
                              : expandedId
                              ? 'z-0 opacity-45 blur-[2px]'
                              : 'z-0 opacity-100 blur-none'
                          }`}
                        >
                          <ReceiptItem
                            transaction={t}
                            hasFullAccess={hasFullAccess}
                            isPrinting={isPrinting}
                            isActive={expandedId === t.id}
                            onClick={() => setExpandedId((prev) => (prev === t.id ? null : t.id))}
                          />
                          {expandedId === t.id && (
                            <TransactionDetailSheet
                              transaction={t}
                              hasFullAccess={hasFullAccess}
                              isPrinting={isPrinting}
                              onClose={() => setExpandedId(null)}
                            />
                          )}
                        </div>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </div>

              <div
                className={`transition-all duration-300 ${
                  expandedId ? 'opacity-40 blur-[2px]' : 'opacity-100 blur-none'
                }`}
              >
                <ReceiptFooter
                  stats={stats}
                  hasFullAccess={hasFullAccess}
                  isPrinting={isPrinting}
                />
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
