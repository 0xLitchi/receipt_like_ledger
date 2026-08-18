import React from 'react';
import type { FilterState, ThemeType } from '../types';
import { Calendar, User, Tag, Search, ShieldCheck, ShieldAlert, Palette, RotateCcw } from 'lucide-react';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  months: string[];
  members: string[];
  categories: string[];
  theme: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
  isAdmin: boolean;
  onToggleAdminModal: () => void;
  onResetDemo: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  months,
  members,
  categories,
  theme,
  onThemeChange,
  isAdmin,
  onToggleAdminModal,
  onResetDemo,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto mb-6 p-4 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md shadow-lg text-slate-200 no-print">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* 左侧：筛选器组 */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* 月份筛选 */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={filters.month}
              onChange={(e) => onFilterChange({ ...filters, month: e.target.value })}
              className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">全部月份</option>
              {months.map((m) => (
                <option key={m} value={m} className="bg-slate-900">{m}</option>
              ))}
            </select>
          </div>

          {/* 成员筛选 */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={filters.member}
              onChange={(e) => onFilterChange({ ...filters, member: e.target.value })}
              className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">全部成员</option>
              {members.map((mem) => (
                <option key={mem} value={mem} className="bg-slate-900">{mem}</option>
              ))}
            </select>
          </div>

          {/* 分类筛选 */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
            <Tag className="w-3.5 h-3.5 text-purple-400" />
            <select
              value={filters.category}
              onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
              className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">全部分类</option>
              {categories.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>

          {/* 搜索关键词 */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 flex-1 min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="搜索备注/说明..."
              value={filters.search}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              className="bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none w-full"
            />
          </div>
        </div>

        {/* 右侧：主题、管理员管理与重置按钮 */}
        <div className="flex items-center gap-2 text-xs">
          {/* 主题选择 */}
          <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1.5 rounded-lg border border-slate-700">
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={theme}
              onChange={(e) => onThemeChange(e.target.value as ThemeType)}
              className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="paper-white" className="bg-slate-900">冷白热敏纸</option>
              <option value="paper-vintage" className="bg-slate-900">复古黄纸</option>
              <option value="paper-dark" className="bg-slate-900">极客暗黑</option>
              <option value="paper-receipt-blue" className="bg-slate-900">蓝印热敏纸</option>
            </select>
          </div>

          {/* 重置 Demo 数据 */}
          <button
            onClick={onResetDemo}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
            title="重置预设 Demo 数据"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* 后台管理按钮 */}
          <button
            onClick={onToggleAdminModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-all ${
              isAdmin
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-indigo-600/30 border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/50'
            }`}
          >
            {isAdmin ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                后台管理 (已登录)
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                管理员入口
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
