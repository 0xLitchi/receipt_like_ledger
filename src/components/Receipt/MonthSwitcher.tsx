import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthSwitcherProps {
  /** 当前月份 YYYY-MM */
  selectedMonth: string;
  /** 可选月份，倒序（最新在前） */
  months: string[];
  onChange: (month: string) => void;
}

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const arrowClass =
  'p-1 rounded transition-all duration-150 cursor-pointer outline-none ' +
  'opacity-45 hover:opacity-100 hover:bg-current/10 focus-visible:ring-2 focus-visible:ring-current/40 ' +
  'disabled:opacity-12 disabled:cursor-default disabled:hover:bg-transparent';

/**
 * 小票内的月份切换：左右箭头 + 当前月份。
 * 放在纸面顶部的虚线行里，与账本其余内容共用一条基线，不额外占高度。
 */
export const MonthSwitcher: React.FC<MonthSwitcherProps> = ({ selectedMonth, months, onChange }) => {
  const index = months.indexOf(selectedMonth);
  // months 为倒序，右侧是更早的月份
  const hasNewer = index > 0;
  const hasOlder = index >= 0 && index < months.length - 1;

  const [year, month] = selectedMonth ? selectedMonth.split('-') : ['', ''];
  const monthLabel = month ? `${MONTH_LABELS[Number(month) - 1] ?? month} ${year}` : '';

  const step = (delta: number) => {
    const next = months[index + delta];
    if (next) onChange(next);
  };

  return (
    <div className="flex items-center justify-between border-y border-dashed border-current/30 py-0.5 px-0.5">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={!hasNewer}
        aria-label="上一个月"
        title="上一个月"
        className={arrowClass}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="text-center select-none">
        <span className="text-[0.815em] font-black tracking-[0.22em]">{monthLabel || '—'}</span>
      </div>

      <button
        type="button"
        onClick={() => step(1)}
        disabled={!hasOlder}
        aria-label="下一个月"
        title="下一个月"
        className={arrowClass}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
