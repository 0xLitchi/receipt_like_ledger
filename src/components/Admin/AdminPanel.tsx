import React, { useState, useEffect } from 'react';
import type { Transaction } from '../../types';
import { X, Plus, Trash2, Save, LogOut, Table, Check, AlertCircle, FileCode } from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onBatchSave: (items: Transaction[], deletedIds: string[]) => Promise<void>;
  onLogout: () => void;
}

// 4. 解析文本数据解析器
const parseRawLedgerText = (text: string): Transaction[] => {
  const lines = text.split('\n');
  const results: Transaction[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // 尝试以 \t 或多个连续空格拆分
    const parts = line.split('\t').map((p) => p.trim());
    const fields = parts.length >= 3 ? parts : line.split(/\s{2,}/).map((p) => p.trim());

    if (fields.length < 3) return;

    let title = fields[0] || '';
    let dateStr = fields[1] || '';
    let rawAmount = fields[2] || '0';
    let member = fields[3] || '默认';
    let categoryFull = fields[4] || '其它';
    let ledger = fields[5] || 'Default';

    // 若第 0 列为日期格式，则为无备注情况
    if (/^\d{4}-\d{2}-\d{2}$/.test(fields[0])) {
      title = '';
      dateStr = fields[0];
      rawAmount = fields[1] || '0';
      member = fields[2] || '默认';
      categoryFull = fields[3] || '其它';
      ledger = fields[4] || 'Default';
    }

    const cleanAmountStr = rawAmount.replace(/[￥,]/g, '');
    const amount = parseFloat(cleanAmountStr) || 0;

    let category = categoryFull;
    let subcategory = '';
    if (categoryFull.includes('/')) {
      const catParts = categoryFull.split('/');
      category = catParts[0];
      subcategory = catParts.slice(1).join('/');
    }

    results.push({
      id: `parse_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
      title,
      date: dateStr || new Date().toISOString().split('T')[0],
      amount,
      member,
      category,
      subcategory,
      ledger,
    });
  });

  return results;
};

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

  // 4. 解析文本弹窗状态
  const [showParseModal, setShowParseModal] = useState(false);
  const [rawText, setRawText] = useState('');

  // 弹窗打开时深拷贝同步
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

  // 添加空行
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
    if (target.id && !target.id.startsWith('new_') && !target.id.startsWith('parse_')) {
      setDeletedIds((prev) => [...prev, target.id]);
    }
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 4. 应用解析文本数据 (追加 或 覆盖)
  const handleApplyParsedData = (mode: 'append' | 'overwrite') => {
    if (!rawText.trim()) {
      alert('请先粘贴需要解析的账单文本数据');
      return;
    }

    const parsed = parseRawLedgerText(rawText);
    if (parsed.length === 0) {
      alert('未能成功解析数据，请检查文本格式');
      return;
    }

    if (mode === 'overwrite') {
      // 标记现有数据库 ID 均为待删除
      const currentDbIds = rows
        .map((r) => r.id)
        .filter((id) => id && !id.startsWith('new_') && !id.startsWith('parse_'));
      setDeletedIds((prev) => Array.from(new Set([...prev, ...currentDbIds])));
      setRows(parsed);
      setStatusMsg({ type: 'success', text: `已全部覆盖！共成功解析并替换 ${parsed.length} 条账目数据。` });
    } else {
      // 追加到现有数据前
      setRows((prev) => [...parsed, ...prev]);
      setStatusMsg({ type: 'success', text: `已成功追加 ${parsed.length} 条解析数据到表格顶部！` });
    }

    setRawText('');
    setShowParseModal(false);
  };

  // 批量保存所有修改到 Cloudflare D1
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/85 backdrop-blur-md no-print select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl text-slate-100 relative overflow-hidden">
        {/* 页眉 Header */}
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Excel 风格数据批量编辑
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowParseModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-lg text-xs font-mono font-bold transition-colors"
            >
              <FileCode className="w-4 h-4 text-indigo-400" />
              解析文本导入
            </button>

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

        {/* 状态消息 */}
        {statusMsg && (
          <div
            className={`p-2.5 text-xs flex items-center gap-2 border-b font-mono ${
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
                <th className="py-2.5 px-2 border-r border-slate-800 w-10 text-center">#</th>
                <th className="py-2.5 px-3 border-r border-slate-800 w-36">日期 (YYYY-MM-DD)</th>
                <th className="py-2.5 px-3 border-r border-slate-800 w-28">成员</th>
                <th className="py-2.5 px-3 border-r border-slate-800 w-28">主分类</th>
                <th className="py-2.5 px-3 border-r border-slate-800 w-28">子分类</th>
                <th className="py-2.5 px-3 border-r border-slate-800 min-w-[140px]">备注/名称</th>
                <th className="py-2.5 px-3 border-r border-slate-800 w-32 text-right">金额 (正收/负支)</th>
                <th className="py-2.5 px-2 text-center w-14">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-1 px-2 border-r border-slate-800/80 text-center opacity-50 bg-slate-950/40">
                    {idx + 1}
                  </td>

                  {/* 3. 日期使用标准的 YYYY-MM-DD 文本输入格式 */}
                  <td className="p-0 border-r border-slate-800/80">
                    <input
                      type="text"
                      placeholder="YYYY-MM-DD"
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

                  {/* 备注 */}
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
                      title="删除行"
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

      {/* 4. 解析文本导入弹窗 */}
      {showParseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl text-slate-100 relative">
            <button
              onClick={() => setShowParseModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold flex items-center gap-2 mb-2">
              <FileCode className="w-5 h-5 text-indigo-400" />
              解析文本数据增加到数据库
            </h3>
            <p className="text-xs text-slate-400 mb-3 font-mono">
              请在下方粘贴 Tab 制表符分隔的账单文本，格式示例如下：<br />
              <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded block my-1">
                工会费	2026-08-13	￥-117.82	扶正	杂项/其它	Default
              </code>
            </p>

            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="在此粘贴包含多行账单的原始文本..."
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 mb-4"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400 font-mono">
                预览解析: {rawText.trim() ? `${parseRawLedgerText(rawText).length} 条` : '0 条'}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyParsedData('append')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono font-bold shadow"
                >
                  追加到现有数据
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyParsedData('overwrite')}
                  className="px-4 py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-mono font-bold shadow"
                >
                  全部覆盖现有数据
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
