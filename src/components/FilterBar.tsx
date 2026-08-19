import React from 'react';
import { Calendar, Receipt, Gamepad2 } from 'lucide-react';

export type ThemeStyle = 'receipt' | 'gameboy';

interface FilterBarProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  recentMonths: string[];
  themeStyle: ThemeStyle;
  onSelectThemeStyle: (style: ThemeStyle) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedMonth,
  onSelectMonth,
  recentMonths,
  themeStyle,
  onSelectThemeStyle,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 w-full max-w-md mx-auto select-none no-print">
      {/* 左侧：月份切换滑动控制器 */}
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
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all duration-200 cursor-pointer ${
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

      {/* 右侧：UI 界面风格切换器 (拟真小票 vs GameBoy 绿屏) */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-full shadow-lg backdrop-blur-md">
        <button
          onClick={() => onSelectThemeStyle('receipt')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
            themeStyle === 'receipt'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="拟真热敏小票风格"
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>小票</span>
        </button>

        <button
          onClick={() => onSelectThemeStyle('gameboy')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
            themeStyle === 'gameboy'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="80s GameBoy 像素复古绿屏风格"
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>GameBoy</span>
        </button>
      </div>
    </div>
  );
};
