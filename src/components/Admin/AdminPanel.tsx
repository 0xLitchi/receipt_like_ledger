import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Transaction } from '../../types';
import {
  Plus,
  Trash2,
  Search,
  FileCode,
  Download,
  Check,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  ArrowLeft,
  X,
  RefreshCw,
} from 'lucide-react';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onBatchSave: (items: Transaction[], deletedIds: string[]) => Promise<void>;
  onLogout: () => void;
}

// 文本数据解析器
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

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始化加载
  useEffect(() => {
    if (isOpen) {
      setRows(JSON.parse(JSON.stringify(transactions)));
      setDeletedIds([]);
      setSelectedIds(new Set());
      setStatusMsg(null);
    }
  }, [isOpen, transactions]);

  // 4. 自动保存防抖提交到 Cloudflare D1
  const triggerAutoSave = useCallback(
    (currentRows: Transaction[], currentDeleted: string[]) => {
      setSaving(true);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          await onBatchSave(currentRows, currentDeleted);
          setDeletedIds([]);
          setStatusMsg({ type: 'success', text: '已实时自动保存' });
          setTimeout(() => setStatusMsg(null), 2500);
        } catch (err: any) {
          setStatusMsg({ type: 'error', text: '自动保存失败: ' + (err.message || '网络或密码错误') });
        } finally {
          setSaving(false);
        }
      }, 700);
    },
    [onBatchSave]
  );

  // 单元格修改并触发自动保存
  const handleCellChange = useCallback(
    (id: string, field: keyof Transaction, value: any) => {
      setRows((prev) => {
        const nextRows = prev.map((r) => {
          if (r.id === id) {
            return {
              ...r,
              [field]: field === 'amount' ? (value === '' ? 0 : parseFloat(value) || 0) : value,
            };
          }
          return r;
        });
        triggerAutoSave(nextRows, deletedIds);
        return nextRows;
      });
    },
    [deletedIds, triggerAutoSave]
  );

  // 4. 添加行并自动保存
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

    setRows((prev) => {
      const nextRows = [newRow, ...prev];
      triggerAutoSave(nextRows, deletedIds);
      return nextRows;
    });
  };

  // 全选/反选
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

  // 1 & 4. 批量删除选中行并自动保存（已移除了单行单元格删除列）
  const handleBulkDeleteSelected = () => {
    if (selectedIds.size === 0) return;

    const toDeleteDbIds = Array.from(selectedIds).filter(
      (id) => id && !id.startsWith('new_') && !id.startsWith('parse_')
    );

    const nextDeleted = Array.from(new Set([...deletedIds, ...toDeleteDbIds]));
    const nextRows = rows.filter((r) => !selectedIds.has(r.id));

    setDeletedIds(nextDeleted);
    setRows(nextRows);
    setSelectedIds(new Set());
    triggerAutoSave(nextRows, nextDeleted);
  };

  // 排序
  const handleSort = (field: keyof Transaction) => {
    if (sortField === field) {
      if (sortAsc) setSortAsc(false);
      else {
        setSortField('');
        setSortAsc(true);
      }
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // 过滤与排序
  const processedRows = useMemo(() => {
    let result = [...rows];

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

  // 文本解析器应用并自动保存
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
          ? `已成功覆盖并保存 ${parsed.length} 条数据！`
          : `已成功追加并保存 ${parsed.length} 条数据！`,
      });
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: '保存失败: ' + (err.message || '网络错误') });
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

  if (!isOpen) return null;

  const isAllFilteredSelected =
    processedRows.length > 0 && processedRows.every((r) => selectedIds.has(r.id));

  return (
    // 7. 后台管理界面改为全屏整页页面，且采用 Day 白天极简主题
    <div className="fixed inset-0 z-50 bg-slate-50 text-slate-800 flex flex-col font-mono day-admin-workbench select-none overflow-hidden">
      {/* 顶部导航栏 Header */}
      <header className="px-6 py-3.5 bg-white border-b border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* 左侧：返回小票按钮 + Admin Panel 2. 名称 */}
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold transition-colors border border-slate-300 shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            返回小票
          </button>

          <div className="h-5 w-px bg-slate-300" />

          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 border border-emerald-300 text-emerald-700 rounded-xl shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              {/* 2. 名称改为 "Admin Panel" */}
              <h1 className="text-lg font-bold font-mono tracking-tight text-slate-900 flex items-center gap-2">
                Admin Panel
              </h1>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                <span>共 <strong className="text-slate-800">{rows.length}</strong> 行</span>
                <span>•</span>
                {selectedIds.size > 0 && (
                  <span className="text-emerald-700 font-bold">已选 {selectedIds.size} 行</span>
                )}
                {/* 4. 自动保存状态指示 */}
                <span className="ml-1 text-[11px] flex items-center gap-1 text-slate-500 font-mono">
                  {saving ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                      <span className="text-amber-700 font-bold">正在自动保存...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700 font-medium">已自动保存</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 中间：全局多维搜索 */}
        <div className="flex-1 max-w-sm relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索备注、成员、分类、日期..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
          />
        </div>

        {/* 右侧：功能按钮（已去除了"保存修改"与"退出"按钮） */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowParseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-mono font-bold transition-colors shadow-xs cursor-pointer"
          >
            <FileCode className="w-4 h-4 text-indigo-600" />
            解析文本导入
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-mono transition-colors shadow-xs cursor-pointer"
            title="导出为 CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            导出 CSV
          </button>

          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            添加行
          </button>

          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDeleteSelected}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-mono font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              删除选中 ({selectedIds.size})
            </button>
          )}
        </div>
      </header>

      {/* 状态通知 */}
      {statusMsg && (
        <div
          className={`p-2.5 text-xs flex items-center justify-center gap-2 border-b font-mono ${
            statusMsg.type === 'success'
              ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
              : 'bg-rose-100 border-rose-200 text-rose-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 7. 白天主题表格区 */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 uppercase text-[11px] border-b border-slate-200 sticky top-0 z-10 font-bold tracking-wider">
                {/* 勾选列 */}
                <th className="py-3 px-3 border-r border-slate-200 w-12 text-center bg-slate-100">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={() => handleToggleSelectAll(processedRows)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 bg-white cursor-pointer"
                  />
                </th>

                {/* 序号 */}
                <th className="py-3 px-2 border-r border-slate-200 w-12 text-center opacity-60 bg-slate-100">
                  #
                </th>

                {/* 5. 简洁表头: 日期 */}
                <th className="py-3 px-3 border-r border-slate-200 w-36 bg-slate-100">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                  >
                    日期
                    {sortField === 'date' ? (
                      sortAsc ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </button>
                </th>

                {/* 5. 简洁表头: 成员 */}
                <th className="py-3 px-3 border-r border-slate-200 w-28 bg-slate-100">
                  <button
                    onClick={() => handleSort('member')}
                    className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                  >
                    成员
                    {sortField === 'member' ? (
                      sortAsc ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </button>
                </th>

                {/* 5. 简洁表头: 主分类 */}
                <th className="py-3 px-3 border-r border-slate-200 w-32 bg-slate-100">
                  <button
                    onClick={() => handleSort('category')}
                    className="flex items-center gap-1 hover:text-slate-900 transition-colors"
                  >
                    主分类
                    {sortField === 'category' ? (
                      sortAsc ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </button>
                </th>

                {/* 5. 简洁表头: 子分类 */}
                <th className="py-3 px-3 border-r border-slate-200 w-32 bg-slate-100">子分类</th>

                {/* 5. 简洁表头: 备注 */}
                <th className="py-3 px-3 border-r border-slate-200 min-w-[160px] bg-slate-100">
                  备注
                </th>

                {/* 5. 简洁表头: 金额 */}
                <th className="py-3 px-3 text-right bg-slate-100 w-36">
                  <button
                    onClick={() => handleSort('amount')}
                    className="flex items-center gap-1 hover:text-slate-900 transition-colors ml-auto"
                  >
                    金额
                    {sortField === 'amount' ? (
                      sortAsc ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </button>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {processedRows.map((row, idx) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 hover:bg-emerald-100/60'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* 勾选框 */}
                    <td className="py-1 px-3 border-r border-slate-200 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(row.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* 序号 */}
                    <td className="py-1 px-2 border-r border-slate-200 text-center opacity-40 bg-slate-50/50">
                      {idx + 1}
                    </td>

                    {/* 日期 */}
                    <td className="p-0 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD"
                        value={row.date || ''}
                        onChange={(e) => handleCellChange(row.id, 'date', e.target.value)}
                        className="w-full h-full px-3 py-2 bg-transparent text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 rounded-none focus:outline-none font-mono"
                      />
                    </td>

                    {/* 成员 */}
                    <td className="p-0 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.member || ''}
                        onChange={(e) => handleCellChange(row.id, 'member', e.target.value)}
                        className="w-full h-full px-3 py-2 bg-transparent text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 rounded-none focus:outline-none font-bold"
                      />
                    </td>

                    {/* 主分类 */}
                    <td className="p-0 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.category || ''}
                        onChange={(e) => handleCellChange(row.id, 'category', e.target.value)}
                        className="w-full h-full px-3 py-2 bg-transparent text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 rounded-none focus:outline-none"
                      />
                    </td>

                    {/* 子分类 */}
                    <td className="p-0 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.subcategory || ''}
                        onChange={(e) => handleCellChange(row.id, 'subcategory', e.target.value)}
                        className="w-full h-full px-3 py-2 bg-transparent text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 rounded-none focus:outline-none"
                      />
                    </td>

                    {/* 备注 */}
                    <td className="p-0 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="选填"
                        value={row.title || ''}
                        onChange={(e) => handleCellChange(row.id, 'title', e.target.value)}
                        className="w-full h-full px-3 py-2 bg-transparent text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 rounded-none focus:outline-none"
                      />
                    </td>

                    {/* 1 & 5. 金额 (最后一行无独立删除框) */}
                    <td className="p-0">
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) => handleCellChange(row.id, 'amount', e.target.value)}
                        className={`w-full h-full px-3 py-2 bg-transparent text-right font-mono font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500/30 rounded-none focus:outline-none ${
                          row.amount > 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 shadow-2xl text-slate-800 relative">
            <button
              onClick={() => setShowParseModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold flex items-center gap-2 mb-2 font-mono text-slate-900">
              <FileCode className="w-5 h-5 text-indigo-600" />
              解析文本数据增加到数据库
            </h3>
            <p className="text-xs text-slate-500 mb-3 font-mono">
              在下方粘贴文本，点击确认按钮即可自动提交保存：<br />
              <code className="text-emerald-700 bg-slate-100 px-1.5 py-0.5 rounded block my-1">
                工会费	2026-08-13	￥-117.82	扶正	杂项/其它	Default
              </code>
            </p>

            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="在此粘贴包含多行账单的原始文本..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white mb-4"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 font-mono">
              <span className="text-xs text-slate-500 font-mono">
                预计解析: {rawText.trim() ? `${parseRawLedgerText(rawText).length} 条记录` : '0 条'}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleApplyParsedData('append')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? '正在提交...' : '追加到现有数据并保存'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleApplyParsedData('overwrite')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? '正在提交...' : '全部覆盖现有数据并保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
