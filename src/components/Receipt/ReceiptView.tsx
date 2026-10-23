import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { DateGroup, SummaryStats, Transaction } from '../../types';
import { MonthSwitcher } from './MonthSwitcher';
import { CategorySummary } from './CategorySummary';
import { ReceiptItem } from './ReceiptItem';
import { ReceiptFooter } from './ReceiptFooter';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { resolveAccessMode } from '../../features/ledger/access-mode';
import { PrinterHead } from './PrinterHead';
import { PackageOpen } from 'lucide-react';

/** 回卷时长（秒） */
const PRINT_RETRACT_S = 0.6;
/** 出纸时长（秒） */
const PRINT_FEED_S = 1.6;
const PRINT_START_MS = PRINT_RETRACT_S * 1000;
const PRINT_FEED_MS = PRINT_FEED_S * 1000;

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
  /** 切换月份时的两段式：先回卷旧纸，再吐出新的 */
  const [phase, setPhase] = useState<'idle' | 'retracting' | 'feeding'>('feeding');
  /**
   * 冻结的快照：回卷期间继续显示「上一张纸」的内容，
   * 否则会先闪一下新数据再开始收卷。
   */
  const [snapshot, setSnapshot] = useState<{
    month: string;
    dateGroups: DateGroup[];
    transactions: Transaction[];
    stats: SummaryStats;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const expandedRef = useRef<HTMLDivElement | null>(null);
  /**
   * 首屏出纸开关：纸槽初始是 0 高度（收在缝里），挂载后下一帧再置为 true，
   * 由 CSS 过渡把 0fr 推到 1fr，得到真实的首屏吐纸。
   */
  const [feedReady, setFeedReady] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setFeedReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  /** 系统开启「减少动态效果」时，只保留必要的高度展开，不做扫描线与逐行显影 */
  const reduceMotion = useReducedMotion();

  /**
   * 打印态（指示灯闪烁 + 扫描线）的生命周期。
   * 单独用定时器控制，避免依赖 motion 的动画回调——内层动画的完成事件
   * 会冒泡到外层容器，导致打印态被提前结束、进而卡住 AnimatePresence。
   */
  useEffect(() => {
    setIsPrinting(true);
    const timer = window.setTimeout(() => setIsPrinting(false), PRINT_START_MS + PRINT_FEED_MS);
    return () => window.clearTimeout(timer);
  }, [selectedMonth]);

  /**
   * 切换月份：先回卷旧纸（retracting），回卷结束后再吐出新纸（feeding）。
   * 首屏不做回卷，直接进入吐纸阶段。
   */
  // 持续记录「上一次渲染的 props」，供切换时冻结成快照
  const lastPropsRef = useRef({ month: selectedMonth, dateGroups, transactions, stats });
  useEffect(() => {
    lastPropsRef.current = { month: selectedMonth, dateGroups, transactions, stats };
  });

  const isFirstRender = useRef(true);
  /** 首屏：只做出纸，不播放落纸轻震，避免一进来就整张纸弹一下 */
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setPhase('feeding');
      return;
    }
    setIsFirstLoad(false);
    // 冻结切换前的那一屏，回卷期间继续显示，避免闪到新数据
    setSnapshot(lastPropsRef.current);
    setExpandedId(null);
    setPhase('retracting');
    const timer = window.setTimeout(() => {
      setSnapshot(null);
      setPhase('feeding');
    }, PRINT_RETRACT_S * 1000);
    return () => window.clearTimeout(timer);
    // 仅在月份变化时触发；快照内容取变化前的 props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  /** 回卷期间显示快照，吐出时显示真实数据 */
  const shown =
    snapshot && phase === 'retracting'
      ? snapshot
      : { month: selectedMonth, dateGroups, transactions, stats };

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

  const laserBeamClass =
    currentMode === 'admin'
      ? 'via-emerald-300 shadow-[0_0_25px_#34d399,0_0_45px_#10b981]'
      : currentMode === 'decrypted'
      ? 'via-cyan-300 shadow-[0_0_25px_#22d3ee,0_0_45px_#3b82f6]'
      : 'via-rose-400 shadow-[0_0_25px_#f43f5e,0_0_45px_#e11d48]';

  return (
    <div className="flex flex-col items-center justify-start my-2 px-1 relative w-full max-w-md mx-auto">
      {/* 拟物白色打印机机头（含出纸槽） */}
      <PrinterHead isPrinting={isPrinting} mode={currentMode} />

      {/* 小票展示区域：出纸过程中高度随纸张增长，不留大块空白 */}
      <div className="w-full relative overflow-hidden">
        {/* 缝口基线：纸被收走后仍有一条暗色底边，机器不会悬空 */}
        <div className="pointer-events-none absolute inset-x-[1%] top-0 h-1.5 rounded-b-[3px] bg-gradient-to-b from-black/55 to-black/10 no-print z-20" />
        {/* 出纸缝处的热感扫描线：纸张吐出时同步下移 */}
        {isPrinting && !reduceMotion && (
          <motion.div
            initial={{ top: 0, opacity: 0 }}
            animate={{ top: ['0%', '0%', '100%'], opacity: [0.95, 0.95, 0] }}
            transition={{ duration: PRINT_FEED_S, times: [0, 0.03, 0.5, 1], ease: ['linear', 'linear', 'linear'] }}
            className={`absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent ${laserBeamClass} to-transparent pointer-events-none z-50`}
          />
        )}

        {/* 出纸：外层用 grid 行高 0 ↔ 1fr 做高度过渡，纸面贴顶不动，像被一点点吐出。
            data-feed：首屏/回卷 = 收（0.3s），出纸 = 按 --paper-feed（1.6s）匀速吐出。
            用 CSS 过渡而不是 JS 高度动画，换月时不会因为重挂载丢失旧高度。 */}
        <div
            className="paper-slot relative w-full"
            data-feed={!feedReady || phase === 'retracting' ? 'in' : 'out'}
            style={{ '--paper-feed': `${PRINT_FEED_S}s` } as React.CSSProperties}
          >
            <motion.div
              // 吸入阶段纸面随高度收缩向上位移，吐出阶段从缝口位置落下
              initial={false}
              animate={{ y: phase === 'retracting' ? -14 : 0 }}
              transition={
                phase === 'feeding'
                  ? { duration: PRINT_FEED_S, ease: 'linear' }
                  : { duration: PRINT_RETRACT_S, ease: [0.55, 0, 0.9, 0.5] }
              }
              className="receipt-container receipt-paper-box receipt-both-sawtooth font-pixel relative w-full p-4 sm:p-5 rounded-sm shadow-2xl"
              style={{ '--paper-wipe': `${PRINT_FEED_S}s` } as React.CSSProperties}
            >
            {/* 纸从缝口出来的地方压一道阴影，强化「被夹住」的层次 */}
            <div className="absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-black/25 via-black/10 to-transparent pointer-events-none z-10" />

            {/* 打印纸分页：先把纸染黑，再由上而下「擦」出黑色（mask 只影响绘制，不参与布局）。
                行末保留 28% 的淡出，像热敏头还没走到的那一截；结束时正好停在行边界上。 */}
            <div
              key={`wipe:${shown.month || 'all'}`}
              className={`relative ${
                phase === 'feeding' && !reduceMotion
                  ? `paper-reveal${isFirstLoad ? '' : ' paper-settle'}`
                  : ''
              }`}
              style={{ '--paper-feather': '28%' } as React.CSSProperties}
            >
              {/* 纸面顶部的月份切换：左右箭头 + 当前月份 */}
              <div
                className={`mb-2 transition-all duration-300 ${
                  expandedId ? 'opacity-40 blur-[2px]' : 'opacity-100 blur-none'
                }`}
              >
                <MonthSwitcher
                  selectedMonth={shown.month}
                  months={months}
                  onChange={onSelectMonth}
                  isPrinting={phase === 'feeding'}
                />
              </div>

              <div
                className={`transition-all duration-300 ${
                  expandedId ? 'opacity-40 blur-[2px]' : 'opacity-100 blur-none'
                }`}
              >
              <CategorySummary
                transactions={shown.transactions}
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

                {shown.dateGroups.length === 0 ? (
                  <div className="py-12 text-center text-[0.815em] opacity-50 font-pixel flex flex-col items-center gap-2.5">
                    <span className="grid place-items-center w-11 h-11 rounded-full border-2 border-dashed border-current/25">
                      <PackageOpen className="w-5 h-5 opacity-40" />
                    </span>
                    <span className="tracking-wide">本月暂无记账明细</span>
                    <span className="text-[0.75em] opacity-70 tracking-widest">— NO RECORDS —</span>
                  </div>
                ) : (
                  shown.dateGroups.map((group) => (
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
                  stats={shown.stats}
                  hasFullAccess={hasFullAccess}
                  isPrinting={isPrinting}
                  month={shown.month}
                />
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
            </motion.div>
        </div>
      </div>
    </div>
  );
};
