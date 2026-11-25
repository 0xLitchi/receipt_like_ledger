import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Transaction } from '../../types';
import {
  ADMIN_TX_KIND_LABELS,
  deriveAdminTxKind,
  type AdminTxKind,
} from '../../features/admin/transaction-form';
import { isTransferTransaction, normalizeLedgerName } from '../../features/ledger/use-ledger';
import { formatCurrency } from '../../utils/formatters';
import {
  CSV_TEMPLATE_HEADERS,
  buildCsvDemoExamples,
  buildCsvDemoTemplate,
  parseLedgerImport,
  type CsvImportIssue,
} from '../../utils/parser';
import { PlatinumWindow } from '../Platinum/PlatinumChrome';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableLedgers: string[];
  onImport: (rows: Transaction[]) => void;
}

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

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  availableLedgers,
  onImport,
}) => {
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [rawText, setRawText] = useState('');
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewRows, setPreviewRows] = useState<Transaction[]>([]);
  const [previewIssues, setPreviewIssues] = useState<CsvImportIssue[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultTargetLedger = useMemo(
    () => availableLedgers.find((l) => l !== 'Default') || '储蓄',
    [availableLedgers]
  );

  const demoExamples = useMemo(
    () => buildCsvDemoExamples(defaultTargetLedger),
    [defaultTargetLedger]
  );

  const fullDemoCsv = useMemo(
    () => buildCsvDemoTemplate(defaultTargetLedger),
    [defaultTargetLedger]
  );

  const liveResult = useMemo(() => parseLedgerImport(rawText), [rawText]);

  const previewSummary = useMemo(() => {
    let expense = 0;
    let income = 0;
    let transfer = 0;
    previewRows.forEach((row) => {
      const kind = deriveAdminTxKind(row);
      if (kind === 'transfer') transfer += 1;
      else if (kind === 'expense') expense += 1;
      else income += 1;
    });
    return { total: previewRows.length, expense, income, transfer };
  }, [previewRows]);

  useEffect(() => {
    if (!isOpen) return;
    setStep('input');
    setFileError(null);
    setIsDragging(false);
  }, [isOpen]);

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

  if (!isOpen) return null;

  const handleLoadFile = (file: File) => {
    setFileError(null);
    if (file.size > 5 * 1024 * 1024) {
      setFileError('文件超过 5MB 限制，请拆分后再导入');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setRawText(content);
      setLoadedFileName(file.name);
      setStep('input');
    };
    reader.onerror = () => {
      setFileError('读取文件失败，请确认文件为 UTF-8 编码的 CSV / TXT 文本');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleLoadFile(file);
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleLoadFile(file);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob(['﻿' + fullDemoCsv + '\n'], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'receipt_ledger_import_template.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFillFullDemo = () => {
    setFileError(null);
    setLoadedFileName(null);
    setRawText(fullDemoCsv);
  };

  const handleInsertSingleDemo = (line: string) => {
    setFileError(null);
    setRawText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) {
        return `${CSV_TEMPLATE_HEADERS.join(',')}\n${line}`;
      }
      return `${prev.replace(/\s+$/, '')}\n${line}`;
    });
  };

  const handleClearInput = () => {
    setRawText('');
    setLoadedFileName(null);
    setFileError(null);
  };

  const handleProceedPreview = () => {
    if (liveResult.transactions.length === 0) return;
    setPreviewRows(liveResult.transactions);
    setPreviewIssues(liveResult.issues);
    setStep('preview');
  };

  const handleRemovePreviewRow = (id: string) => {
    setPreviewRows((prev) => prev.filter((item) => item.id !== id));
  };

  const handleConfirmImport = () => {
    if (previewRows.length === 0) return;
    onImport(previewRows);
    setRawText('');
    setLoadedFileName(null);
    setPreviewRows([]);
    setPreviewIssues([]);
    setStep('input');
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
      <div style={{ width: '100%', maxWidth: 780 }}>
        <PlatinumWindow
          title="CSV 批量导入 · CSV Import"
          onClose={onClose}
          closeTitle="关闭"
        >
          {/* Step Indicator Strip */}
          <div className="pt-strip" style={{ background: 'var(--g200)', fontSize: 11 }}>
            <span
              style={{
                fontWeight: step === 'input' ? 'bold' : 'normal',
                color: step === 'input' ? 'var(--hl)' : '#666',
              }}
            >
              1. 录入 / 上传 CSV
            </span>
            <span style={{ color: '#888' }}>→</span>
            <span
              style={{
                fontWeight: step === 'preview' ? 'bold' : 'normal',
                color: step === 'preview' ? 'var(--hl)' : '#666',
              }}
            >
              2. 校验预览并导入
            </span>

            {step === 'input' && (
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  style={{ display: 'none' }}
                  onChange={handleFileInputChange}
                />
                <button
                  type="button"
                  className="pt-btn tab"
                  onClick={() => fileInputRef.current?.click()}
                >
                  选择 CSV 文件
                </button>
                <button
                  type="button"
                  className="pt-btn tab"
                  onClick={handleDownloadTemplate}
                >
                  下载模板 CSV
                </button>
                <button
                  type="button"
                  className="pt-btn tab"
                  onClick={handleFillFullDemo}
                >
                  填入完整示例
                </button>
              </span>
            )}
          </div>

          <div style={{ padding: '10px 14px', maxHeight: '72vh', overflowY: 'auto' }}>
            {step === 'input' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Demo Examples Box for 支出 / 收入 / 转账 */}
                <div className="pt-csv-demo">
                  <div className="pt-csv-demo-head">
                    <span>格式示例（收入 / 支出 / 转账）</span>
                    <span className="pt-csv-demo-cols">
                      列顺序：{CSV_TEMPLATE_HEADERS.join(',')}
                    </span>
                  </div>

                  <div className="pt-csv-demo-list">
                    {demoExamples.map((ex) => (
                      <div key={ex.kind} className="pt-csv-demo-row">
                        <span
                          className="pt-csv-tag"
                          style={{
                            color: KIND_COLOR[ex.kind],
                            background: KIND_BG[ex.kind],
                            borderColor: KIND_COLOR[ex.kind],
                          }}
                        >
                          {ex.label}
                        </span>
                        <div className="pt-csv-demo-body">
                          <code className="pt-csv-demo-code">{ex.line}</code>
                          <span className="pt-csv-demo-hint">{ex.hint}</span>
                        </div>
                        <button
                          type="button"
                          className="pt-btn compact"
                          onClick={() => handleInsertSingleDemo(ex.line)}
                          title={`将「${ex.label}」示例追加到下方输入框`}
                        >
                          + 插入
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-csv-demo-foot">
                    支持逗号分隔 CSV、Excel/表格直接复制粘贴（Tab 分隔），也支持本后台「CSV导出」文件直接回导。
                  </div>
                </div>

                {/* Textarea / File Dropzone */}
                <div
                  className={`pt-csv-dropzone${isDragging ? ' dragging' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isDragging) setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                    setIsDragging(false);
                  }}
                  onDrop={handleDropFile}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                      fontSize: 11,
                      color: '#444',
                    }}
                  >
                    <span>
                      粘贴 CSV 数据或将 <code>.csv</code> 文件拖入下方：
                      {loadedFileName && (
                        <strong style={{ marginLeft: 6, color: 'var(--hl)' }}>
                          [已载入: {loadedFileName}]
                        </strong>
                      )}
                    </span>
                    {rawText.trim() && (
                      <button
                        type="button"
                        onClick={handleClearInput}
                        style={{
                          background: 'none',
                          border: 0,
                          color: '#991b1b',
                          cursor: 'pointer',
                          fontSize: 11,
                          padding: 0,
                        }}
                      >
                        清空
                      </button>
                    )}
                  </div>

                  <textarea
                    className="pt-input"
                    rows={7}
                    style={{
                      width: '100%',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      lineHeight: 1.5,
                      whiteSpace: 'pre',
                      overflowX: 'auto',
                      resize: 'vertical',
                    }}
                    value={rawText}
                    onChange={(e) => {
                      setFileError(null);
                      setRawText(e.target.value);
                    }}
                    placeholder={fullDemoCsv}
                  />
                </div>

                {fileError && (
                  <div
                    role="alert"
                    style={{
                      padding: '6px 8px',
                      background: '#fee2e2',
                      border: '1px solid #991b1b',
                      color: '#991b1b',
                      fontSize: 11,
                      fontWeight: 'bold',
                    }}
                  >
                    {fileError}
                  </div>
                )}

                {/* Real-time Parse Feedback */}
                {rawText.trim() && (
                  <div
                    style={{
                      padding: '6px 9px',
                      background: liveResult.transactions.length > 0 ? '#f6f8ff' : '#fff7ed',
                      border: '1px solid var(--g500)',
                      fontSize: 11,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <span>
                        实时识别：<strong>{liveResult.summary.total}</strong> 条有效记录
                      </span>
                      {liveResult.summary.total > 0 && (
                        <>
                          <span style={{ color: 'var(--expense)', fontWeight: 'bold' }}>
                            支出 {liveResult.summary.expense}
                          </span>
                          <span style={{ color: 'var(--income)', fontWeight: 'bold' }}>
                            收入 {liveResult.summary.income}
                          </span>
                          <span style={{ color: 'var(--transfer)', fontWeight: 'bold' }}>
                            转账 {liveResult.summary.transfer}
                          </span>
                        </>
                      )}
                      {liveResult.issues.length > 0 && (
                        <span style={{ color: '#991b1b', fontWeight: 'bold' }}>
                          · {liveResult.issues.length} 行异常（将被跳过）
                        </span>
                      )}
                    </div>

                    {liveResult.issues.length > 0 && (
                      <ul
                        style={{
                          margin: '2px 0 0',
                          paddingLeft: 18,
                          color: '#991b1b',
                          fontSize: 11,
                        }}
                      >
                        {liveResult.issues.slice(0, 5).map((issue) => (
                          <li key={`${issue.lineNumber}-${issue.message}`}>
                            第 {issue.lineNumber} 行：{issue.message}
                          </li>
                        ))}
                        {liveResult.issues.length > 5 && (
                          <li>… 其余 {liveResult.issues.length - 5} 行异常请在预览前检查</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 11,
                  }}
                >
                  <span>
                    解析完成，即将导入 <strong>{previewSummary.total}</strong> 条至编辑区顶部：
                  </span>
                  <span style={{ color: 'var(--expense)', fontWeight: 'bold' }}>
                    支出 {previewSummary.expense}
                  </span>
                  <span style={{ color: 'var(--income)', fontWeight: 'bold' }}>
                    收入 {previewSummary.income}
                  </span>
                  <span style={{ color: 'var(--transfer)', fontWeight: 'bold' }}>
                    转账 {previewSummary.transfer}
                  </span>
                  <span style={{ marginLeft: 'auto', color: '#666' }}>
                    导入后可二次编辑，再点「保存变动」提交
                  </span>
                </div>

                {previewIssues.length > 0 && (
                  <div
                    style={{
                      padding: '6px 8px',
                      background: '#fffbeb',
                      border: '1px solid #d97706',
                      color: '#92400e',
                      fontSize: 11,
                    }}
                  >
                    <strong>已跳过 {previewIssues.length} 行异常数据：</strong>
                    <ul style={{ margin: '3px 0 0', paddingLeft: 18 }}>
                      {previewIssues.slice(0, 5).map((issue) => (
                        <li key={`${issue.lineNumber}-${issue.message}`}>
                          第 {issue.lineNumber} 行：{issue.message}
                        </li>
                      ))}
                      {previewIssues.length > 5 && (
                        <li>… 另有 {previewIssues.length - 5} 行异常已跳过</li>
                      )}
                    </ul>
                  </div>
                )}

                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--g500)' }}>
                  <table className="pt-table">
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ width: 52 }}>类型</th>
                        <th style={{ width: 90 }}>日期</th>
                        <th style={{ width: 64 }}>成员</th>
                        <th style={{ width: 110 }}>分类</th>
                        <th>备注</th>
                        <th style={{ width: 92, textAlign: 'right' }}>金额</th>
                        <th style={{ width: 120 }}>账本 / 路径</th>
                        <th style={{ width: 36, textAlign: 'center' }}>删</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: 20, color: '#666' }}>
                            已移除所有待导入记录，请返回修改
                          </td>
                        </tr>
                      ) : (
                        previewRows.map((it) => {
                          const kind = deriveAdminTxKind(it);
                          const transfer = isTransferTransaction(it);
                          return (
                            <tr key={it.id}>
                              <td>
                                <span
                                  className="pt-csv-tag"
                                  style={{
                                    color: KIND_COLOR[kind],
                                    background: KIND_BG[kind],
                                    borderColor: KIND_COLOR[kind],
                                  }}
                                >
                                  {ADMIN_TX_KIND_LABELS[kind]}
                                </span>
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                                {it.date}
                              </td>
                              <td>{transfer ? '—' : it.member || '默认'}</td>
                              <td>
                                {it.subcategory ? `${it.category}/${it.subcategory}` : it.category}
                              </td>
                              <td>{it.title || '—'}</td>
                              <td
                                style={{
                                  textAlign: 'right',
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 'bold',
                                  color: KIND_COLOR[kind],
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {transfer
                                  ? formatCurrency(Math.abs(it.amount), false, false)
                                  : formatCurrency(it.amount, true, false)}
                              </td>
                              <td
                                style={{
                                  color: transfer ? 'var(--transfer)' : 'inherit',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {transfer
                                  ? `${normalizeLedgerName(it.ledger)} → ${it.to_ledger}`
                                  : normalizeLedgerName(it.ledger)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  aria-label="移除该条预览记录"
                                  onClick={() => handleRemovePreviewRow(it.id)}
                                  style={{
                                    background: 'none',
                                    border: 0,
                                    color: '#991b1b',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    padding: '0 4px',
                                  }}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div
            className="pt-statusbar"
            style={{ padding: '8px 12px', justifyContent: 'flex-end', gap: 8 }}
          >
            {step === 'preview' && (
              <button
                type="button"
                className="pt-btn"
                onClick={() => setStep('input')}
              >
                ← 返回修改
              </button>
            )}
            <button type="button" className="pt-btn" onClick={onClose}>
              取消
            </button>
            {step === 'input' ? (
              <button
                type="button"
                className="pt-btn primary"
                disabled={liveResult.transactions.length === 0}
                onClick={handleProceedPreview}
              >
                下一步：预览 ({liveResult.summary.total})
              </button>
            ) : (
              <button
                type="button"
                className="pt-btn primary"
                disabled={previewRows.length === 0}
                onClick={handleConfirmImport}
              >
                确认导入 ({previewRows.length})
              </button>
            )}
          </div>
        </PlatinumWindow>
      </div>
    </div>
  );
};
