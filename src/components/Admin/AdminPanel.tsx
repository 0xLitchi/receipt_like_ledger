import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Transaction } from '../../types';
import { storage, type ActivityLog } from '../../utils/storage';
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
  CheckCircle2,
  Database,
  History,
  Globe,
  Zap,
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
  // 菜单 Tab 控制：'data' | 'log'
  const [activeTab, setActiveTab] = useState<'data' | 'log'>('data');

  const [rows, setRows] = useState<Transaction[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Transaction | ''>('');
  const [sortAsc, setSortAsc] = useState(true);

  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 日志列表状态
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // 解析文本导入弹窗状态
  const [showParseModal, setShowParseModal] = useState(false);
  const [rawText, setRawText] = useState('');
  const [parseStep, setParseStep] = useState<'input' | 'preview'>('input');
  const [parsedPreviewList, setParsedPreviewList] = useState<Transaction[]>([]);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始化加载数据
  useEffect(() => {
    if (isOpen) {
      setRows(JSON.parse(JSON.stringify(transactions)));
      setDeletedIds([]);
      setSelectedIds(new Set());
      setStatusMsg(null);
    }
  }, [isOpen, transactions]);

  // 加载日志
  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    const data = await storage.getLogs();
    setLogs(data);
    setLoadingLogs(false);
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'log') {
      loadLogs();
    }
  }, [isOpen, activeTab, loadLogs]);

  // 自动保存防抖提交并更新上次保存时间戳
  const triggerAutoSave = useCallback(
    (currentRows: Transaction[], currentDeleted: string[]) => {
      setSaving(true);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          await onBatchSave(currentRows, currentDeleted);
          setDeletedIds([]);

          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
            now.getMinutes()
          ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          setLastSavedTime(timeStr);

          setStatusMsg({ type: 'success', text: `已自动保存 (${timeStr})` });
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

  // 添加行并自动保存
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

  // 批量删除选中行并自动保存
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

  // 过滤日志列表
  const filteredLogs = useMemo(() => {
    if (!logSearchQuery.trim()) return logs;
    const q = logSearchQuery.toLowerCase().trim();
    return logs.filter(
      (l) =>
        l.details.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        (l.timestamp && l.timestamp.toLowerCase().includes(q))
    );
  }, [logs, logSearchQuery]);

  // 文本解析：点击“保存”按钮进入预览状态
  const handleStartParsePreview = () => {
    if (!rawText.trim()) {
      alert('请先粘贴需要解析的账单文本数据');
      return;
    }

    const parsed = parseRawLedgerText(rawText);
    if (parsed.length === 0) {
      alert('未能成功解析数据，请检查文本格式');
      return;
    }

    setParsedPreviewList(parsed);
    setParseStep('preview');
  };

  // 二次确认导入：保存提交
  const handleConfirmImportParsedData = async () => {
    if (parsedPreviewList.length === 0) return;

    setSaving(true);
    setStatusMsg(null);

    const nextRows = [...parsedPreviewList, ...rows];

    try {
      await onBatchSave(nextRows, deletedIds);
      setRows(nextRows);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLastSavedTime(timeStr);

      setRawText('');
      setParsedPreviewList([]);
      setParseStep('input');
      setShowParseModal(false);

      setStatusMsg({
        type: 'success',
        text: `已成功保存导入 ${parsedPreviewList.length} 条账目数据！(${timeStr})`,
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
    <div className="fixed inset-0 z-50 bg-slate-50 text-slate-800 flex font-mono day-admin-workbench select-none overflow-hidden">
      {/* 2. 侧边栏 (Sidebar Menu): Data 与 Log 两个菜单 */}
      <aside className="w-52 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* 侧栏 Header */}
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-white font-mono tracking-tight">Admin Console</span>
          </div>

          {/* 菜单列表 */}
          <nav className="p-2 space-y-1">
            <button
              onClick={() => setActiveTab('data')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === 'data'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Data (数据维护)</span>
            </button>

            <button
              onClick={() => setActiveTab('log')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === 'log'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Log (变更日志)</span>
            </button>
          </nav>
        </div>

        {/* 侧栏底部：返回小票按钮 */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <span>返回小票</span>
          </button>
        </div>
      </aside>

      {/* 右侧主工作区 */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {activeTab === 'data' ? (
          // ==================== TAB 1: DATA 数据维护工作台 ====================
          <>
            {/* Header 导航工具栏 */}
            <header className="px-6 py-3.5 bg-white border-b border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold font-mono tracking-tight text-slate-900 flex items-center gap-2">
                  Data 维护工作台
                </h1>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                  <span>共 <strong className="text-slate-800">{rows.length}</strong> 行</span>
                  <span>•</span>
                  {selectedIds.size > 0 && (
                    <span className="text-emerald-700 font-bold">已选 {selectedIds.size} 行</span>
                  )}
                  {/* 1. 自动保存状态指示上次保存时间 */}
                  <span className="ml-1 text-[11px] flex items-center gap-1 text-slate-500 font-mono">
                    {saving ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                        <span className="text-amber-700 font-bold">正在自动保存...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-medium">
                          {lastSavedTime ? `已自动保存 (${lastSavedTime})` : '已自动保存'}
                        </span>
                      </>
                    )}
                  </span>
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

              {/* 右侧：功能按钮 */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setParseStep('input');
                    setShowParseModal(true);
                  }}
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

            {/* 白天主题表格区 */}
            <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-50">
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase text-[11px] border-b border-slate-200 sticky top-0 z-10 font-bold tracking-wider">
                      <th className="py-3 px-3 border-r border-slate-200 w-12 text-center bg-slate-100">
                        <input
                          type="checkbox"
                          checked={isAllFilteredSelected}
                          onChange={() => handleToggleSelectAll(processedRows)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 bg-white cursor-pointer"
                        />
                      </th>

                      <th className="py-3 px-2 border-r border-slate-200 w-12 text-center opacity-60 bg-slate-100">
                        #
                      </th>

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

                      <th className="py-3 px-3 border-r border-slate-200 w-32 bg-slate-100">子分类</th>

                      <th className="py-3 px-3 border-r border-slate-200 min-w-[160px] bg-slate-100">
                        备注
                      </th>

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
                          <td className="py-1 px-3 border-r border-slate-200 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectRow(row.id)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>

                          <td className="py-1 px-2 border-r border-slate-200 text-center opacity-40 bg-slate-50/50">
                            {idx + 1}
                          </td>

                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              placeholder="YYYY-MM-DD"
                              value={row.date || ''}
                              onChange={(e) => handleCellChange(row.id, 'date', e.target.value)}
                              className="w-full h-full px-3 py-2 bg-transparent text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 rounded-none focus:outline-none font-mono"
                            />
                          </td>

                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.member || ''}
                              onChange={(e) => handleCellChange(row.id, 'member', e.target.value)}
                              className="w-full h-full px-3 py-2 bg-transparent text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 rounded-none focus:outline-none font-bold"
                            />
                          </td>

                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.category || ''}
                              onChange={(e) => handleCellChange(row.id, 'category', e.target.value)}
                              className="w-full h-full px-3 py-2 bg-transparent text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 rounded-none focus:outline-none"
                            />
                          </td>

                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              value={row.subcategory || ''}
                              onChange={(e) => handleCellChange(row.id, 'subcategory', e.target.value)}
                              className="w-full h-full px-3 py-2 bg-transparent text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 rounded-none focus:outline-none"
                            />
                          </td>

                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              placeholder="选填"
                              value={row.title || ''}
                              onChange={(e) => handleCellChange(row.id, 'title', e.target.value)}
                              className="w-full h-full px-3 py-2 bg-transparent text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/30 rounded-none focus:outline-none"
                            />
                          </td>

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
          </>
        ) : (
          // ==================== TAB 2: LOG 变更日志视图 ====================
          <>
            {/* Header 导航 */}
            <header className="px-6 py-3.5 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold font-mono tracking-tight text-slate-900 flex items-center gap-2">
                  Log 变更日志审计
                </h1>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  记录数据的修改时间与修改来源（区分网页修改 vs API 修改）
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* 搜索过滤 */}
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="搜索日志详情..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
                  />
                </div>

                <button
                  onClick={loadLogs}
                  disabled={loadingLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold transition-colors border border-slate-300 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                  刷新日志
                </button>
              </div>
            </header>

            {/* 日志表格内容区 */}
            <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-50">
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase text-[11px] border-b border-slate-200 sticky top-0 z-10 font-bold tracking-wider">
                      <th className="py-3 px-4 border-r border-slate-200 w-44">变更时间</th>
                      <th className="py-3 px-4 border-r border-slate-200 w-32">修改来源</th>
                      <th className="py-3 px-4 border-r border-slate-200 w-28">操作类型</th>
                      <th className="py-3 px-4">详细变更记录</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingLogs ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400 font-mono">
                          正在加载活动日志...
                        </td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400 font-mono">
                          暂无变更日志记录
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => {
                        const dateStr = log.created_at || log.timestamp || '';
                        const formattedTime = dateStr.length >= 19 ? dateStr.substring(0, 19).replace('T', ' ') : dateStr;

                        const isWeb = log.source === 'web';
                        const isApi = log.source === 'api';

                        return (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-4 border-r border-slate-200 font-mono text-slate-600">
                              {formattedTime}
                            </td>

                            <td className="py-2.5 px-4 border-r border-slate-200">
                              {isApi ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  <Zap className="w-3 h-3 text-purple-600" />
                                  API 修改
                                </span>
                              ) : isWeb ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  <Globe className="w-3 h-3 text-blue-600" />
                                  网页修改
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <FileCode className="w-3 h-3 text-emerald-600" />
                                  文本解析
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-4 border-r border-slate-200 font-bold">
                              {log.action === 'create' ? (
                                <span className="text-emerald-700 font-bold">新增</span>
                              ) : log.action === 'update' ? (
                                <span className="text-amber-700 font-bold">更新</span>
                              ) : log.action === 'delete' ? (
                                <span className="text-rose-700 font-bold">删除</span>
                              ) : (
                                <span className="text-slate-700 font-bold">批量同步</span>
                              )}
                            </td>

                            <td className="py-2.5 px-4 text-slate-800 font-mono">
                              {log.details}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 解析文本导入弹窗 */}
      {showParseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl p-6 shadow-2xl text-slate-800 relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setShowParseModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {parseStep === 'input' ? (
              <>
                <h3 className="text-base font-bold flex items-center gap-2 mb-2 font-mono text-slate-900">
                  <FileCode className="w-5 h-5 text-indigo-600" />
                  解析文本数据导入
                </h3>
                <p className="text-xs text-slate-500 mb-3 font-mono">
                  在此粘贴账单文本，点击“保存”查看解析预览：<br />
                  <code className="text-emerald-700 bg-slate-100 px-1.5 py-0.5 rounded block my-1">
                    工会费	2026-08-13	￥-117.82	扶正	杂项/其它	Default
                  </code>
                </p>

                <textarea
                  rows={9}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="在此粘贴包含多行账单的原始文本..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white mb-4"
                />

                <div className="flex items-center justify-between pt-3 border-t border-slate-200 font-mono">
                  <span className="text-xs text-slate-500 font-mono">
                    预计解析: {rawText.trim() ? `${parseRawLedgerText(rawText).length} 条记录` : '0 条'}
                  </span>

                  <button
                    type="button"
                    onClick={handleStartParsePreview}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <span>保存</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold flex items-center gap-2 font-mono text-slate-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    解析结果预览二次确认
                  </h3>
                  <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-bold">
                    成功解析出 {parsedPreviewList.length} 条记录
                  </span>
                </div>

                <p className="text-xs text-slate-500 mb-3 font-mono">
                  请检查以下解析出的账目数据，确认无误后点击“确认保存导入”：
                </p>

                <div className="flex-1 overflow-auto border border-slate-200 rounded-xl mb-4 max-h-[340px]">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 uppercase text-[11px] border-b border-slate-200 font-bold sticky top-0">
                        <th className="py-2.5 px-3 border-r border-slate-200">日期</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">成员</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">分类</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">备注</th>
                        <th className="py-2.5 px-3 text-right">金额</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {parsedPreviewList.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 border-r border-slate-200 font-mono text-slate-800">
                            {item.date}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900">
                            {item.member}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                            {item.category}{item.subcategory ? `/${item.subcategory}` : ''}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-slate-700 truncate max-w-[150px]">
                            {item.title || '-'}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-bold ${
                              item.amount > 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            ￥{item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200 font-mono">
                  <button
                    type="button"
                    onClick={() => setParseStep('input')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer"
                  >
                    返回修改
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleConfirmImportParsedData}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold shadow-md cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{saving ? '正在提交...' : '确认保存导入'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
