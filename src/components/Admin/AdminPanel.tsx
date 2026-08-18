import React, { useState } from 'react';
import type { Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { X, Plus, Edit2, Trash2, LogOut, FileText, Database } from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onAdd: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  transactions,
  onAdd,
  onEdit,
  onDelete,
  onLogout,
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
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">后台管理面板</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增交易
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 rounded-lg text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              退出后台
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 搜索 */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center gap-3 text-xs">
          <input
            type="text"
            placeholder="搜索条目..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <div className="text-slate-400 font-mono text-xs">
            共 <span className="text-indigo-400 font-bold">{transactions.length}</span> 笔数据
          </div>
        </div>

        {/* 表格内容 */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
              <FileText className="w-8 h-8 opacity-30" />
              <span>暂无匹配记录</span>
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
                  <th className="pb-3 px-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((item) => {
                  const isInc = item.amount > 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-2 font-semibold text-slate-300">{item.date}</td>
                      <td className="py-2.5 px-2 text-slate-100 font-bold">
                        {item.title || <span className="opacity-40 italic font-normal">无备注</span>}
                      </td>
                      <td className={`py-2.5 px-2 font-black ${isInc ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(item.amount, true)}
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded font-semibold text-[10px]">
                          {item.member}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-300">
                        {item.category}{item.subcategory ? ` / ${item.subcategory}` : ''}
                      </td>
                      <td className="py-2.5 px-2 text-right space-x-2">
                        <button
                          onClick={() => onEdit(item)}
                          className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="修改"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
