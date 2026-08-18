import React, { useState } from 'react';
import type { Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { X, Plus, Edit2, Trash2, LogOut, FileText, Database, Layers } from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onAdd: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
  onImportDemo: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  transactions,
  onAdd,
  onEdit,
  onDelete,
  onLogout,
  onImportDemo,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filtered = transactions.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.member && t.member.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      (t.subcategory && t.subcategory.toLowerCase().includes(q)) ||
      (t.date && t.date.includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md no-print">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl text-slate-100 relative overflow-hidden">
        {/* 页眉 Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Cloudflare D1 后台管理面板</h2>
              <p className="text-xs text-slate-400">实时管理和修改记账本数据库条目</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增交易
            </button>
            <button
              onClick={onImportDemo}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
              title="重新一键初始化 Demo 9条数据"
            >
              <Layers className="w-4 h-4 text-amber-400" />
              重置 Demo 数据
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 rounded-lg text-xs font-semibold transition-colors"
              title="退出管理员模式"
            >
              <LogOut className="w-4 h-4" />
              退出
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 搜素与统计提示 */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <input
            type="text"
            placeholder="搜索已有条目 (日期/分类/成员/说明)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <div className="text-slate-400 font-mono">
            全库共 <span className="text-indigo-400 font-bold">{transactions.length}</span> 笔数据
            {searchTerm && ` (已筛选出 ${filtered.length} 笔)`}
          </div>
        </div>

        {/* 表格内容区域 */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
              <FileText className="w-10 h-10 opacity-30" />
              <span>没有找到对应的账目记录</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                  <th className="pb-3 px-2">日期</th>
                  <th className="pb-3 px-2">备注说明</th>
                  <th className="pb-3 px-2">金额</th>
                  <th className="pb-3 px-2">成员</th>
                  <th className="pb-3 px-2">分类/子分类</th>
                  <th className="pb-3 px-2">账本</th>
                  <th className="pb-3 px-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((item) => {
                  const isInc = item.amount > 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-2 font-semibold text-slate-300">{item.date}</td>
                      <td className="py-3 px-2 text-slate-100 font-bold">
                        {item.title || <span className="opacity-40 italic font-normal">无备注</span>}
                      </td>
                      <td className={`py-3 px-2 font-black ${isInc ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(item.amount, true)}
                      </td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded font-semibold">
                          {item.member}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-slate-300">
                        {item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}
                      </td>
                      <td className="py-3 px-2 opacity-60">{item.ledger || 'Default'}</td>
                      <td className="py-3 px-2 text-right space-x-2">
                        <button
                          onClick={() => onEdit(item)}
                          className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="修改"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
