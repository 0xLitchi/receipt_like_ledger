import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LedgerFilters, LedgerType } from '../types';
import { Search, SlidersHorizontal, X } from 'lucide-react';

interface LedgerFilterBarProps {
  filters: LedgerFilters;
  members: string[];
  categories: string[];
  activeCount: number;
  onChange: (next: Partial<LedgerFilters>) => void;
  onReset: () => void;
}

const TYPE_OPTIONS: { value: LedgerType; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'EXPENSE', label: '支出' },
  { value: 'INCOME', label: '收入' },
];

const selectClass =
  'w-full appearance-none bg-slate-900/80 border border-slate-700 text-slate-200 text-[11px] font-mono font-bold rounded-lg px-2 py-1.5 pr-6 cursor-pointer hover:border-slate-600 focus:outline-none focus:border-emerald-500/70 transition-colors';

const Chip: React.FC<{
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-colors cursor-pointer ${
      active
        ? 'bg-slate-200 text-slate-900 shadow-sm'
        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
    }`}
  >
    {children}
  </button>
);

/** 小票下方的筛选条：收支切换 + 成员/分类下拉 + 关键词搜索，条件全部同步到 URL */
export const LedgerFilterBar: React.FC<LedgerFilterBarProps> = ({
  filters,
  members,
  categories,
  activeCount,
  onChange,
  onReset,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full max-w-md mx-auto mb-3 no-print select-none relative z-10 font-mono">
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 p-1 bg-slate-900 border border-slate-800 rounded-lg shadow-inner">
          {TYPE_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={filters.type === opt.value}
              onClick={() => onChange({ type: opt.value })}
            >
              {opt.label}
            </Chip>
          ))}
        </div>

        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="搜索备注 / 成员 / 分类"
            aria-label="搜索备注、成员或分类"
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-[11px] font-mono rounded-lg pl-7 pr-6 py-2 placeholder-slate-500 focus:outline-none focus:border-emerald-500/70 transition-colors"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ search: '' })}
              aria-label="清空搜索"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`relative shrink-0 p-2 rounded-lg border transition-colors cursor-pointer ${
            open || activeCount > 0
              ? 'bg-slate-800 border-emerald-500/50 text-emerald-400'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="更多筛选"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 p-2 bg-slate-900 border border-slate-800 rounded-lg grid grid-cols-2 gap-2 shadow-lg">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 tracking-widest">成员</span>
                <select
                  value={filters.member}
                  onChange={(e) => onChange({ member: e.target.value })}
                  className={selectClass}
                >
                  <option value="ALL">全部成员</option>
                  {members.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 tracking-widest">分类</span>
                <select
                  value={filters.category}
                  onChange={(e) => onChange({ category: e.target.value })}
                  className={selectClass}
                >
                  <option value="ALL">全部分类</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={onReset}
                  className="col-span-2 py-1.5 rounded-md border border-slate-700 text-slate-300 text-[11px] font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  清除全部筛选 ({activeCount})
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
