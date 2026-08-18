import React from 'react';

interface FilterBarProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  recentMonths: string[]; // 最近三个月，如 ["2026-08", "2026-07", "2026-06"]
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedMonth,
  onSelectMonth,
  recentMonths,
}) => {
  // 转换 YYYY-MM 为更直观的中文表达，如 "2026年8月" 或 "8月"
  const formatMonthLabel = (mStr: string) => {
    if (!mStr || mStr === 'ALL') return '全部';
    const parts = mStr.split('-');
    if (parts.length === 2) {
      return `${parseInt(parts[1], 10)}月`;
    }
    return mStr;
  };

  return (
    <div className="w-full max-w-xs mx-auto mb-6 no-print">
      <div className="flex items-center justify-center gap-2 p-1 bg-slate-900/90 border border-slate-800 rounded-full backdrop-blur-md shadow-md">
        {recentMonths.map((m) => {
          const isActive = selectedMonth === m;
          return (
            <button
              key={m}
              onClick={() => onSelectMonth(m)}
              className={`flex-1 py-1.5 px-3 rounded-full text-xs font-mono font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-slate-100 text-slate-900 shadow-sm scale-105'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {formatMonthLabel(m)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
