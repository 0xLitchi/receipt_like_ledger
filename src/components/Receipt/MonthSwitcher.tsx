import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthSwitcherProps {
  /** 当前月份 YYYY-MM */
  selectedMonth: string;
  /** 可选月份，倒序（最新在前） */
  months: string[];
  onChange: (month: string) => void;
  /** 纸正在吐出：月份文字重新「打」一遍 */
  isPrinting?: boolean;
}

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const arrowClass =
  'press-fx p-1 rounded outline-none ' +
  'opacity-45 can-hover:hover:opacity-100 can-hover:hover:bg-current/10 ' +
  'active:opacity-100 active:bg-current/15 ' +
  'focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-current/40 ' +
  'disabled:opacity-10 disabled:cursor-default disabled:bg-transparent';

/**
 * 小票内的月份切换：左右箭头 + 当前月份。
 * 放在纸面顶部的虚线行里，与账本其余内容共用一条基线，不额外占高度。
 * 换月时文字按时间方向「卷」一段：读取更早的月份向左推入，读取更新则向右推入。
 */
export const MonthSwitcher: React.FC<MonthSwitcherProps> = ({
  selectedMonth,
  months,
  onChange,
  isPrinting = false,
}) => {
  const index = months.indexOf(selectedMonth);
  // months 为倒序，右侧是更早的月份
  const hasNewer = index > 0;
  const hasOlder = index >= 0 && index < months.length - 1;

  const [year, month] = selectedMonth ? selectedMonth.split('-') : ['', ''];
  const monthLabel = month ? `${MONTH_LABELS[Number(month) - 1] ?? month} ${year}` : '';

  /** 卷动方向：点右箭头（更早）= 向左推入；点左箭头（更新）= 向右推入 */
  const [rollDir, setRollDir] = useState<'next' | 'prev'>('next');
  /** 按键的直接反应：按下时箭头往里压一点，即使是键盘触发也有反馈 */
  const [pressed, setPressed] = useState<'prev' | 'next' | null>(null);

  const step = (delta: number) => {
    const next = months[index + delta];
    if (!next) return;
    setRollDir(delta > 0 ? 'next' : 'prev');
    onChange(next);
  };

  const rollClass = rollDir === 'next' ? 'month-roll-next' : 'month-roll-prev';

  return (
    <div className="flex items-center justify-between border-y border-dashed border-current/30 py-0.5 px-0.5">
      <button
        type="button"
        onClick={() => step(-1)}
        onPointerDown={() => setPressed('prev')}
        onPointerUp={() => setPressed(null)}
        onPointerLeave={() => setPressed(null)}
        onBlur={() => setPressed(null)}
        disabled={!hasNewer}
        aria-label="上一个月"
        title="上一个月"
        className={`${arrowClass} ${pressed === 'prev' ? 'bg-current/15 translate-x-px' : ''}`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="text-center select-none overflow-hidden">
        <span
          key={`${monthLabel}:${rollDir}`}
          className={`inline-block text-[0.815em] font-black tracking-[0.22em] ${
            isPrinting ? `paper-reveal ${rollClass}` : ''
          }`}
          style={isPrinting ? ({ '--paper-wipe': '360ms' } as React.CSSProperties) : undefined}
          aria-live="polite"
          aria-atomic="true"
        >
          {monthLabel || '—'}
        </span>
      </div>

      <button
        type="button"
        onClick={() => step(1)}
        onPointerDown={() => setPressed('next')}
        onPointerUp={() => setPressed(null)}
        onPointerLeave={() => setPressed(null)}
        onBlur={() => setPressed(null)}
        disabled={!hasOlder}
        aria-label="下一个月"
        title="下一个月"
        className={`${arrowClass} ${pressed === 'next' ? 'bg-current/15 -translate-x-px' : ''}`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
