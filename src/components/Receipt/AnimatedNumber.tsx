import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatters';

interface AnimatedNumberProps {
  value: number;
  hasFullAccess?: boolean;
  isPrinting?: boolean;
  showSymbol?: boolean;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  hasFullAccess = true,
  isPrinting = false,
  showSymbol = true,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);

  useEffect(() => {
    if (!hasFullAccess) return;

    if (isPrinting) {
      setIsSpinning(true);
      const startTime = Date.now();
      const duration = 1100;

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed < duration) {
          // 80 年代复古老虎机高频像素滚轮数字抖动
          const randomSign = Math.random() > 0.5 ? -1 : 1;
          const randomVal = randomSign * (Math.floor(Math.random() * 8888) + 12.34);
          setDisplayValue(randomVal);
        } else {
          clearInterval(interval);
          setDisplayValue(value);
          setIsSpinning(false);
        }
      }, 35);

      return () => clearInterval(interval);
    } else {
      setDisplayValue(value);
      setIsSpinning(false);
    }
  }, [value, isPrinting, hasFullAccess]);

  // 脱敏态锁定字宽与不换行，避免等宽字体下 '*.' 被当成对齐符号拆行
  if (!hasFullAccess) {
    return (
      <span className={`${className} whitespace-nowrap`} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {showSymbol ? '￥***.**' : '***.**'}
      </span>
    );
  }

  const formatted = formatCurrency(displayValue, false, showSymbol);

  return (
    <span
      className={`${className} inline-block whitespace-nowrap tabular-nums transition-all ${
        isSpinning
          ? 'scale-110 opacity-90 text-amber-600 animate-pulse font-pixel tracking-tighter'
          : 'scale-100 opacity-100'
      }`}
    >
      {formatted}
    </span>
  );
};
