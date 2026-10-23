import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface AnimatedNumberProps {
  value: number;
  hasFullAccess?: boolean;
  /** 出纸中：数值从 0 滚动到位（切月时和纸面一起「打」出来） */
  isPrinting?: boolean;
  showSymbol?: boolean;
  className?: string;
  /** 点击即复制金额（仅浏览器支持剪贴板时生效），复制后短暂显示对勾 */
  copyable?: boolean;
}

/** 出纸时金额从 0 滚到目标值的时长（毫秒），与纸面逐行显影同拍 */
const ROLL_MS = 620;

/**
 * 数字缓动：先快后慢，像机械计数器甩到位（easeOutCubic）。
 * 老版本在 isPrinting 期间用 35ms 的随机数抖动，一屏十几处同时抖会噪且读不清，
 * 这里改成一次性的滚动到值，既保留「在打印」的感觉又能读出结果。
 */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  hasFullAccess = true,
  isPrinting = false,
  showSymbol = true,
  className = '',
  copyable = false,
}) => {
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState<number>(1);
  const [copied, setCopied] = useState(false);
  const rafRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  // 出纸：从 0 滚到目标值；之后数值变化时从上一个值平滑过渡到新值
  const fromRef = useRef(0);
  useEffect(() => {
    const isFirst = !mountedRef.current;
    const from = isFirst ? 0 : fromRef.current;
    const to = value;
    mountedRef.current = true;

    const finish = () => {
      fromRef.current = to;
      setProgress(1);
    };

    if (reduceMotion) {
      finish();
      return;
    }

    // 首次挂载且不在出纸态（例如直接切到某分类后的重渲染）：没有「打印」语境，直接落位
    if (isFirst && !isPrinting) {
      finish();
      return;
    }
    if (from === to) {
      finish();
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ROLL_MS);
      setProgress(easeOutCubic(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        finish();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, isPrinting, reduceMotion]);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    },
    []
  );

  const handleCopy = useCallback(async () => {
    if (!copyable || !hasFullAccess) return;
    const text = formatCurrency(value, false, true).replace('￥', '');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* 无剪贴板权限（http 或旧浏览器）：保持静默，不影响阅读 */
    }
  }, [copyable, hasFullAccess, value]);

  // 脱敏态锁定字宽与不换行，避免等宽字体下 '*.' 被当成对齐符号拆行
  if (!hasFullAccess) {
    return (
      <span className={`${className} whitespace-nowrap`} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {showSymbol ? '￥***.**' : '***.**'}
      </span>
    );
  }

  const shownValue = progress >= 1 ? value : value * progress;
  const formatted = formatCurrency(shownValue, false, showSymbol);

  const numberSpan = (
    <span
      className={`${className} inline-block whitespace-nowrap tabular-nums ${
        copied ? 'amount-nudge' : ''
      }`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {formatted}
    </span>
  );

  if (!copyable) return numberSpan;

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        // 行本身是展开详情的按钮，复制不应把详情也展开
        e.stopPropagation();
        void handleCopy();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.12 }}
      title={copied ? '已复制' : '点击复制金额'}
      aria-label={`金额 ${formatCurrency(value, false, true)}，点击复制`}
      className="relative inline-flex items-center justify-center rounded-[3px] outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-current/40 can-hover:hover:bg-current/[0.07] transition-colors duration-150"
    >
      {numberSpan}
      <span
        aria-hidden
        className={`no-print absolute -right-3.5 transition-all duration-200 ${
          copied ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
      >
        <Check className="w-2.5 h-2.5 text-emerald-700" strokeWidth={3} />
      </span>
      <span role="status" className="sr-only">
        {copied ? '已复制到剪贴板' : ''}
      </span>
    </motion.button>
  );
};
