import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { DateGroup, SummaryStats, Transaction } from '../../types';
import { MonthSwitcher } from './MonthSwitcher';
import { CategorySummary } from './CategorySummary';
import { ReceiptItem } from './ReceiptItem';
import { ReceiptFooter } from './ReceiptFooter';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { PackageOpen } from 'lucide-react';

/** 进入 / 切月时的数字滚动与盖章过渡窗口（毫秒） */
const SETTLE_DURATION_MS = 650;
/** 优雅出场的缓动曲线（先快后缓，近似纸张轻落桌面） */
const PAPER_EASE = [0.22, 1, 0.36, 1] as const;

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
  isAdmin: _isAdmin = false,
  activeCategory = 'ALL',
  onSelectCategory,
}) => {
  const [isSettling, setIsSettling] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandedRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setExpandedId(null);
    setIsSettling(true);
    const timer = window.setTimeout(() => setIsSettling(false), SETTLE_DURATION_MS);
    return () => window.clearTimeout(timer);
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

  return (
    <div className="flex flex-col items-center justify-start my-3 px-1 relative w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedMonth || 'all'}
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 18, scale: 0.985 }
          }
          animate={
            reduceMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, scale: 1 }
          }
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: -10, scale: 0.99 }
          }
          transition={{
            duration: reduceMotion ? 0.12 : 0.36,
            ease: PAPER_EASE,
          }}
          className="receipt-container receipt-paper-box receipt-both-sawtooth font-pixel relative w-full p-4 sm:p-5 rounded-sm shadow-2xl"
        >
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
              isPrinting={isSettling}
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
              isPrinting={isSettling}
              activeCategory={activeCategory}
              onSelectCategory={onSelectCategory}
            />
          </div>

          {/* 明细清单框线表格 */}
          <div className="my-3 border-2 border-current/40 rounded-xl overflow-hidden shadow-xs">
            <div
              className={`grid grid-cols-[1.9fr_0.9fr_1.25fr_1.15fr] divide-x divide-current/30 border-b-2 border-current/40 text-center text-[0.815em] font-black py-1.5 bg-current/10 font-pixel tracking-wide transition-all duration-300 ${
                expandedId ? 'opacity-45 blur-[2px]' : 'opacity-100 blur-none'
              }`}
            >
              <div>备注</div>
              <div>成员</div>
              <div>分类</div>
              <div>金额</div>
            </div>

            {dateGroups.length === 0 ? (
              <div className="py-12 text-center text-[0.815em] opacity-50 font-pixel flex flex-col items-center gap-2.5">
                <span className="grid place-items-center w-11 h-11 rounded-full border-2 border-dashed border-current/25">
                  <PackageOpen className="w-5 h-5 opacity-40" />
                </span>
                <span className="tracking-wide">本月暂无记账明细</span>
                <span className="text-[0.75em] opacity-70 tracking-widest">— NO RECORDS —</span>
              </div>
            ) : (
              dateGroups.map((group) => (
                <React.Fragment key={group.date}>
                  {/* 日期子抬头 */}
                  <div
                    className={`bg-current/20 px-2.5 py-1 font-pixel text-[0.815em] font-black border-y border-current/30 text-center tracking-normal shadow-inner transition-all duration-300 ${
                      expandedId ? 'opacity-40 blur-[2px]' : 'opacity-90 blur-none'
                    }`}
                  >
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
                        isPrinting={isSettling}
                        isActive={expandedId === t.id}
                        onClick={() => setExpandedId((prev) => (prev === t.id ? null : t.id))}
                      />
                      {expandedId === t.id && (
                        <TransactionDetailSheet
                          transaction={t}
                          hasFullAccess={hasFullAccess}
                          isPrinting={isSettling}
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
              isPrinting={isSettling}
            />
          </div>

          <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
