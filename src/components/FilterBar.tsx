import React from 'react';
import { Calendar } from 'lucide-react';

interface FilterBarProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  recentMonths: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedMonth,
  onSelectMonth,
  recentMonths,
}) => {
  return (
    <div className="flex items-center justify-center mb-5 w-full max-w-md mx-auto select-none no-print">
      {/* 还原为清爽的单栏机械滑块月份切换器 */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-full shadow-lg backdrop-blur-md">
        <div className="px-2 text-slate-400">
          <Calendar className="w-4 h-4" />
        </div>

        {recentMonths.map((m) => {
          const isSelected = selectedMonth === m;
          const displayLabel = m.length >= 7 ? m.substring(5) + '月' : m;

          return (
            <button
              key={m}
              onClick={() => onSelectMonth(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 scale-105'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
};
