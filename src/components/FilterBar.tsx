import React from 'react';

interface FilterBarProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  recentMonths: string[]; // 最近三个月 YYYY-MM
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedMonth,
  onSelectMonth,
  recentMonths,
}) => {
  const selectedIndex = Math.max(
    0,
    recentMonths.findIndex((m) => m === selectedMonth)
  );

  return (
    <div className="w-full max-w-sm mx-auto mb-6 no-print select-none">
      {/* 机械风滑块外壳 */}
      <div className="relative p-1.5 bg-slate-900 border-2 border-slate-800 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.5)]">
        {/* 背景微颗粒网格 */}
        <div className="absolute inset-0 rounded-xl opacity-15 pointer-events-none bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:6px_6px]" />

        {/* 滑块块体 (Slider Knob, 已去除横条与绿光指示灯) */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-lg bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border border-slate-100 shadow-[0_3px_8px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.9)] transition-all duration-300 ease-out"
          style={{
            width: `calc((100% - 12px) / ${Math.max(1, recentMonths.length)})`,
            transform: `translateX(calc(${selectedIndex} * 100%))`,
          }}
        />

        {/* 月份按钮组 (格式化为 YYYY-MM) */}
        <div className="relative z-10 grid grid-cols-3 text-center">
          {recentMonths.map((m, idx) => {
            const isActive = selectedIndex === idx;
            return (
              <button
                key={m}
                onClick={() => onSelectMonth(m)}
                className={`py-2 px-1 rounded-lg text-xs font-mono font-black tracking-wider transition-colors duration-200 ${
                  isActive
                    ? 'text-slate-950 font-extrabold scale-105'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
