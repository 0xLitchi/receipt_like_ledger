import type { Transaction } from '../types';
import {
  ADMIN_TX_KIND_LABELS,
  deriveAdminTxKind,
  type AdminTxKind,
} from '../features/admin/transaction-form';
import { normalizeLedgerName } from '../features/ledger/use-ledger';

export const CSV_TEMPLATE_HEADERS = [
  '类型',
  '日期',
  '金额',
  '成员',
  '主分类',
  '二级分类',
  '备注',
  '账本',
  '转入账本',
] as const;

export interface CsvDemoExample {
  kind: AdminTxKind;
  label: string;
  hint: string;
  line: string;
}

export function buildCsvDemoExamples(targetLedger = '储蓄'): CsvDemoExample[] {
  const safeTarget = targetLedger.trim() && targetLedger.trim() !== 'Default' ? targetLedger.trim() : '储蓄';
  return [
    {
      kind: 'expense',
      label: '支出',
      hint: '金额填正数即可，导入时自动记为负值；转入账本留空',
      line: '支出,2026-11-19,38.50,荔枝,餐饮,午餐,牛肉面,Default,',
    },
    {
      kind: 'income',
      label: '收入',
      hint: '金额自动记为正值；转入账本留空',
      line: '收入,2026-11-18,15000.00,扶正,收入,工资,11月工资,Default,',
    },
    {
      kind: 'transfer',
      label: '转账',
      hint: '需填写「账本(转出)」与「转入账本」，成员留空即可',
      line: `转账,2026-11-17,2000.00,,转账,内部转账,月度定存,Default,${safeTarget}`,
    },
  ];
}

export function buildCsvDemoTemplate(targetLedger = '储蓄'): string {
  const examples = buildCsvDemoExamples(targetLedger);
  return [CSV_TEMPLATE_HEADERS.join(','), ...examples.map((item) => item.line)].join('\n');
}

export type CsvImportFormat = 'csv-header' | 'csv-typed' | 'legacy-text' | 'empty';

export interface CsvImportIssue {
  lineNumber: number;
  rawLine: string;
  message: string;
}

export interface CsvParseSummary {
  total: number;
  expense: number;
  income: number;
  transfer: number;
}

export interface CsvParseResult {
  transactions: Transaction[];
  issues: CsvImportIssue[];
  detectedFormat: CsvImportFormat;
  summary: CsvParseSummary;
}

type CanonicalField =
  | 'id'
  | 'kind'
  | 'date'
  | 'amount'
  | 'member'
  | 'category'
  | 'subcategory'
  | 'title'
  | 'ledger'
  | 'to_ledger';

const HEADER_ALIAS_MAP: Record<string, CanonicalField> = {
  id: 'id',
  类型: 'kind',
  交易类型: 'kind',
  收支类型: 'kind',
  type: 'kind',
  tx_type: 'kind',
  kind: 'kind',
  日期: 'date',
  交易日期: 'date',
  时间: 'date',
  date: 'date',
  金额: 'amount',
  数额: 'amount',
  amount: 'amount',
  成员: 'member',
  关联成员: 'member',
  人物: 'member',
  member: 'member',
  主分类: 'category',
  分类: 'category',
  一级分类: 'category',
  category: 'category',
  二级分类: 'subcategory',
  子分类: 'subcategory',
  细分类: 'subcategory',
  subcategory: 'subcategory',
  备注: 'title',
  说明: 'title',
  标题: 'title',
  项目: 'title',
  title: 'title',
  note: 'title',
  memo: 'title',
  账本: 'ledger',
  转出账本: 'ledger',
  账户: 'ledger',
  ledger: 'ledger',
  from_ledger: 'ledger',
  转入账本: 'to_ledger',
  目标账本: 'to_ledger',
  to_ledger: 'to_ledger',
};

const POSITIONAL_TYPED_COLUMNS: CanonicalField[] = [
  'kind',
  'date',
  'amount',
  'member',
  'category',
  'subcategory',
  'title',
  'ledger',
  'to_ledger',
];

function normalizeHeaderCell(raw: string): string {
  return raw
    .trim()
    .replace(/^\*+|\*+$/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .trim()
    .toLowerCase();
}

function parseKindToken(raw: string): 'expense' | 'income' | 'transfer' | 'normal' | null {
  const token = raw.trim().toLowerCase();
  if (!token) return null;
  if (token === '支出' || token === 'expense' || token === 'out') return 'expense';
  if (token === '收入' || token === 'income' || token === 'in') return 'income';
  if (token === '转账' || token === 'transfer') return 'transfer';
  if (token === '收支' || token === '普通' || token === 'normal') return 'normal';
  return null;
}

/** Parse one RFC 4180 CSV line (supports quoted commas & escaped double quotes `""`). */
function parseCsvRow(line: string, delimiter: ',' | '，'): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"' && current.length === 0) {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function splitDelimitedLine(line: string): { fields: string[]; mode: 'tab' | 'csv' | 'space' } {
  if (line.includes('\t')) {
    return { fields: line.split('\t').map((p) => p.trim()), mode: 'tab' };
  }
  if (line.includes(',')) {
    return { fields: parseCsvRow(line, ','), mode: 'csv' };
  }
  if (line.includes('，')) {
    return { fields: parseCsvRow(line, '，'), mode: 'csv' };
  }
  return { fields: line.split(/\s{2,}/).map((p) => p.trim()), mode: 'space' };
}

