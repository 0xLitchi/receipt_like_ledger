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
  const formatMonthLabel = (mStr: string) => {
    if (!mStr) return '00月';
    const parts = mStr.split('-');
    if (parts.length === 2) {
      return `${parseInt(parts[1], 10)}月`;
    }
    return mStr;
  };

  const selectedIndex = Math.max(
    0,
    recentMonths.findIndex((m) => m === selectedMonth)
  );

  return (
    <div className="w-full max-w-sm mx-auto mb-6 no-print select-none">
      {/* 机械复古风滑块外壳 */}
      <div className="relative p-1.5 bg-slate-900 border-2 border-slate-700/80 rounded-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.4)] backdrop-blur-md">
        {/* 背景机械金属刻度纹理 */}
        <div className="absolute inset-0 rounded-xl opacity-20 pointer-events-none bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:8px_8px]" />

        {/* 动态滑块背板 (Slider Knob) */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-lg bg-gradient-to-b from-slate-200 to-slate-400 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.8)] transition-all duration-300 ease-out"
          style={{
            width: `calc((100% - 12px) / ${Math.max(1, recentMonths.length)})`,
            transform: `translateX(calc(${selectedIndex} * 100%))`,
          }}
        >
          {/* 滑块顶部的机械凸起与指示灯 */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-slate-500/50 rounded-full" />
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
        </div>

        {/* 月份按钮组 */}
        <div className="relative z-10 grid grid-cols-3 text-center">
          {recentMonths.map((m, idx) => {
            const isActive = selectedIndex === idx;
            return (
              <button
                key={m}
                onClick={() => onSelectMonth(m)}
                className={`py-2 px-1 rounded-lg text-xs font-mono font-black tracking-widest uppercase transition-colors duration-200 ${
                  isActive
                    ? 'text-slate-950 font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {formatMonthLabel(m)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
