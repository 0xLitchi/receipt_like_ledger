import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ActivityLog, ApiRequestLog, ThemeStyle, Transaction } from '../../types';
import { queryClient } from '../../lib/query-client';
import { queryKeys } from '../../lib/queries';
import { ApiError, fetchActivityLogs, fetchApiLogs, fetchTransactions } from '../../lib/api-client';
import { PlatinumWindow } from '../Platinum/PlatinumChrome';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onRefresh?: () => Promise<void>;
  onBatchSave: (items: Transaction[], deletedIds: string[]) => Promise<void>;
  onLogout: () => void;
  themeStyle: ThemeStyle;
  onThemeStyleChange: (style: ThemeStyle) => void;
}

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

const describeLogError = (e: unknown): string => {
  if (e instanceof ApiError) {
    if (e.status === 401) return '登录状态已失效，请退出后台重新登录后再查看';
    return e.message;
  }
  return e instanceof Error ? e.message : '未知错误';
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  transactions,
  onRefresh,
  onBatchSave,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'data' | 'log' | 'reqlog' | 'general'>('data');

  const [refreshingData, setRefreshingData] = useState(false);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Transaction | ''>('');
  const [sortAsc, setSortAsc] = useState(true);

  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showSavePreviewModal, setShowSavePreviewModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const [apiLogs, setApiLogs] = useState<ApiRequestLog[]>([]);
  const [loadingApiLogs, setLoadingApiLogs] = useState(false);
  const [apiLogsError, setApiLogsError] = useState<string | null>(null);
  const [apiLogSearchQuery, setApiLogSearchQuery] = useState('');

  const [showParseModal, setShowParseModal] = useState(false);
  const [rawText, setRawText] = useState('');
  const [parseStep, setParseStep] = useState<'input' | 'preview'>('input');
  const [parsedPreviewList, setParsedPreviewList] = useState<Transaction[]>([]);

  const originalMap = useMemo(() => {
    const map = new Map<string, Transaction>();
    transactions.forEach((t) => map.set(t.id, t));
    return map;
  }, [transactions]);

  useEffect(() => {
    if (isOpen) {
      setRows(JSON.parse(JSON.stringify(transactions)));
      setDeletedIds([]);
      setSelectedIds(new Set());
      setStatusMsg(null);
    }
  }, [isOpen, transactions]);

  const handleRefreshData = async () => {
    if (refreshingData) return;
    setRefreshingData(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        const res = await fetchTransactions();
        setRows(JSON.parse(JSON.stringify(res.data)));
        setDeletedIds([]);
        setSelectedIds(new Set());
      }
    } finally {
      setRefreshingData(false);
    }
  };

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    setLogsError(null);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.activityLogs,
        queryFn: fetchActivityLogs,
      });
      setLogs(data);
    } catch (e) {
      setLogs([]);
      setLogsError(describeLogError(e));
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const loadApiLogs = useCallback(async () => {
    setLoadingApiLogs(true);
    setApiLogsError(null);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.apiLogs,
        queryFn: fetchApiLogs,
      });
      setApiLogs(data);
    } catch (e) {
      setApiLogs([]);
      setApiLogsError(describeLogError(e));
    } finally {
      setLoadingApiLogs(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'log') {
      void loadLogs();
    } else if (isOpen && activeTab === 'reqlog') {
      void loadApiLogs();
    }
  }, [isOpen, activeTab, loadLogs, loadApiLogs]);

  const getRowChangeStatus = useCallback(
    (row: Transaction): 'added' | 'modified' | 'unchanged' => {
      const isNew =
        !row.id || row.id.startsWith('new_') || row.id.startsWith('parse_') || !originalMap.has(row.id);
      if (isNew) return 'added';

      const orig = originalMap.get(row.id);
      if (!orig) return 'added';

      const isModified =
        (row.date || '') !== (orig.date || '') ||
        (row.member || '') !== (orig.member || '') ||
        (row.category || '') !== (orig.category || '') ||
        (row.subcategory || '') !== (orig.subcategory || '') ||
        (row.title || '') !== (orig.title || '') ||
        Number(row.amount) !== Number(orig.amount);

      return isModified ? 'modified' : 'unchanged';
    },
    [originalMap]
  );

  const pendingChanges = useMemo(() => {
    const addedList: Transaction[] = [];
    const modifiedList: { current: Transaction; original: Transaction }[] = [];

    rows.forEach((r) => {
      const status = getRowChangeStatus(r);
      if (status === 'added') addedList.push(r);
      else if (status === 'modified') {
        modifiedList.push({ current: r, original: originalMap.get(r.id)! });
      }
    });

    const deletedList: Transaction[] = deletedIds
      .map((id) => originalMap.get(id))
      .filter(Boolean) as Transaction[];

    return {
      added: addedList,
      modified: modifiedList,
      deleted: deletedList,
      totalCount: addedList.length + modifiedList.length + deletedList.length,
    };
  }, [rows, deletedIds, originalMap, getRowChangeStatus]);

  const handleCellChange = useCallback((id: string, field: keyof Transaction, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          [field]: field === 'amount' ? (value === '' ? 0 : parseFloat(value) || 0) : value,
        };
      })
    );
  }, []);

  const handleAddRow = () => {
    const newId = `new_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRow: Transaction = {
      id: newId,
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

  const handleToggleSelectAll = (filteredRows: Transaction[]) => {
    const allFilteredIds = filteredRows.map((r) => r.id);
    const isAllSelected = allFilteredIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllSelected) allFilteredIds.forEach((id) => next.delete(id));
      else allFilteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const toDeleteDbIds = Array.from(selectedIds).filter(
      (id) => id && !id.startsWith('new_') && !id.startsWith('parse_') && originalMap.has(id)
    );
    setDeletedIds(Array.from(new Set([...deletedIds, ...toDeleteDbIds])));
    setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    setSelectedIds(new Set());
  };

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
      result.sort((a, b) => {
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

  const filteredApiLogs = useMemo(() => {
    if (!apiLogSearchQuery.trim()) return apiLogs;
    const q = apiLogSearchQuery.toLowerCase().trim();
    return apiLogs.filter(
      (l) =>
        l.method.toLowerCase().includes(q) ||
        l.endpoint.toLowerCase().includes(q) ||
        l.ip_address.toLowerCase().includes(q) ||
        l.payload_summary.toLowerCase().includes(q) ||
        l.user_agent.toLowerCase().includes(q) ||
        String(l.status_code).includes(q)
    );
  }, [apiLogs, apiLogSearchQuery]);

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

  const handleConfirmImportParsedData = () => {
    if (parsedPreviewList.length === 0) return;
    setRows((prev) => [...parsedPreviewList, ...prev]);
    setRawText('');
    setParsedPreviewList([]);
    setParseStep('input');
    setShowParseModal(false);
    setStatusMsg({
      type: 'success',
      text: `已导入 ${parsedPreviewList.length} 条记录至编辑区，请点击“保存变动”提交。`,
    });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleConfirmSaveAllChanges = async () => {
    if (pendingChanges.totalCount === 0) {
      setShowSavePreviewModal(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const changedItems: Transaction[] = [
        ...pendingChanges.added,
        ...pendingChanges.modified.map((m) => m.current),
      ];
      await onBatchSave(changedItems, deletedIds);
      setDeletedIds([]);
      setShowSavePreviewModal(false);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLastSavedTime(timeStr);
      setStatusMsg({
        type: 'success',
        text: `保存成功，共提交 ${pendingChanges.totalCount} 项变动 (${timeStr})`,
      });
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络或凭证错误';
      setSaveError(message);
      setStatusMsg({ type: 'error', text: '保存失败: ' + message });
    } finally {
      setSaving(false);
    }
  };

  const handleReloadAfterFailure = async () => {
    setSaveError(null);
    await handleRefreshData();
  };

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

    const blob = new Blob(['﻿' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt_ledger_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!isOpen) return null;

  const isAllFilteredSelected =
    processedRows.length > 0 && processedRows.every((r) => selectedIds.has(r.id));

  const sortIndicator = (field: keyof Transaction) => {
    if (sortField !== field) return '';
    return sortAsc ? ' ▲' : ' ▼';
  };

  return (
    <div className="pt-desk" style={{ maxWidth: 1120 }}>
      <PlatinumWindow
        title="Admin Console · 账本管理后台"
        onClose={onClose}
        closeTitle="返回账本"
      >
        {/* Top Navigation Tab Strip */}
        <div className="pt-strip">
          <button
            type="button"
            className={`pt-btn tab${activeTab === 'data' ? ' on' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            Data (数据维护)
          </button>
          <button
            type="button"
            className={`pt-btn tab${activeTab === 'log' ? ' on' : ''}`}
            onClick={() => setActiveTab('log')}
          >
            Log (变更日志)
          </button>
          <button
            type="button"
            className={`pt-btn tab${activeTab === 'reqlog' ? ' on' : ''}`}
            onClick={() => setActiveTab('reqlog')}
          >
            Req Log (请求日志)
          </button>
          <button
            type="button"
            className={`pt-btn tab${activeTab === 'general' ? ' on' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General (通用设置)
          </button>

          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
            <button type="button" className="pt-btn tab" onClick={onClose}>
              ← 返回账本
            </button>
            <button type="button" className="pt-btn tab danger" onClick={onLogout}>
              退出登录
            </button>
          </span>
        </div>

        {/* Status Banner */}
        {statusMsg && (
          <div
            style={{
              padding: '6px 12px',
              borderBottom: '1px solid #262626',
              background: statusMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: statusMsg.type === 'success' ? '#166534' : '#991b1b',
              fontSize: 11,
              fontWeight: 'bold',
            }}
          >
            {statusMsg.text}
          </div>
        )}

        {/* ==================== TAB 1: DATA ==================== */}
        {activeTab === 'data' && (
          <>
            <div className="pt-strip" style={{ background: '#eee' }}>
              <input
                type="search"
                className="pt-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="筛选日期 / 备注 / 成员 / 分类 / 金额…"
                style={{ width: 240, maxWidth: '100%' }}
              />
              <button type="button" className="pt-btn tab" onClick={handleAddRow}>
                + 新增行
              </button>
              <button
                type="button"
                className="pt-btn tab"
                onClick={() => {
                  setParseStep('input');
                  setShowParseModal(true);
                }}
              >
                文本导入
              </button>
              <button type="button" className="pt-btn tab" onClick={handleExportCSV}>
                导出 CSV
              </button>
              <button
                type="button"
                className="pt-btn tab"
                disabled={refreshingData}
                onClick={() => void handleRefreshData()}
              >
                {refreshingData ? '刷新中…' : '刷新'}
              </button>

              {selectedIds.size > 0 && (
                <button
                  type="button"
                  className="pt-btn tab danger"
                  onClick={handleBulkDeleteSelected}
                >
                  删除选中 ({selectedIds.size})
                </button>
              )}

              <button
                type="button"
                className={`pt-btn tab${pendingChanges.totalCount > 0 ? ' primary' : ''}`}
                style={{ marginLeft: 'auto' }}
                disabled={pendingChanges.totalCount === 0}
                onClick={() => {
                  setSaveError(null);
                  setShowSavePreviewModal(true);
                }}
              >
                保存变动 ({pendingChanges.totalCount})
              </button>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '68vh', overflowY: 'auto' }}>
              <table className="pt-table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{ width: 28, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={() => handleToggleSelectAll(processedRows)}
                        aria-label="全选"
                      />
                    </th>
                    <th style={{ width: 42, textAlign: 'center' }}>状态</th>
                    <th style={{ width: 108, cursor: 'pointer' }} onClick={() => handleSort('date')}>
                      日期{sortIndicator('date')}
                    </th>
                    <th style={{ width: 84, cursor: 'pointer' }} onClick={() => handleSort('member')}>
                      成员{sortIndicator('member')}
                    </th>
                    <th style={{ width: 92, cursor: 'pointer' }} onClick={() => handleSort('category')}>
                      主分类{sortIndicator('category')}
                    </th>
                    <th style={{ width: 92, cursor: 'pointer' }} onClick={() => handleSort('subcategory')}>
                      子分类{sortIndicator('subcategory')}
                    </th>
                    <th style={{ minWidth: 160, cursor: 'pointer' }} onClick={() => handleSort('title')}>
                      备注{sortIndicator('title')}
                    </th>
                    <th style={{ width: 104, cursor: 'pointer' }} onClick={() => handleSort('amount')}>
                      金额{sortIndicator('amount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#666' }}>
                        暂无匹配的交易记录
                      </td>
                    </tr>
                  ) : (
                    processedRows.map((row) => {
                      const status = getRowChangeStatus(row);
                      const bg =
                        status === 'added'
                          ? '#dcfce7'
                          : status === 'modified'
                          ? '#fef9c3'
                          : selectedIds.has(row.id)
                          ? '#e0e7ff'
                          : undefined;

                      return (
                        <tr key={row.id} style={{ background: bg }}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(row.id)}
                              onChange={() => handleToggleSelectRow(row.id)}
                            />
                          </td>
                          <td
                            style={{
                              textAlign: 'center',
                              fontSize: 10,
                              fontFamily: 'var(--font-mono)',
                              color:
                                status === 'added'
                                  ? '#166534'
                                  : status === 'modified'
                                  ? '#854d0e'
                                  : '#777',
                            }}
                          >
                            {status === 'added' ? 'NEW' : status === 'modified' ? 'MOD' : '—'}
                          </td>
                          <td>
                            <input
                              type="text"
                              className="pt-input"
                              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                              value={row.date}
                              onChange={(e) => handleCellChange(row.id, 'date', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="pt-input"
                              style={{ width: '100%' }}
                              value={row.member}
                              onChange={(e) => handleCellChange(row.id, 'member', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="pt-input"
                              style={{ width: '100%' }}
                              value={row.category}
                              onChange={(e) => handleCellChange(row.id, 'category', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="pt-input"
                              style={{ width: '100%' }}
                              value={row.subcategory}
                              onChange={(e) => handleCellChange(row.id, 'subcategory', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="pt-input"
                              style={{ width: '100%' }}
                              value={row.title}
                              onChange={(e) => handleCellChange(row.id, 'title', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="pt-input"
                              style={{
                                width: '100%',
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)',
                                color: row.amount >= 0 ? 'var(--income)' : '#262626',
                              }}
                              value={row.amount}
                              onChange={(e) => handleCellChange(row.id, 'amount', e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-statusbar">
              <span>
                共 {processedRows.length} / {rows.length} 行 · 待新增 {pendingChanges.added.length} ·
                待修改 {pendingChanges.modified.length} · 待删除 {pendingChanges.deleted.length}
              </span>
              <span>{lastSavedTime ? `上次保存 ${lastSavedTime}` : '就绪'}</span>
            </div>
          </>
        )}

        {/* ==================== TAB 2: ACTIVITY LOGS ==================== */}
        {activeTab === 'log' && (
          <>
            <div className="pt-strip" style={{ background: '#eee' }}>
              <input
                type="search"
                className="pt-input"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="筛选动作 / 来源 / 详情…"
                style={{ width: 240, maxWidth: '100%' }}
              />
              <button
                type="button"
                className="pt-btn tab"
                disabled={loadingLogs}
                onClick={() => void loadLogs()}
              >
                {loadingLogs ? '加载中…' : '刷新日志'}
              </button>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555' }}>
                共 {filteredLogs.length} 条
              </span>
            </div>

            {logsError ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ color: '#991b1b', fontWeight: 'bold', margin: '0 0 8px' }}>
                  日志加载失败: {logsError}
                </p>
                <button type="button" className="pt-btn" onClick={() => void loadLogs()}>
                  重试
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '68vh', overflowY: 'auto' }}>
                <table className="pt-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ width: 150 }}>时间</th>
                      <th style={{ width: 70 }}>来源</th>
                      <th style={{ width: 90 }}>动作</th>
                      <th>详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingLogs ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#666' }}>
                          正在加载变更日志…
                        </td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#666' }}>
                          暂无记录
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((l) => (
                        <tr key={l.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {l.timestamp}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.source}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 'bold' }}>
                            {l.action}
                          </td>
                          <td style={{ fontSize: 11, wordBreak: 'break-all' }}>{l.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-statusbar">
              <span>审计日志（最近 200 条）</span>
              <span>{filteredLogs.length} 条</span>
            </div>
          </>
        )}

        {/* ==================== TAB 3: API REQ LOGS ==================== */}
        {activeTab === 'reqlog' && (
          <>
            <div className="pt-strip" style={{ background: '#eee' }}>
              <input
                type="search"
                className="pt-input"
                value={apiLogSearchQuery}
                onChange={(e) => setApiLogSearchQuery(e.target.value)}
                placeholder="筛选方法 / 路径 / 状态码 / IP…"
                style={{ width: 240, maxWidth: '100%' }}
              />
              <button
                type="button"
                className="pt-btn tab"
                disabled={loadingApiLogs}
                onClick={() => void loadApiLogs()}
              >
                {loadingApiLogs ? '加载中…' : '刷新请求日志'}
              </button>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555' }}>
                共 {filteredApiLogs.length} 条
              </span>
            </div>

            {apiLogsError ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ color: '#991b1b', fontWeight: 'bold', margin: '0 0 8px' }}>
                  请求日志加载失败: {apiLogsError}
                </p>
                <button type="button" className="pt-btn" onClick={() => void loadApiLogs()}>
                  重试
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '68vh', overflowY: 'auto' }}>
                <table className="pt-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ width: 145 }}>时间</th>
                      <th style={{ width: 64 }}>方法</th>
                      <th style={{ width: 60 }}>状态</th>
                      <th style={{ width: 140 }}>路径</th>
                      <th style={{ width: 110 }}>IP</th>
                      <th style={{ width: 64 }}>耗时</th>
                      <th>摘要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingApiLogs ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#666' }}>
                          正在加载请求日志…
                        </td>
                      </tr>
                    ) : filteredApiLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#666' }}>
                          暂无记录
                        </td>
                      </tr>
                    ) : (
                      filteredApiLogs.map((l) => (
                        <tr key={l.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {l.timestamp}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 'bold' }}>
                            {l.method}
                          </td>
                          <td
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              fontWeight: 'bold',
                              color: l.status_code >= 400 ? '#991b1b' : '#166534',
                            }}
                          >
                            {l.status_code}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.endpoint}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.ip_address}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.execution_ms}ms</td>
                          <td style={{ fontSize: 11, wordBreak: 'break-all' }}>{l.payload_summary}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-statusbar">
              <span>API 请求审计（最近 200 条）</span>
              <span>{filteredApiLogs.length} 条</span>
            </div>
          </>
        )}

        {/* ==================== TAB 4: GENERAL ==================== */}
        {activeTab === 'general' && (
          <div style={{ padding: 16 }}>
            <table className="pt-table" style={{ maxWidth: 640 }}>
              <tbody>
                <tr>
                  <th style={{ width: 160 }}>界面风格</th>
                  <td>Platinum Desktop (v2ex / exe.v2core.com 风格重构版)</td>
                </tr>
                <tr>
                  <th>当前数据量</th>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{transactions.length} 条交易记录</td>
                </tr>
                <tr>
                  <th>快捷键</th>
                  <td>
                    在首页按 <code>.</code> 键快速打开管理后台
                  </td>
                </tr>
                <tr>
                  <th>会话管理</th>
                  <td>
                    <button type="button" className="pt-btn danger" onClick={onLogout}>
                      注销当前管理员会话
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </PlatinumWindow>

      {/* ── Modal 1: Save Preview Confirmation ── */}
      {showSavePreviewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ width: '100%', maxWidth: 520 }}>
            <PlatinumWindow
              title="确认保存变动 · Confirm Changes"
              onClose={() => !saving && setShowSavePreviewModal(false)}
            >
              <div style={{ padding: '12px 14px', maxHeight: '60vh', overflowY: 'auto' }}>
                <p style={{ margin: '0 0 10px' }}>
                  即将提交 <b>{pendingChanges.totalCount}</b> 项变动：新增{' '}
                  <b>{pendingChanges.added.length}</b>、修改 <b>{pendingChanges.modified.length}</b>、
                  删除 <b>{pendingChanges.deleted.length}</b>。
                </p>

                {saveError && (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '8px 10px',
                      background: '#fee2e2',
                      border: '1px solid #991b1b',
                      color: '#991b1b',
                      fontSize: 11,
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>保存失败: {saveError}</div>
                    <button
                      type="button"
                      className="pt-btn tab"
                      onClick={() => void handleReloadAfterFailure()}
                    >
                      从服务端重新加载
                    </button>
                  </div>
                )}

                {pendingChanges.added.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 11, color: '#166534' }}>
                      + 新增 ({pendingChanges.added.length})
                    </div>
                    <ul style={{ margin: '4px 0', paddingLeft: 18, fontSize: 11 }}>
                      {pendingChanges.added.slice(0, 10).map((it) => (
                        <li key={it.id}>
                          {it.date} · {it.member} · {it.category} · {it.title || '无备注'} ({it.amount})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {pendingChanges.modified.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 11, color: '#854d0e' }}>
                      ~ 修改 ({pendingChanges.modified.length})
                    </div>
                    <ul style={{ margin: '4px 0', paddingLeft: 18, fontSize: 11 }}>
                      {pendingChanges.modified.slice(0, 10).map(({ current }) => (
                        <li key={current.id}>
                          {current.date} · {current.member} · {current.category} ·{' '}
                          {current.title || '无备注'} ({current.amount})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {pendingChanges.deleted.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: 11, color: '#991b1b' }}>
                      − 删除 ({pendingChanges.deleted.length})
                    </div>
                    <ul style={{ margin: '4px 0', paddingLeft: 18, fontSize: 11 }}>
                      {pendingChanges.deleted.slice(0, 10).map((it) => (
                        <li key={it.id}>
                          {it.date} · {it.member} · {it.category} · {it.title || '无备注'} ({it.amount})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pt-statusbar" style={{ padding: '8px 12px', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="pt-btn"
                  disabled={saving}
                  onClick={() => setShowSavePreviewModal(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="pt-btn primary"
                  disabled={saving}
                  onClick={() => void handleConfirmSaveAllChanges()}
                >
                  {saving ? '提交中…' : '确认提交'}
                </button>
              </div>
            </PlatinumWindow>
          </div>
        </div>
      )}

      {/* ── Modal 2: Raw Text Import ── */}
      {showParseModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ width: '100%', maxWidth: 640 }}>
            <PlatinumWindow
              title="原始文本批量导入 · Import Text"
              onClose={() => setShowParseModal(false)}
            >
              <div style={{ padding: '12px 14px' }}>
                {parseStep === 'input' ? (
                  <>
                    <p style={{ margin: '0 0 8px', fontSize: 11, color: '#444' }}>
                      每行一条，支持 Tab 或双空格分隔：
                      <code>备注  日期(YYYY-MM-DD)  金额  成员  主分类/子分类  账本</code>
                    </p>
                    <textarea
                      className="pt-input"
                      rows={10}
                      style={{ width: '100%' }}
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="示例：午餐	2026-11-19	-38.5	荔枝	餐饮/午饭	Default"
                    />
                  </>
                ) : (
                  <>
                    <p style={{ margin: '0 0 8px', fontSize: 11 }}>
                      解析成功 <b>{parsedPreviewList.length}</b> 条，确认后将追加到编辑区顶部：
                    </p>
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                      <table className="pt-table">
                        <thead>
                          <tr>
                            <th>日期</th>
                            <th>成员</th>
                            <th>分类</th>
                            <th>备注</th>
                            <th>金额</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedPreviewList.map((it) => (
                            <tr key={it.id}>
                              <td style={{ fontFamily: 'var(--font-mono)' }}>{it.date}</td>
                              <td>{it.member}</td>
                              <td>
                                {it.subcategory ? `${it.category}/${it.subcategory}` : it.category}
                              </td>
                              <td>{it.title || '—'}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                {it.amount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <div className="pt-statusbar" style={{ padding: '8px 12px', justifyContent: 'flex-end', gap: 8 }}>
                {parseStep === 'preview' && (
                  <button
                    type="button"
                    className="pt-btn"
                    onClick={() => setParseStep('input')}
                  >
                    返回修改
                  </button>
                )}
                <button
                  type="button"
                  className="pt-btn"
                  onClick={() => setShowParseModal(false)}
                >
                  取消
                </button>
                {parseStep === 'input' ? (
                  <button
                    type="button"
                    className="pt-btn primary"
                    onClick={handleStartParsePreview}
                  >
                    解析预览
                  </button>
                ) : (
                  <button
                    type="button"
                    className="pt-btn primary"
                    onClick={handleConfirmImportParsedData}
                  >
                    确认导入 ({parsedPreviewList.length})
                  </button>
                )}
              </div>
            </PlatinumWindow>
          </div>
        </div>
      )}
    </div>
  );
};