/** Normalize YYYY-MM-DD / YYYY/M/D / YYYY.MM.DD and verify real calendar date. */
function normalizeDateValue(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseAmountValue(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/[￥¥$,\s]/g, '')
    .replace(/^\+/, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed === 0) return null;
  return Math.round(parsed * 100) / 100;
}

function buildHeaderColumnMap(fields: string[]): Map<CanonicalField, number> | null {
  const colMap = new Map<CanonicalField, number>();
  let matchedCount = 0;

  fields.forEach((cell, idx) => {
    const key = HEADER_ALIAS_MAP[normalizeHeaderCell(cell)];
    if (key && !colMap.has(key)) {
      colMap.set(key, idx);
      matchedCount += 1;
    }
  });

  // Require at least 2 recognized headers and either date or amount to avoid false positives
  if (matchedCount >= 2 && (colMap.has('date') || colMap.has('amount'))) {
    return colMap;
  }
  return null;
}

function makeParsedId(lineNumber: number): string {
  return `parse_${Date.now()}_${lineNumber}_${Math.random().toString(36).substring(2, 6)}`;
}

function finalizeStructuredRow(
  rawFields: Partial<Record<CanonicalField, string>>,
  lineNumber: number,
  rawLine: string
): { tx?: Transaction; issue?: CsvImportIssue } {
  const kindRaw = (rawFields.kind || '').trim();
  const parsedKind = kindRaw ? parseKindToken(kindRaw) : null;
  if (kindRaw && !parsedKind) {
    return {
      issue: {
        lineNumber,
        rawLine,
        message: `无法识别的类型「${kindRaw}」，请填写：支出、收入 或 转账`,
      },
    };
  }

  const date = normalizeDateValue(rawFields.date || '');
  if (!date) {
    return {
      issue: {
        lineNumber,
        rawLine,
        message: `日期格式不正确「${(rawFields.date || '').trim() || '空'}」，应为 YYYY-MM-DD`,
      },
    };
  }

  const parsedAmount = parseAmountValue(rawFields.amount || '');
  if (parsedAmount === null) {
    return {
      issue: {
        lineNumber,
        rawLine,
        message: `金额不正确或为 0「${(rawFields.amount || '').trim() || '空'}」`,
      },
    };
  }

  let ledger = (rawFields.ledger || '').trim() || 'Default';
  let toLedger = (rawFields.to_ledger || '').trim();
  const arrowMatch = ledger.match(/^(.+?)\s*(?:->|→)\s*(.+)$/);
  if (arrowMatch) {
    ledger = arrowMatch[1].trim() || 'Default';
    if (!toLedger) {
      toLedger = arrowMatch[2].trim();
    }
  }

  let category = (rawFields.category || '').trim();
  let subcategory = (rawFields.subcategory || '').trim();
  if (category.includes('/') && !subcategory) {
    const parts = category.split('/');
    category = parts[0].trim();
    subcategory = parts.slice(1).join('/').trim();
  }

  const title = (rawFields.title || '').trim();
  const memberRaw = (rawFields.member || '').trim();

  const isTransfer = parsedKind === 'transfer' || (!parsedKind && toLedger.length > 0) || (parsedKind === 'normal' && toLedger.length > 0);

  if (isTransfer) {
    if (!toLedger) {
      return {
        issue: {
          lineNumber,
          rawLine,
          message: '转账记录缺少「转入账本」（请在第 9 列填写，或在账本列写成 A→B）',
        },
      };
    }
    if (ledger === toLedger) {
      return {
        issue: {
          lineNumber,
          rawLine,
          message: `转账的转出账本与转入账本不能相同（均为「${ledger}」）`,
        },
      };
    }

    return {
      tx: {
        id: makeParsedId(lineNumber),
        date,
        title,
        amount: Math.abs(parsedAmount),
        member: '',
        category: !category || category === '其它' ? '转账' : category,
        subcategory: subcategory || '内部转账',
        ledger,
        tx_type: 'transfer',
        to_ledger: toLedger,
      },
    };
  }

  let finalAmount = parsedAmount;
  if (parsedKind === 'expense') {
    finalAmount = -Math.abs(parsedAmount);
  } else if (parsedKind === 'income') {
    finalAmount = Math.abs(parsedAmount);
  }

  return {
    tx: {
      id: makeParsedId(lineNumber),
      date,
      title,
      amount: finalAmount,
      member: memberRaw || '默认',
      category: category || '其它',
      subcategory,
      ledger,
      tx_type: 'normal',
      to_ledger: '',
    },
  };
}

