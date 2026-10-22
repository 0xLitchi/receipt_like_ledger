import React, { useMemo } from 'react';
import { Command } from 'cmdk';
import type { Transaction } from '../types';
import { getTransactionName } from '../utils/formatters';
import { categoryLabel } from '../features/ledger/use-ledger';
import { amountColor } from '../features/ledger/access-mode';
import { formatCurrency } from '../utils/formatters';
import {
  CalendarDays,
  CornerDownLeft,
  Search,
  Settings2,
  Shield,
  Trash2,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  month: string;
  hasFullAccess: boolean;
  isAdmin: boolean;
  onSelectMonth: (month: string) => void;
  onSearch: (keyword: string) => void;
  onOpenAdmin: () => void;
  onResetFilters: () => void;
}

/**
 * ⌘K / Ctrl+K 唤起：跳月份、搜备注、进后台、清筛选。
 * 只做导航与检索，不修改数据，避免误操作。
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  transactions,
  month,
  hasFullAccess,
  isAdmin,
  onSelectMonth,
  onSearch,
  onOpenAdmin,
  onResetFilters,
}) => {
  // 月份来自当前全部交易，与服务端月份列表保持一致
  const months = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) set.add(t.date.substring(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const run = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4 bg-black/70 backdrop-blur-sm no-print"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 shadow-2xl font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="命令面板" loop>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <Command.Input
              autoFocus
              placeholder="搜索备注、跳转月份、或输入「后台」…"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <kbd className="text-[10px] text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[52vh] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-xs text-slate-500">
              没有匹配结果
            </Command.Empty>

            <Command.Group
              heading="跳转月份"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-500"
            >
              {months.map((m) => (
                <Command.Item
                  key={m}
                  value={`月份 ${m}`}
                  onSelect={() => run(() => onSelectMonth(m))}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-300 cursor-pointer data-[selected=true]:bg-slate-800 data-[selected=true]:text-white"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                  <span>{m}</span>
                  {m === month && <span className="ml-auto text-[10px] text-emerald-400">当前</span>}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group
              heading="交易"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-500"
            >
              {transactions.slice(0, 300).map((t) => {
                const name = hasFullAccess ? getTransactionName(t) : '***';
                return (
                  <Command.Item
                    key={t.id}
                    value={`${name} ${t.date} ${t.member} ${categoryLabel(t)}`}
                    onSelect={() => run(() => onSearch(t.title || ''))}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-300 cursor-pointer data-[selected=true]:bg-slate-800 data-[selected=true]:text-white"
                  >
                    <CornerDownLeft className="w-3 h-3 text-slate-600 shrink-0" />
                    <span className="truncate flex-1">{name}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {t.date?.substring(5)}
                    </span>
                    <span className={`text-[11px] font-bold shrink-0 ${amountColor(t.amount)}`}>
                      {hasFullAccess ? formatCurrency(t.amount, false, false) : '***'}
                    </span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            <Command.Group
              heading="操作"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-500"
            >
              <Command.Item
                value="后台 管理 admin login"
                onSelect={() => run(onOpenAdmin)}
                className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-300 cursor-pointer data-[selected=true]:bg-slate-800 data-[selected=true]:text-white"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isAdmin ? '打开后台管理' : '登录后台管理'}</span>
              </Command.Item>
              <Command.Item
                value="清除筛选 reset"
                onSelect={() => run(onResetFilters)}
                className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-300 cursor-pointer data-[selected=true]:bg-slate-800 data-[selected=true]:text-white"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                <span>清除全部筛选</span>
              </Command.Item>
              <Command.Item
                value="设置 settings"
                onSelect={() => run(onOpenAdmin)}
                className="flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-slate-300 cursor-pointer data-[selected=true]:bg-slate-800 data-[selected=true]:text-white"
              >
                <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                <span>通用设置</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
            <span>↑↓ 选择 · ↵ 确认</span>
            <span>⌘K 随时唤起</span>
          </div>
        </Command>
      </div>
    </div>
  );
};
