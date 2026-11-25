import React, { useEffect, useMemo, useState } from 'react';
import type { Transaction } from '../../types';
import type { AdminTxKind } from '../../features/admin/transaction-form';
import { buildCsvExport } from '../../utils/parser';
import { PlatinumWindow } from '../Platinum/PlatinumChrome';

interface CsvExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allRows: Transaction[];
  filteredRows: Transaction[];
  selectedIds: Set<string>;
  isFiltered: boolean;
  rowKindOverrides: Record<string, AdminTxKind>;
  onExported?: (info: { count: number; fileName: string }) => void;
}

type ExportScope = 'selected' | 'filtered' | 'all';
type PreviewMode = 'table' | 'raw';

const PREVIEW_ROW_LIMIT = 100;

const KIND_COLOR: Record<AdminTxKind, string> = {
  expense: 'var(--expense)',
  income: 'var(--income)',
  transfer: 'var(--transfer)',
};

const KIND_BG: Record<AdminTxKind, string> = {
  expense: '#ecfdf3',
  income: '#fef2f2',
  transfer: '#eef2ff',
};

function getLocalDateStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const CsvExportModal: React.FC<CsvExportModalProps> = ({
  isOpen,
  onClose,
  allRows,
  filteredRows,
  selectedIds,
  isFiltered,
  rowKindOverrides,
  onExported,
}) => {
  const [scope, setScope] = useState<ExportScope>('all');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('table');
  const [showAllRows, setShowAllRows] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedRows = useMemo(
    () => allRows.filter((row) => selectedIds.has(row.id)),
    [allRows, selectedIds]
  );

  useEffect(() => {
    if (!isOpen) return;
    if (selectedRows.length > 0) {
      setScope('selected');
    } else if (isFiltered) {
      setScope('filtered');
    } else {
      setScope('all');
    }
    setPreviewMode('table');
    setShowAllRows(false);
    setCopied(false);
  }, [isOpen, isFiltered, selectedRows.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const targetRows = useMemo(() => {
    if (scope === 'selected' && selectedRows.length > 0) return selectedRows;
    if (scope === 'filtered') return filteredRows;
    return allRows;
  }, [scope, selectedRows, filteredRows, allRows]);

  const exportResult = useMemo(
    () => buildCsvExport(targetRows, rowKindOverrides),
    [targetRows, rowKindOverrides]
  );

  if (!isOpen) return null;

  const fileName = `receipt_ledger_export_${getLocalDateStamp()}.csv`;
  const hasScopeChoices = selectedRows.length > 0 || isFiltered;
  const displayedRows = showAllRows
    ? exportResult.rows
    : exportResult.rows.slice(0, PREVIEW_ROW_LIMIT);
  const hiddenRowCount = Math.max(0, exportResult.rows.length - displayedRows.length);

  const handleCopyCsv = async () => {
    try {
      await navigator.clipboard.writeText(exportResult.csvText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: ignore if clipboard API unavailable
    }
  };

  const handleConfirmExport = () => {
    if (exportResult.rows.length === 0) return;
    const blob = new Blob(['﻿' + exportResult.csvText + '\n'], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onExported?.({ count: exportResult.summary.total, fileName });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 65,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        background: 'rgba(38, 38, 38, 0.45)',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ width: '100%', maxWidth: 860 }}>
        <PlatinumWindow
          title="CSV 导出预览 · CSV Export"
          onClose={onClose}
          closeTitle="关闭"
        >
          {/* Top Scope & View Toggle Strip */}
          <div className="pt-strip" style={{ background: 'var(--g200)', fontSize: 11 }}>
            <span style={{ fontWeight: 'bold', color: '#333' }}>导出范围：</span>
            {hasScopeChoices ? (
              <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
                {selectedRows.length > 0 && (
                  <button
                    type="button"
                    className={`pt-btn compact${scope === 'selected' ? ' on' : ''}`}
                    onClick={() => {
                      setScope('selected');
                      setShowAllRows(false);
                    }}
                  >
                    已勾选 ({selectedRows.length})
                  </button>
                )}
                {isFiltered && (
                  <button
                    type="button"
                    className={`pt-btn compact${scope === 'filtered' ? ' on' : ''}`}
                    onClick={() => {
                      setScope('filtered');
                      setShowAllRows(false);
                    }}
                  >
                    当前筛选 ({filteredRows.length})
                  </button>
                )}
                <button
                  type="button"
                  className={`pt-btn compact${scope === 'all' ? ' on' : ''}`}
                  onClick={() => {
                    setScope('all');
                    setShowAllRows(false);
                  }}
                >
                  全部记录 ({allRows.length})
                </button>
              </span>
            ) : (
              <span>全部记录 ({allRows.length} 条)</span>
            )}

            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 5 }}>
              <button
                type="button"
                className={`pt-btn compact${previewMode === 'table' ? ' on' : ''}`}
                onClick={() => setPreviewMode('table')}
              >
                表格预览
              </button>
              <button
                type="button"
                className={`pt-btn compact${previewMode === 'raw' ? ' on' : ''}`}
                onClick={() => setPreviewMode('raw')}
              >
                CSV 原文
              </button>
            </span>
          </div>

          <div
            style={{
              padding: '10px 14px',
              maxHeight: '72vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Summary & Import Compatibility Verification */}
            <div
              style={{
                padding: '6px 9px',
                background:
                  exportResult.rows.length === 0
                    ? '#fff7ed'
                    : exportResult.validation.compatible
                      ? '#f0fdf4'
                      : '#fef2f2',
                border: `1px solid ${
                  exportResult.rows.length === 0
                    ? '#c2410c'
                    : exportResult.validation.compatible
                      ? '#15803d'
                      : '#991b1b'
                }`,
                fontSize: 11,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <span>
                  待导出 <strong>{exportResult.summary.total}</strong> 条：
                </span>
                <span style={{ color: 'var(--expense)', fontWeight: 'bold' }}>
                  支出 {exportResult.summary.expense}
                </span>
                <span style={{ color: 'var(--income)', fontWeight: 'bold' }}>
                  收入 {exportResult.summary.income}
                </span>
                <span style={{ color: 'var(--transfer)', fontWeight: 'bold' }}>
                  转账 {exportResult.summary.transfer}
                </span>

                <span
                  style={{
                    marginLeft: 'auto',
                    fontWeight: 'bold',
                    color:
                      exportResult.rows.length === 0
                        ? '#9a3412'
                        : exportResult.validation.compatible
                          ? '#15803d'
                          : '#991b1b',
                  }}
                >
                  {exportResult.rows.length === 0
                    ? '当前没有可导出的记录'
                    : exportResult.validation.compatible
                      ? '✓ 已通过导入格式校验（9列标准 CSV，可直接回导）'
                      : `⚠ 有 ${exportResult.validation.issues.length} 行不符合导入格式`}
                </span>
              </div>

              {exportResult.validation.issues.length > 0 && (
                <ul
                  style={{
                    margin: '2px 0 0',
                    paddingLeft: 18,
                    color: '#991b1b',
                    fontSize: 11,
                  }}
                >
                  {exportResult.validation.issues.slice(0, 5).map((issue) => (
                    <li key={`${issue.lineNumber}-${issue.message}`}>
                      CSV 第 {issue.lineNumber} 行：{issue.message}
                    </li>
                  ))}
                  {exportResult.validation.issues.length > 5 && (
                    <li>
                      … 其余 {exportResult.validation.issues.length - 5} 行问题请在表格中修正后再导出
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Preview Content */}
            {previewMode === 'table' ? (
              <>
                <div
                  style={{
                    maxHeight: 330,
                    overflowY: 'auto',
                    overflowX: 'auto',
                    border: '1px solid var(--g500)',
                    background: '#fff',
                  }}
                >
                  <table className="pt-table">
                    <thead>
                      <tr>
                        {exportResult.headers.map((header) => (
                          <th
                            key={header}
                            style={{
                              whiteSpace: 'nowrap',
                              textAlign: header === '金额' ? 'right' : 'left',
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={exportResult.headers.length}
                            style={{ textAlign: 'center', padding: 24, color: '#666' }}
                          >
                            没有可预览的数据
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <span
                                className="pt-csv-tag"
                                style={{
                                  color: KIND_COLOR[row.kind],
                                  background: KIND_BG[row.kind],
                                  borderColor: KIND_COLOR[row.kind],
                                }}
                              >
                                {row.kindLabel}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                              {row.date || '—'}
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 'bold',
                                color: KIND_COLOR[row.kind],
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row.amount}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{row.member || '—'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{row.category || '—'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{row.subcategory || '—'}</td>
                            <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.title}>
                              {row.title || '—'}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{row.ledger}</td>
                            <td
                              style={{
                                whiteSpace: 'nowrap',
                                color: row.kind === 'transfer' ? 'var(--transfer)' : '#888',
                              }}
                            >
                              {row.to_ledger || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {hiddenRowCount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: '#555',
                    }}
                  >
                    <span>
                      当前预览前 {PREVIEW_ROW_LIMIT} 条（另有 {hiddenRowCount} 条未展开，导出时将包含全部 {exportResult.summary.total} 条）
                    </span>
                    <button
                      type="button"
                      className="pt-btn compact"
                      onClick={() => setShowAllRows(true)}
                    >
                      展开全部 ({exportResult.summary.total})
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: '#444',
                  }}
                >
                  <span>以下为即将写入文件的标准 CSV 原文（可直接复制到「CSV导入」验证）：</span>
                  <button
                    type="button"
                    className="pt-btn compact"
                    onClick={() => void handleCopyCsv()}
                  >
                    {copied ? '已复制 ✓' : '复制全文'}
                  </button>
                </div>
                <textarea
                  readOnly
                  className="pt-input"
                  rows={14}
                  value={exportResult.csvText}
                  style={{
                    width: '100%',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    lineHeight: 1.5,
                    whiteSpace: 'pre',
                    overflowX: 'auto',
                    background: '#fafafa',
                  }}
                />
              </div>
            )}
          </div>

          {/* Footer Statusbar */}
          <div
            className="pt-statusbar"
            style={{
              padding: '8px 12px',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, color: '#444', fontFamily: 'var(--font-mono)' }}>
              {fileName} · UTF-8 BOM
            </span>
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <button type="button" className="pt-btn" onClick={onClose}>
                取消
              </button>
              <button
                type="button"
                className="pt-btn primary"
                disabled={exportResult.rows.length === 0}
                onClick={handleConfirmExport}
              >
                确认导出 CSV ({exportResult.summary.total})
              </button>
            </span>
          </div>
        </PlatinumWindow>
      </div>
    </div>
  );
};