function summarizeTransactions(items: Transaction[]): CsvParseSummary {
  let expense = 0;
  let income = 0;
  let transfer = 0;

  for (const item of items) {
    if (item.tx_type === 'transfer' || (item.to_ledger && item.to_ledger.trim().length > 0)) {
      transfer += 1;
    } else if (item.amount < 0) {
      expense += 1;
    } else {
      income += 1;
    }
  }

  return {
    total: items.length,
    expense,
    income,
    transfer,
  };
}

/**
 * 解析批量导入的账本文本，自动识别以下 3 种格式并返回明细与逐行校验错误：
 * 1. 带表头的标准 CSV / TSV（推荐：类型,日期,金额,成员,主分类,二级分类,备注,账本,转入账本；兼容「CSV导出」文件回导）
 * 2. 无表头、首列为「支出/收入/转账」的 CSV / TSV
 * 3. 旧版 Tab / 双空格纯文本（备注\t日期\t金额\t成员\t主分类/子分类\t账本[\t转入账本] 或 日期开头）
 */
export function parseLedgerImport(text: string): CsvParseResult {
  const cleanedText = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const rawLines = cleanedText.split('\n');

  const nonEmptyEntries: Array<{ lineNumber: number; rawLine: string }> = [];
  rawLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    nonEmptyEntries.push({ lineNumber: idx + 1, rawLine: line });
  });

  if (nonEmptyEntries.length === 0) {
    return {
      transactions: [],
      issues: [],
      detectedFormat: 'empty',
      summary: { total: 0, expense: 0, income: 0, transfer: 0 },
    };
  }

  const firstSplit = splitDelimitedLine(nonEmptyEntries[0].rawLine);
  const headerMap = buildHeaderColumnMap(firstSplit.fields);

  const transactions: Transaction[] = [];
  const issues: CsvImportIssue[] = [];

  if (headerMap) {
    for (let i = 1; i < nonEmptyEntries.length; i += 1) {
      const { lineNumber, rawLine } = nonEmptyEntries[i];
      const { fields } = splitDelimitedLine(rawLine);
      if (fields.every((f) => f === '')) continue;

      const record: Partial<Record<CanonicalField, string>> = {};
      headerMap.forEach((colIdx, fieldName) => {
        record[fieldName] = fields[colIdx] ?? '';
      });

      const res = finalizeStructuredRow(record, lineNumber, rawLine);
      if (res.tx) transactions.push(res.tx);
      else if (res.issue) issues.push(res.issue);
    }

    return {
      transactions,
      issues,
      detectedFormat: 'csv-header',
      summary: summarizeTransactions(transactions),
    };
  }

  // Check if first row starts with explicit kind keyword ("支出" / "收入" / "转账" / English equivalents)
  const firstKind = parseKindToken(firstSplit.fields[0] || '');
  if (firstKind && firstKind !== 'normal') {
    for (const { lineNumber, rawLine } of nonEmptyEntries) {
      const { fields } = splitDelimitedLine(rawLine);
      if (fields.length < 3) {
        issues.push({
          lineNumber,
          rawLine,
          message: '列数不足，至少需要：类型,日期,金额',
        });
        continue;
      }

      const record: Partial<Record<CanonicalField, string>> = {};
      POSITIONAL_TYPED_COLUMNS.forEach((fieldName, idx) => {
        record[fieldName] = fields[idx] ?? '';
      });

      const res = finalizeStructuredRow(record, lineNumber, rawLine);
      if (res.tx) transactions.push(res.tx);
      else if (res.issue) issues.push(res.issue);
    }

    return {
      transactions,
      issues,
      detectedFormat: 'csv-typed',
      summary: summarizeTransactions(transactions),
    };
  }

  // Fallback: legacy tab / multi-space / headerless CSV format
  for (const { lineNumber, rawLine } of nonEmptyEntries) {
    const { fields } = splitDelimitedLine(rawLine);
    if (fields.length < 3) {
      issues.push({
        lineNumber,
        rawLine,
        message: '格式无法识别或列数不足（建议加上表头，或使用「填入完整示例」参考格式）',
      });
      continue;
    }

    const firstIsDate = normalizeDateValue(fields[0]) !== null;
    const record: Partial<Record<CanonicalField, string>> = firstIsDate
      ? {
          title: '',
          date: fields[0] || '',
          amount: fields[1] || '',
          member: fields[2] || '',
          category: fields[3] || '',
          ledger: fields[4] || '',
          to_ledger: fields[5] || '',
        }
      : {
          title: fields[0] || '',
          date: fields[1] || '',
          amount: fields[2] || '',
          member: fields[3] || '',
          category: fields[4] || '',
          ledger: fields[5] || '',
          to_ledger: fields[6] || '',
        };

    const res = finalizeStructuredRow(record, lineNumber, rawLine);
    if (res.tx) transactions.push(res.tx);
    else if (res.issue) issues.push(res.issue);
  }

  return {
    transactions,
    issues,
    detectedFormat: 'legacy-text',
    summary: summarizeTransactions(transactions),
  };
}

