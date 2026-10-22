import React from 'react';

interface ReceiptHeaderProps {
  selectedMonth: string;
  hasFullAccess?: boolean;
}

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * 小票抬头：店名、月份、单号。
 * 分类汇总由 CategorySummary 单独渲染在明细表上方。
 */
export const ReceiptHeader: React.FC<ReceiptHeaderProps> = ({ selectedMonth, hasFullAccess = true }) => {
  const [year, month] = selectedMonth ? selectedMonth.split('-') : ['', ''];
  const monthLabel = month ? `${MONTH_LABELS[Number(month) - 1] ?? month} ${year}` : 'ALL PERIODS';

  return (
    <div className="text-center pt-1 pb-1 select-none font-pixel tracking-wider">
      <div className="text-[15px] font-black tracking-[0.35em] leading-tight">RECEIPT LEDGER</div>
      <div className="text-[10px] tracking-[0.25em] opacity-60 mt-0.5">小 票 记 账 本</div>

      <div className="mt-2 mx-auto w-4/5 border-y border-dashed border-current/30 py-1">
        <div className="flex items-center justify-between text-[10px] tracking-widest opacity-80">
          <span>{monthLabel}</span>
          <span>{hasFullAccess ? 'ACCESS OK' : 'MASKED'}</span>
        </div>
      </div>
    </div>
  );
};
