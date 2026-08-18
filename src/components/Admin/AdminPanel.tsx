import React, { useState, useEffect } from 'react';
import type { Transaction } from '../../types';
import { X, Plus, Trash2, Save, LogOut, Table, Check, AlertCircle } from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onBatchSave: (items: Transaction[], deletedIds: string[]) => Promise<void>;
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  transactions,
  onBatchSave,
  onLogout,
}) => {
  // 本地 Excel 可编辑数组
  const [rows, setRows] = useState<Transaction[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 当弹窗打开时，深拷贝并同步数据到本地 Excel 可编辑表格
  useEffect(() => {
    if (isOpen) {
      setRows(JSON.parse(JSON.stringify(transactions)));
      setDeletedIds([]);
      setStatusMsg(null);
    }
  }, [isOpen, transactions]);

  if (!isOpen) return null;

  // 单元格数据更动
  const handleCellChange = (index: number, field: keyof Transaction, value: any) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: field === 'amount' ? (value === '' ? 0 : parseFloat(value) || 0) : value,
      };
      return copy;
    });
  };

  // 添加一行空 Excel 数据
  const handleAddRow = () => {
    const newRow: Transaction = {
      id: `new_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: new Date().toISOString().split('T')[0],
      member: '荔枝',
      category: '杂项',
      subcategory: '',
      title: '',
      amount: 0,
      ledger: 'Default',
    };
    setRows((prev) => [newRow, ...prev]);
  };

  // 删除某一行
  const handleDeleteRow = (index: number) => {
    const target = rows[index];
    if (target.id && !target.id.startsWith('new_')) {
      setDeletedIds((prev) => [...prev, target.id]);
    }
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 保存表格中所有改动
  const handleSaveAll = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      await onBatchSave(rows, deletedIds);
      setStatusMsg({ type: 'success', text: '已成功批量保存所有数据更改！' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: '保存失败: ' + (err.message || '请检查密码或后端服务') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md no-print select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl text-slate-100 relative overflow-hidden">
        {/* 页眉 Header */}
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Excel 风格数据表格批量编辑
                <span className="text-xs font-mono font-normal text-slate-400">
                  (直接编辑任意单元格后点击保存)
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold border border-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              添加新行
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold shadow transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? '正在保存...' : '批量保存修改'}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 rounded-lg text-xs font-mono font-bold transition-colors ml-2"
            >
              <LogOut className="w-4 h-4" />
              退出
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 提示消息通知 */}
        {statusMsg && (
          <div
            className={`p-3 text-xs flex items-center gap-2 border-b font-mono ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Excel 可编辑数据表格 */}
        <div className="flex-1 overflow-auto p-2 font-mono text-xs">
          <table className="w-full text-left border-collapse border border-slate-800">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800 sticky top-0 z-10 shadow-sm">
                <th className="py-2.5 px-2 border-r border-slate-800 w-12 text-center">#</th>
                <th className="py-2.5 px-3 border-r border-slate-800 w-32">日期 (YYYY-MM-DD)</th>
                <th className="py-2.5 px-3 border-r border-slate-800 w-28">成员</th>
                <th className="py-2.5 px-3 border-r border-slate-800 w-28">主分类</th>
                <th className="py-2.5 px-3 border-r border-slate-800 w-28">子分类</th>
                <th className="py-2.5 px-3 border-r border-slate-800 min-w-[160px]">备注/说明</th>
                <th className="py-2.5 px-3 border-r border-slate-800 w-32 text-right">金额 (正收/负支)</th>
                <th className="py-2.5 px-2 text-center w-16">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-slate-800/50 transition-colors group">
                  {/* 行号 */}
                  <td className="py-1 px-2 border-r border-slate-800/80 text-center opacity-50 bg-slate-950/40">
                    {idx + 1}
                  </td>

                  {/* 日期 */}
                  <td className="p-0 border-r border-slate-800/80">
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => handleCellChange(idx, 'date', e.target.value)}
                      className="w-full h-full px-2 py-1.5 bg-transparent text-slate-200 focus:bg-slate-800 focus:outline-none font-mono"
                    />
                  </td>

                  {/* 成员 */}
                  <td className="p-0 border-r border-slate-800/80">
                    <input
                      type="text"
                      value={row.member}
                      onChange={(e) => handleCellChange(idx, 'member', e.target.value)}
                      className="w-full h-full px-2 py-1.5 bg-transparent text-slate-200 focus:bg-slate-800 focus:outline-none font-bold"
                    />
                  </td>

                  {/* 主分类 */}
                  <td className="p-0 border-r border-slate-800/80">
                    <input
                      type="text"
                      value={row.category}
                      onChange={(e) => handleCellChange(idx, 'category', e.target.value)}
                      className="w-full h-full px-2 py-1.5 bg-transparent text-slate-200 focus:bg-slate-800 focus:outline-none"
                    />
                  </td>

                  {/* 子分类 */}
                  <td className="p-0 border-r border-slate-800/80">
                    <input
                      type="text"
                      value={row.subcategory}
                      onChange={(e) => handleCellChange(idx, 'subcategory', e.target.value)}
                      className="w-full h-full px-2 py-1.5 bg-transparent text-slate-200 focus:bg-slate-800 focus:outline-none"
                    />
                  </td>

                  {/* 备注说明 */}
                  <td className="p-0 border-r border-slate-800/80">
                    <input
                      type="text"
                      placeholder="选填"
                      value={row.title}
                      onChange={(e) => handleCellChange(idx, 'title', e.target.value)}
                      className="w-full h-full px-2 py-1.5 bg-transparent text-slate-200 focus:bg-slate-800 focus:outline-none"
                    />
                  </td>

                  {/* 金额 */}
                  <td className="p-0 border-r border-slate-800/80">
                    <input
                      type="number"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => handleCellChange(idx, 'amount', e.target.value)}
                      className={`w-full h-full px-2 py-1.5 bg-transparent text-right font-mono font-bold focus:bg-slate-800 focus:outline-none ${
                        row.amount > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    />
                  </td>

                  {/* 删除 */}
                  <td className="py-1 px-2 text-center">
                    <button
                      onClick={() => handleDeleteRow(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="删除整行"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