/**
 * 兼容旧调用：直接返回成功解析的交易数组。
 */
export const parseRawLedgerText = (text: string): Transaction[] => {
  return parseLedgerImport(text).transactions;
};

export interface CsvExportRow {
  id: string;
  kind: AdminTxKind;
  kindLabel: string;
  date: string;
  amount: string;
  member: string;
  category: string;
  subcategory: string;
  title: string;
  ledger: string;
  to_ledger: string;
  csvLine: string;
}

export interface CsvExportResult {
  csvText: string;
  headers: readonly string[];
  rows: CsvExportRow[];
  summary: CsvParseSummary;
  validation: {
    compatible: boolean;
    parsedCount: number;
    issues: CsvImportIssue[];
  };
}

/**
 * 按 RFC 4180 转义单个 CSV 单元格，并将换行符/制表符规范为空格，
 * 确保导出结果可被 parseLedgerImport 100% 无损回导。
 */
export function escapeCsvCell(raw: string): string {
  const normalized = raw.replace(/[\r\n\t]+/g, ' ').trim();
  if (!normalized) return '';
  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

/**
 * 将交易列表序列化为与 CSV 导入完全一致的 9 列标准格式：
 * 类型,日期,金额,成员,主分类,二级分类,备注,账本,转入账本
 * 并自动执行一次导入回环校验，返回预览行与兼容性结果。
 */
export function buildCsvExport(
  transactions: Transaction[],
  kindOverrides?: Record<string, AdminTxKind>
): CsvExportResult {
  let expense = 0;
  let income = 0;
  let transfer = 0;

  const rows: CsvExportRow[] = transactions.map((tx) => {
    const kind = deriveAdminTxKind(tx, kindOverrides?.[tx.id]);
    const kindLabel = ADMIN_TX_KIND_LABELS[kind];
    if (kind === 'transfer') transfer += 1;
    else if (kind === 'expense') expense += 1;
    else income += 1;

    const numericAmount = Number(tx.amount);
    const amount = Number.isFinite(numericAmount) ? Math.abs(numericAmount).toFixed(2) : '0.00';
    const date = (tx.date || '').trim();
    const ledger = normalizeLedgerName(tx.ledger);
    const title = (tx.title || '').replace(/[\r\n\t]+/g, ' ').trim();

    const member = kind === 'transfer' ? '' : (tx.member || '').replace(/[\r\n\t]+/g, ' ').trim();
    const category =
      kind === 'transfer'
        ? (tx.category || '').replace(/[\r\n\t]+/g, ' ').trim() || '转账'
        : (tx.category || '').replace(/[\r\n\t]+/g, ' ').trim();
    const subcategory =
      kind === 'transfer'
        ? (tx.subcategory || '').replace(/[\r\n\t]+/g, ' ').trim() || '内部转账'
        : (tx.subcategory || '').replace(/[\r\n\t]+/g, ' ').trim();
    const toLedger =
      kind === 'transfer' ? (tx.to_ledger || '').replace(/[\r\n\t]+/g, ' ').trim() : '';

    const csvLine = [
      kindLabel,
      date,
      amount,
      member,
      category,
      subcategory,
      title,
      ledger,
      toLedger,
    ]
      .map(escapeCsvCell)
      .join(',');

    return {
      id: tx.id,
      kind,
      kindLabel,
      date,
      amount,
      member,
      category,
      subcategory,
      title,
      ledger,
      to_ledger: toLedger,
      csvLine,
    };
  });

  const csvText = [CSV_TEMPLATE_HEADERS.join(','), ...rows.map((r) => r.csvLine)].join('\n');
  const roundTrip = parseLedgerImport(csvText);

  return {
    csvText,
    headers: CSV_TEMPLATE_HEADERS,
    rows,
    summary: {
      total: rows.length,
      expense,
      income,
      transfer,
    },
    validation: {
      compatible: roundTrip.issues.length === 0 && roundTrip.transactions.length === rows.length,
      parsedCount: roundTrip.transactions.length,
      issues: roundTrip.issues,
    },
  };
}
