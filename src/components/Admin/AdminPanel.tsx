import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Transaction } from '../../types';
import {
  X,
  Plus,
  Trash2,
  Save,
  LogOut,
  Search,
  FileCode,
  Download,
  Check,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onBatchSave: (items: Transaction[], deletedIds: string[]) => Promise<void>;
  onLogout: () => void;
}

// 文本数据解析器 (支持制表符 \t 或多空格拆分)
const parseRawLedgerText = (text: string): Transaction[] => {
  const lines = text.split('\n');
  const results: Transaction[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const parts = line.split('\t').map((p) => p.trim());
    const fields = parts.length >= 3 ? parts : line.split(/\s{2,}/).map((p) => p.trim());

    if (fields.length < 3) return;

    let title = fields[0] || '';
    let dateStr = fields[1] || '';
    let rawAmount = fields[2] || '0';
    let member = fields[3] || '默认';
    let categoryFull = fields[4] || '其它';
    let ledger = fields[5] || 'Default';

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
      id: `parse_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
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
  const [rows, setRows] = useState<Transaction[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Transaction | ''>('');
  const [sortAsc, setSortAsc] = useState(true);

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showParseModal, setShowParseModal] = useState(false);
  const [rawText, setRawText] = useState('');

  // 初始化数据加载
  useEffect(() => {
    if (isOpen) {
      setRows(JSON.parse(JSON.stringify(transactions)));
      setDeletedIds([]);
      setSelectedIds(new Set());
      setStatusMsg(null);
    }
  }, [isOpen, transactions]);

  // 修改单元格
  const handleCellChange = useCallback((id: string, field: keyof Transaction, value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            [field]: field === 'amount' ? (value === '' ? 0 : parseFloat(value) || 0) : value,
          };
        }
        return r;
      })
    );
  }, []);

  // 添加新行
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

  // 单行删除
  const handleDeleteRow = (id: string) => {
    if (id && !id.startsWith('new_') && !id.startsWith('parse_')) {
      setDeletedIds((prev) => [...prev, id]);
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // 全选/反选处理
  const handleToggleSelectAll = (filteredRows: Transaction[]) => {
    const allFilteredIds = filteredRows.map((r) => r.id);
    const isAllSelected = allFilteredIds.every((id) => selectedIds.has(id));

    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 批量删除选中行
  const handleBulkDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    const toDeleteDbIds = Array.from(selectedIds).filter(
      (id) => id && !id.startsWith('new_') && !id.startsWith('parse_')
    );

    setDeletedIds((prev) => Array.from(new Set([...prev, ...toDeleteDbIds])));
    setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    setSelectedIds(new Set());
  };

  // 排序切换处理
  const handleSort = (field: keyof Transaction) => {
    if (sortField === field) {
      if (sortAsc) {
        setSortAsc(false);
      } else {
        setSortField('');
        setSortAsc(true);
      }
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // 过滤与排序后的行数据
  const processedRows = useMemo(() => {
    let result = [...rows];

    // 全局多维过滤检索
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          (r.title || '').toLowerCase().includes(q) ||
          (r.member || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q) ||
          (r.subcategory || '').toLowerCase().includes(q) ||
          (r.date || '').toLowerCase().includes(q) ||
          String(r.amount).includes(q)
      );
    }

    // 排序
    if (sortField) {
      result.sort((a: any, b: any) => {
        const valA = a[sortField] ?? '';
        const valB = b[sortField] ?? '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }

        return sortAsc
          ? String(valA).localeCompare(String(valB), 'zh-CN')
          : String(valB).localeCompare(String(valA), 'zh-CN');
      });
    }

    return result;
  }, [rows, searchQuery, sortField, sortAsc]);

  // 文本解析器保存逻辑
  const handleApplyParsedData = async (mode: 'append' | 'overwrite') => {
    if (!rawText.trim()) {
      alert('请先粘贴需要解析的账单文本数据');
      return;
    }

    const parsed = parseRawLedgerText(rawText);
    if (parsed.length === 0) {
      alert('未能成功解析数据，请检查文本格式');
      return;
    }

    setSaving(true);
    setStatusMsg(null);

    let nextRows: Transaction[] = [];
    let nextDeletedIds: string[] = [...deletedIds];

    if (mode === 'overwrite') {
      const currentDbIds = rows
        .map((r) => r.id)
        .filter((id) => id && !id.startsWith('new_') && !id.startsWith('parse_'));
      nextDeletedIds = Array.from(new Set([...nextDeletedIds, ...currentDbIds]));
      nextRows = parsed;
    } else {
      nextRows = [...parsed, ...rows];
    }

    try {
      await onBatchSave(nextRows, nextDeletedIds);
      setRows(nextRows);
      setDeletedIds([]);
      setRawText('');
      setShowParseModal(false);
      setStatusMsg({
        type: 'success',
        text: mode === 'overwrite'
          ? `已成功覆盖并保存 ${parsed.length} 条账目数据到数据库！`
          : `已成功追加并保存 ${parsed.length} 条账目数据到数据库！`,
      });
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: '保存失败: ' + (err.message || '网络或密码错误') });
    } finally {
      setSaving(false);
    }
  };

  // 导出 CSV
  const handleExportCSV = () => {
    const headers = ['id', 'date', 'title', 'amount', 'member', 'category', 'subcategory'];
    const csvLines = [headers.join(',')];

    processedRows.forEach((r) => {
      const line = [
        r.id,
        r.date,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        r.amount,
        `"${(r.member || '').replace(/"/g, '""')}"`,
        `"${(r.category || '').replace(/"/g, '""')}"`,
        `"${(r.subcategory || '').replace(/"/g, '""')}"`,
      ].join(',');
      csvLines.push(line);
    });

    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt_ledger_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // 保存全部更改
  const handleSaveAll = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      await onBatchSave(rows, deletedIds);
      setDeletedIds([]);
      setStatusMsg({ type: 'success', text: '已成功批量保存所有更改！' });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: '保存失败: ' + (err.message || '请检查密码或后端服务') });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isAllFilteredSelected =
    processedRows.length > 0 && processedRows.every((r) => selectedIds.has(r.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/85 backdrop-blur-md no-print select-none">
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl text-slate-100 relative overflow-hidden">
        {/* 顶部绚丽彩带 */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-rose-500" />

        {/* Header 导航工具栏 */}
        <div className="p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-950/80">
          {/* 左侧：标题与指标 Token */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono tracking-tight flex items-center gap-2">
                Notion / Linear 科技感数据工作台
              </h2>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                <span>共 <strong className="text-slate-200">{rows.length}</strong> 行</span>
                <span>•</span>
                {selectedIds.size > 0 && (
                  <span className="text-emerald-400 font-bold">已选 {selectedIds.size} 行</span>
                )}
                {deletedIds.length > 0 && (
                  <span className="text-rose-400">待删 {deletedIds.length} 行</span>
                )}
              </div>
            </div>
          </div>

          {/* 中间：全局检索过滤输入框 */}
          <div className="flex-1 max-w-xs relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索备注、成员、分类、日期..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* 右侧：功能按钮矩阵 */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowParseModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-lg text-xs font-mono font-bold transition-colors"
            >
              <FileCode className="w-4 h-4 text-indigo-400" />
              解析文本导入
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono transition-colors"
              title="导出当前表格为 CSV"
            >
              <Download className="w-4 h-4 text-slate-400" />
              导出 CSV
            </button>

            <button
              onClick={handleAddRow}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold border border-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              加行
            </button>

            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDeleteSelected}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-mono font-bold transition-colors"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                删除选中({selectedIds.size})
              </button>
            )}

            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存修改'}
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 rounded-lg text-xs font-mono font-bold transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
              退出
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 ml-1 rounded hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 状态通知 */}
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

        {/* 数据工作台表格区 */}
        <div className="flex-1 overflow-auto p-2 font-mono text-xs">
          <table className="w-full text-left border-collapse border border-slate-800">
            <thead>
              <tr className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800 sticky top-0 z-10 shadow-sm font-bold tracking-wider">
                {/* 勾选列 */}
                <th className="py-2.5 px-3 border-r border-slate-800 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={() => handleToggleSelectAll(processedRows)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20 bg-slate-900 cursor-pointer"
                  />
                </th>

                {/* 序号 */}
                <th className="py-2.5 px-2 border-r border-slate-800 w-12 text-center opacity-60">
                  #
                </th>

                {/* 日期 (可排序) */}
                <th className="py-2.5 px-3 border-r border-slate-800 w-36">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    日期 (YYYY-MM-DD)
                    {sortField === 'date' ? (
                      sortAsc ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </button>
                </th>

                {/* 成员 (可排序) */}
                <th className="py-2.5 px-3 border-r border-slate-800 w-28">
                  <button
                    onClick={() => handleSort('member')}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    成员
                    {sortField === 'member' ? (
                      sortAsc ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </button>
                </th>

                {/* 主分类 */}
                <th className="py-2.5 px-3 border-r border-slate-800 w-28">
                  <button
                    onClick={() => handleSort('category')}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    主分类
                    {sortField === 'category' ? (
                      sortAsc ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </button>
                </th>

                {/* 子分类 */}
                <th className="py-2.5 px-3 border-r border-slate-800 w-28">子分类</th>

                {/* 备注/说明 */}
                <th className="py-2.5 px-3 border-r border-slate-800 min-w-[140px]">备注/说明</th>

                {/* 金额 (可排序) */}
                <th className="py-2.5 px-3 border-r border-slate-800 w-36 text-right">
                  <button
                    onClick={() => handleSort('amount')}
                    className="flex items-center gap-1 hover:text-white transition-colors ml-auto"
                  >
                    金额 (正收/负支)
                    {sortField === 'amount' ? (
                      sortAsc ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </button>
                </th>

                {/* 操作 */}
                <th className="py-2.5 px-2 text-center w-14">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {processedRows.map((row, idx) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                        : 'hover:bg-slate-800/60'
                    }`}
                  >
                    {/* 复选框 */}
                    <td className="py-1 px-3 border-r border-slate-800/80 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(row.id)}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500/20 bg-slate-900 cursor-pointer"
                      />
                    </td>

                    {/* 序号 */}
                    <td className="py-1 px-2 border-r border-slate-800/80 text-center opacity-40 bg-slate-950/40">
                      {idx + 1}
                    </td>

                    {/* 日期 */}
                    <td className="p-0 border-r border-slate-800/80">
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD"
                        value={row.date || ''}
                        onChange={(e) => handleCellChange(row.id, 'date', e.target.value)}
                        className="w-full h-full px-2 py-1.5 bg-transparent text-slate-200 focus:bg-slate-800/80 focus:ring-1 focus:ring-emerald-500/40 rounded focus:outline-none font-mono"
                      />
                    </td>

                    {/* 成员 */}
                    <td className="p-0 border-r border-slate-800/80">
                      <input
                        type="text"
                        value={row.member || ''}
                        onChange={(e) => handleCellChange(row.id, 'member', e.target.value)}
                        className="w-full h-full px-2 py-1.5 bg-transparent text-slate-200 focus:bg-slate-800/80 focus:ring-1 focus:ring-emerald-500/40 rounded focus:outline-none font-bold"
                      />
                    </td>

                    {/* 主分类 */}
                    <td className="p-0 border-r border-slate-800/80">
                      <input
                        type="text"
                        value={row.category || ''}
                        onChange={(e) => handleCellChange(row.id, 'category', e.target.value)}
                        className="w-full h-full px-2 py-1.5 bg-transparent text-slate-200 focus:bg-slate-800/80 focus:ring-1 focus:ring-emerald-500/40 rounded focus:outline-none"
                      />
                    </td>

                    {/* 子分类 */}
                    <td className="p-0 border-r border-slate-800/80">
                      <input
                        type="text"
                        value={row.subcategory || ''}
                        onChange={(e) => handleCellChange(row.id, 'subcategory', e.target.value)}
                        className="w-full h-full px-2 py-1.5 bg-transparent text-slate-200 focus:bg-slate-800/80 focus:ring-1 focus:ring-emerald-500/40 rounded focus:outline-none"
                      />
                    </td>

                    {/* 备注 */}
                    <td className="p-0 border-r border-slate-800/80">
                      <input
                        type="text"
                        placeholder="选填"
                        value={row.title || ''}
                        onChange={(e) => handleCellChange(row.id, 'title', e.target.value)}
                        className="w-full h-full px-2 py-1.5 bg-transparent text-slate-200 focus:bg-slate-800/80 focus:ring-1 focus:ring-emerald-500/40 rounded focus:outline-none"
                      />
                    </td>

                    {/* 金额 */}
                    <td className="p-0 border-r border-slate-800/80">
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) => handleCellChange(row.id, 'amount', e.target.value)}
                        className={`w-full h-full px-2 py-1.5 bg-transparent text-right font-mono font-bold focus:bg-slate-800/80 focus:ring-1 focus:ring-emerald-500/40 rounded focus:outline-none ${
                          row.amount > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      />
                    </td>

                    {/* 删除 */}
                    <td className="py-1 px-2 text-center">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-slate-800"
                        title="删除行"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 解析文本导入弹窗 */}
      {showParseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl text-slate-100 relative">
            <button
              onClick={() => setShowParseModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold flex items-center gap-2 mb-2 font-mono">
              <FileCode className="w-5 h-5 text-indigo-400" />
              解析文本数据增加到数据库
            </h3>
            <p className="text-xs text-slate-400 mb-3 font-mono">
              在下方粘贴文本，点击确认按钮即可自动提交保存：<br />
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

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 font-mono">
              <span className="text-xs text-slate-400 font-mono">
                预计解析: {rawText.trim() ? `${parseRawLedgerText(rawText).length} 条记录` : '0 条'}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleApplyParsedData('append')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono font-bold shadow disabled:opacity-50"
                >
                  {saving ? '正在提交保存...' : '追加到现有数据并保存'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleApplyParsedData('overwrite')}
                  className="px-4 py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-mono font-bold shadow disabled:opacity-50"
                >
                  {saving ? '正在提交保存...' : '全部覆盖现有数据并保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
