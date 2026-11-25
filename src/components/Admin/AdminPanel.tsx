import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ActivityLog, ApiRequestLog, Transaction, TransactionKind } from '../../types';
import { queryClient } from '../../lib/query-client';
import { queryKeys } from '../../lib/queries';
import { ApiError, fetchActivityLogs, fetchApiLogs, fetchTransactions } from '../../lib/api-client';
import {
  buildAvailableLedgers,
  isTransferTransaction,
  normalizeLedgerName,
} from '../../features/ledger/use-ledger';
import {
  ADMIN_TX_KIND_LABELS,
  applyAdminTxKind,
  applyAmountForKind,
  deriveAdminTxKind,
  findInvalidTransfer,
  type AdminTxKind,
} from '../../features/admin/transaction-form';
import { parseRawLedgerText } from '../../utils/parser';
import { PixelDot, PlatinumWindow } from '../Platinum/PlatinumChrome';
import { AddTransactionModal } from './AddTransactionModal';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onRefresh?: () => Promise<void>;
  onBatchSave: (items: Transaction[], deletedIds: string[]) => Promise<void>;
  onLogout: () => void;
}

const CREATE_LEDGER_OPTION = '__CREATE_LEDGER__';

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
  const [sqlToast, setSqlToast] = useState<{ title: string; detail: string } | null>(null);
  const sqlToastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (sqlToastTimerRef.current !== null) {
        window.clearTimeout(sqlToastTimerRef.current);
      }
    };
  }, []);

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

  const [showAddModal, setShowAddModal] = useState(false);
  const [rowKindOverrides, setRowKindOverrides] = useState<Record<string, AdminTxKind>>({});
  const [customLedgers, setCustomLedgers] = useState<string[]>([]);
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
      setRowKindOverrides({});
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

      const origType: TransactionKind = isTransferTransaction(orig) ? 'transfer' : 'normal';
      const rowType: TransactionKind = isTransferTransaction(row) ? 'transfer' : 'normal';

      const isModified =
        (row.date || '') !== (orig.date || '') ||
        (row.member || '') !== (orig.member || '') ||
        (row.category || '') !== (orig.category || '') ||
        (row.subcategory || '') !== (orig.subcategory || '') ||
        (row.title || '') !== (orig.title || '') ||
        (row.ledger || '') !== (orig.ledger || '') ||
        rowType !== origType ||
        (row.to_ledger || '') !== (orig.to_ledger || '') ||
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

  const availableLedgers = useMemo(() => {
    const base = buildAvailableLedgers(rows);
    if (customLedgers.length === 0) return base;
    const extras = new Set(base.filter((l) => l !== 'Default'));
    customLedgers.forEach((l) => {
      const trimmed = l.trim();
      if (trimmed && trimmed !== 'Default') extras.add(trimmed);
    });
    return ['Default', ...Array.from(extras).sort((a, b) => a.localeCompare(b, 'zh-CN'))];
  }, [rows, customLedgers]);

  const handleKindChange = useCallback((id: string, nextKind: AdminTxKind) => {
    setRowKindOverrides((prev) => ({ ...prev, [id]: nextKind }));
    setRows((prev) => prev.map((r) => (r.id === id ? applyAdminTxKind(r, nextKind) : r)));
  }, []);

  const handleCellChange = useCallback(
    (id: string, field: keyof Transaction, value: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          if (field === 'amount') {
            const kind = deriveAdminTxKind(r, rowKindOverrides[id]);
            return {
              ...r,
              amount: applyAmountForKind(kind, value),
            };
          }
          return {
            ...r,
            [field]: value,
          };
        })
      );
    },
    [rowKindOverrides]
  );

  const handleLedgerSelectChange = useCallback(
    (id: string, field: 'ledger' | 'to_ledger', nextVal: string) => {
      if (nextVal === CREATE_LEDGER_OPTION) {
        const created = window.prompt('请输入新账本名称：')?.trim();
        if (!created) return;
        setCustomLedgers((prev) => (prev.includes(created) ? prev : [...prev, created]));
        handleCellChange(id, field, created);
        return;
      }
      handleCellChange(id, field, nextVal);
    },
    [handleCellChange]
  );

  const handleAddTransactionFromModal = useCallback((newRow: Transaction) => {
    const kind = deriveAdminTxKind(newRow);
    setRowKindOverrides((prev) => ({ ...prev, [newRow.id]: kind }));
    setRows((prev) => [newRow, ...prev]);
    setStatusMsg({
      type: 'success',
      text: `已新增 1 条${ADMIN_TX_KIND_LABELS[kind]}记录至待保存区，请点击“保存变动”提交。`,
    });
  }, []);

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
      result = result.filter((r) => {
        const kind = deriveAdminTxKind(r, rowKindOverrides[r.id]);
        const kindText = `${ADMIN_TX_KIND_LABELS[kind]} ${kind}`;
        return (
          (r.title || '').toLowerCase().includes(q) ||
          (r.member || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q) ||
          (r.subcategory || '').toLowerCase().includes(q) ||
          (r.date || '').toLowerCase().includes(q) ||
          (r.ledger || '').toLowerCase().includes(q) ||
          (r.to_ledger || '').toLowerCase().includes(q) ||
          kindText.includes(q) ||
          String(r.amount).includes(q)
        );
      });
    }

    if (sortField) {
      result.sort((a, b) => {
        if (sortField === 'tx_type') {
          const kindA = ADMIN_TX_KIND_LABELS[deriveAdminTxKind(a, rowKindOverrides[a.id])];
          const kindB = ADMIN_TX_KIND_LABELS[deriveAdminTxKind(b, rowKindOverrides[b.id])];
          return sortAsc
            ? kindA.localeCompare(kindB, 'zh-CN')
            : kindB.localeCompare(kindA, 'zh-CN');
        }
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
  }, [rows, searchQuery, sortField, sortAsc, rowKindOverrides]);

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

    const changedItems: Transaction[] = [
      ...pendingChanges.added,
      ...pendingChanges.modified.map((m) => m.current),
    ];

    const transferValidationError = findInvalidTransfer(changedItems);
    if (transferValidationError) {
      setSaveError(transferValidationError);
      return;
    }

    const addedCount = pendingChanges.added.length;
    const modifiedCount = pendingChanges.modified.length;
    const deletedCount = pendingChanges.deleted.length;
    const totalCount = pendingChanges.totalCount;

    setSaving(true);
    setSaveError(null);
    try {
      const normalizedChangedItems = changedItems.map((item) =>
        isTransferTransaction(item)
          ? {
              ...item,
              tx_type: 'transfer' as const,
              ledger: normalizeLedgerName(item.ledger),
              to_ledger: (item.to_ledger || '').trim(),
              amount: Math.abs(Number(item.amount) || 0),
              category: item.category || '转账',
            }
          : {
              ...item,
              tx_type: 'normal' as const,
              ledger: normalizeLedgerName(item.ledger),
              to_ledger: '',
            }
      );
      await onBatchSave(normalizedChangedItems, deletedIds);
      setDeletedIds([]);
      setShowSavePreviewModal(false);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLastSavedTime(timeStr);

      const summaryParts: string[] = [];
      if (addedCount > 0) summaryParts.push(`新增 ${addedCount} 条`);
      if (modifiedCount > 0) summaryParts.push(`更新 ${modifiedCount} 条`);
      if (deletedCount > 0) summaryParts.push(`删除 ${deletedCount} 条`);
      const detailText = `已写入数据库：${summaryParts.join('、')}（共 ${totalCount} 项变动 · ${timeStr}）`;

      setStatusMsg({
        type: 'success',
        text: `SQL 执行成功 · ${detailText}`,
      });
      setSqlToast({
        title: 'SQL 执行成功',
        detail: detailText,
      });
      if (sqlToastTimerRef.current !== null) {
        window.clearTimeout(sqlToastTimerRef.current);
      }
      sqlToastTimerRef.current = window.setTimeout(() => {
        setSqlToast(null);
        setStatusMsg(null);
        sqlToastTimerRef.current = null;
      }, 6000);
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
    const headers = ['id', 'date', 'tx_type', 'title', 'amount', 'member', 'category', 'subcategory', 'ledger', 'to_ledger'];
    const csvLines = [headers.join(',')];

    processedRows.forEach((r) => {
      const transfer = isTransferTransaction(r);
      const line = [
        r.id,
        r.date,
        transfer ? 'transfer' : 'normal',
        `"${(r.title || '').replace(/"/g, '""')}"`,
        r.amount,
        `"${(r.member || '').replace(/"/g, '""')}"`,
        `"${(r.category || '').replace(/"/g, '""')}"`,
        `"${(r.subcategory || '').replace(/"/g, '""')}"`,
        `"${normalizeLedgerName(r.ledger).replace(/"/g, '""')}"`,
        `"${(transfer ? (r.to_ledger || '') : '').replace(/"/g, '""')}"`,
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
                placeholder="筛选日期 / 备注 / 成员 / 分类 / 金额 / 账本…"
                style={{ width: 240, maxWidth: '100%' }}
              />
              <button
                type="button"
                className="pt-btn tab"
                onClick={() => setShowAddModal(true)}
              >
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
                CSV导入
              </button>
              <button type="button" className="pt-btn tab" onClick={handleExportCSV}>
                CSV导出
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
                    <th style={{ width: 68, cursor: 'pointer' }} onClick={() => handleSort('tx_type')}>
                      类型{sortIndicator('tx_type')}
                    </th>
                    <th style={{ width: 102, cursor: 'pointer' }} onClick={() => handleSort('date')}>
                      日期{sortIndicator('date')}
                    </th>
                    <th style={{ width: 78, cursor: 'pointer' }} onClick={() => handleSort('member')}>
                      成员{sortIndicator('member')}
                    </th>
                    <th style={{ width: 84, cursor: 'pointer' }} onClick={() => handleSort('category')}>
                      主分类{sortIndicator('category')}
                    </th>
                    <th style={{ width: 84, cursor: 'pointer' }} onClick={() => handleSort('subcategory')}>
                      子分类{sortIndicator('subcategory')}
                    </th>
                    <th style={{ minWidth: 130, cursor: 'pointer' }} onClick={() => handleSort('title')}>
                      备注{sortIndicator('title')}
                    </th>
                    <th style={{ width: 96, cursor: 'pointer' }} onClick={() => handleSort('amount')}>
                      金额{sortIndicator('amount')}
                    </th>
                    <th style={{ width: 96, cursor: 'pointer' }} onClick={() => handleSort('ledger')}>
                      账本(转出){sortIndicator('ledger')}
                    </th>
                    <th style={{ width: 96, cursor: 'pointer' }} onClick={() => handleSort('to_ledger')}>
                      转入账本{sortIndicator('to_ledger')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processedRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: '#666' }}>
                        暂无匹配的交易记录
                      </td>
                    </tr>
                  ) : (
                    processedRows.map((row) => {
                      const status = getRowChangeStatus(row);
                      const rowKind = deriveAdminTxKind(row, rowKindOverrides[row.id]);
                      const isTransfer = rowKind === 'transfer';
                      const kindColor =
                        rowKind === 'transfer'
                          ? 'var(--transfer)'
                          : rowKind === 'income'
                          ? 'var(--income)'
                          : 'var(--expense)';
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
                          <td>
                            <select
                              className="pt-input"
                              style={{
                                width: '100%',
                                padding: '0 4px',
                                color: kindColor,
                                fontWeight: 'bold',
                              }}
                              value={rowKind}
                              onChange={(e) =>
                                handleKindChange(row.id, e.target.value as AdminTxKind)
                              }
                            >
                              <option value="expense">支出</option>
                              <option value="income">收入</option>
                              <option value="transfer">转账</option>
                            </select>
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
                              style={{
                                width: '100%',
                                background: isTransfer ? '#f0f0f0' : '#fff',
                                color: isTransfer ? '#999' : undefined,
                              }}
                              disabled={isTransfer}
                              placeholder={isTransfer ? '—' : ''}
                              value={isTransfer ? '' : row.member}
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
                              min={rowKind === 'expense' ? undefined : 0}
                              className="pt-input"
                              style={{
                                width: '100%',
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)',
                                color: kindColor,
                              }}
                              value={row.amount}
                              onChange={(e) => handleCellChange(row.id, 'amount', e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              className="pt-input"
                              style={{ width: '100%', padding: '0 4px' }}
                              value={normalizeLedgerName(row.ledger)}
                              onChange={(e) =>
                                handleLedgerSelectChange(row.id, 'ledger', e.target.value)
                              }
                            >
                              {availableLedgers.map((l) => (
                                <option key={l} value={l}>
                                  {l}
                                </option>
                              ))}
                              <option value={CREATE_LEDGER_OPTION}>+ 新建账本…</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="pt-input"
                              style={{
                                width: '100%',
                                padding: '0 4px',
                                background: isTransfer ? '#fff' : '#f0f0f0',
                                color: isTransfer ? 'var(--transfer)' : '#999',
                              }}
                              disabled={!isTransfer}
                              value={isTransfer ? row.to_ledger || '' : ''}
                              onChange={(e) =>
                                handleLedgerSelectChange(row.id, 'to_ledger', e.target.value)
                              }
                            >
                              {!isTransfer ? (
                                <option value="">—</option>
                              ) : (
                                <>
                                  {!row.to_ledger && <option value="">目标账本</option>}
                                  {availableLedgers.map((l) => (
                                    <option key={l} value={l}>
                                      {l}
                                    </option>
                                  ))}
                                  <option value={CREATE_LEDGER_OPTION}>+ 新建账本…</option>
                                </>
                              )}
                            </select>
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
                          {it.date} · {it.member} ·{' '}
                          {isTransferTransaction(it)
                            ? `转账 ${normalizeLedgerName(it.ledger)}→${it.to_ledger || '?'}`
                            : it.category}{' '}
                          · {it.title || '无备注'} ({it.amount})
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
                          {current.date} · {current.member} ·{' '}
                          {isTransferTransaction(current)
                            ? `转账 ${normalizeLedgerName(current.ledger)}→${current.to_ledger || '?'}`
                            : current.category}{' '}
                          · {current.title || '无备注'} ({current.amount})
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
                          {it.date} · {it.member} ·{' '}
                          {isTransferTransaction(it)
                            ? `转账 ${normalizeLedgerName(it.ledger)}→${it.to_ledger || '?'}`
                            : it.category}{' '}
                          · {it.title || '无备注'} ({it.amount})
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
              title="CSV 批量导入 · CSV Import"
              onClose={() => setShowParseModal(false)}
            >
              <div style={{ padding: '12px 14px' }}>
                {parseStep === 'input' ? (
                  <>
                    <p style={{ margin: '0 0 8px', fontSize: 11, color: '#444' }}>
                      每行一条，支持 Tab 或双空格分隔：
                      <code>备注  日期(YYYY-MM-DD)  金额  成员  主分类/子分类  账本(转账可写 A→B)</code>
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
                            <th>账本</th>
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
                              <td>
                                {isTransferTransaction(it)
                                  ? `${normalizeLedgerName(it.ledger)} → ${it.to_ledger}`
                                  : it.ledger || 'Default'}
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

      <AddTransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        existingRows={rows}
        availableLedgers={availableLedgers}
        onAdd={handleAddTransactionFromModal}
      />

      {/* ── Floating SQL Execution Success Toast ── */}
      {sqlToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 80,
            width: 'min(480px, calc(100vw - 24px))',
          }}
        >
          <PlatinumWindow
            title={sqlToast.title}
            onClose={() => setSqlToast(null)}
            closeTitle="关闭提示"
          >
            <div
              style={{
                padding: '10px 12px',
                background: '#dcfce7',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
              }}
            >
              <PixelDot color="#15803d" />
              <span style={{ flex: 1, fontWeight: 'bold' }}>{sqlToast.detail}</span>
              <button
                type="button"
                className="pt-btn tab"
                onClick={() => setSqlToast(null)}
              >
                确定
              </button>
            </div>
          </PlatinumWindow>
        </div>
      )}
    </div>
  );
};
