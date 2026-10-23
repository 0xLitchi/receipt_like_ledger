import React, { useState, useEffect } from 'react';
import type { SummaryStats } from '../../types';
import { AnimatedNumber } from './AnimatedNumber';
import { generateReceiptNo } from '../../utils/formatters';
import { useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

interface ReceiptFooterProps {
  stats: SummaryStats;
  hasFullAccess?: boolean;
  isPrinting?: boolean;
  /** 当前月份 YYYY-MM：用于小票号与「开具于」时间戳 */
  month?: string;
}

/** 小票开具时间：出纸进行中「盖」上，打印结束后保留（读票时就是开具时间） */
const useStamp = (month: string | undefined, isPrinting: boolean) => {
  const [stamp, setStamp] = useState<string | null>(null);
  useEffect(() => {
    if (!isPrinting) return; // 结束后不清空，保留已盖上的时间
    // 新一张纸进来时先擦掉上一张的时间，再在后半段重新盖上
    setStamp(null);
    const timer = window.setTimeout(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setStamp(`${month ? month.replace('-', '.') : 'ALL'} · ${hh}:${mm}`);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [month, isPrinting]);
  return stamp;
};

export const ReceiptFooter: React.FC<ReceiptFooterProps> = ({
  stats,
  hasFullAccess = true,
  isPrinting = false,
  month,
}) => {
  const reduceMotion = useReducedMotion();
  const stamp = useStamp(month, isPrinting);

  return (
    <div className="pt-2 pb-2 px-2 font-pixel text-[0.815em] select-none tracking-normal">
      <div className="thermal-dashed-line my-2" />

      {/* 像素风统计总计 */}
      <div className="space-y-1 text-right my-1 opacity-95">
        <div className="flex justify-between font-pixel text-[0.815em]">
          <span className="opacity-75">交易共计:</span>
          <span className="font-bold tabular-nums">{stats.count} 笔</span>
        </div>

        <div className="flex justify-between text-[0.951em] font-black pt-1 border-t border-dashed border-current/30 mt-1.5 font-pixel">
          <span>净计:</span>
          <AnimatedNumber
            value={stats.netBalance}
            hasFullAccess={hasFullAccess}
            isPrinting={isPrinting}
            copyable
            className={stats.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}
          />
        </div>
      </div>

      {/* 小票号 + 开具时间：出纸末尾「盖」上，给整张票一个收尾 */}
      <div className="mt-2.5 flex items-center justify-between gap-2 text-[0.68em] opacity-45 tracking-wider font-pixel">
        <span className="truncate">{generateReceiptNo(month ? `${month}-01` : undefined)}</span>
        <span
          className={`shrink-0 tabular-nums transition-all duration-300 ${
            stamp && !reduceMotion ? 'tip-in' : ''
          }`}
        >
          {stamp ? (
            <span className="inline-flex items-center gap-1">
              <Check className="w-2.5 h-2.5" strokeWidth={3} aria-hidden />
              已开具 {stamp}
            </span>
          ) : hasFullAccess ? (
            '— — — — —'
          ) : (
            '***'
          )}
        </span>
      </div>
    </div>
  );
};
