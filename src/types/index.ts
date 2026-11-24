export type TransactionKind = 'normal' | 'transfer';

export interface Transaction {
  id: string;
  title: string;          // 备注 / 项目名称 (如 "小雅退押金" 或 "")
  date: string;           // 日期 YYYY-MM-DD
  amount: number;         // 金额 (正数为收入，负数为支出；转账时为正数金额)
  member: string;         // 关联人员 (如 "荔枝", "扶正")
  category: string;       // 主分类 (如 "住房", "杂项", "账单", "转账")
  subcategory: string;    // 子分类 (如 "押金", "麻将", "招商银行", "白条")
  ledger: string;         // 账本 (如 "Default"；转账时为转出账本 A)
  tx_type?: TransactionKind; // 交易类型: normal (收支) | transfer (转账)
  to_ledger?: string;     // 转入账本 B（仅转账类型使用）
  created_at?: string;
  isMasked?: boolean;     // 未鉴权时服务端脱敏标记
}

export interface DisplayTransaction extends Transaction {
  sourceId?: string;           // 原始交易 ID（转账拆分后的两行共享同一 sourceId）
  transferLeg?: 'in' | 'out';  // 转账拆分方向：in = 转入账本收入，out = 转出账本支出
  counterpartyLedger?: string; // 转账对手方账本
}

export type LedgerType = 'ALL' | 'EXPENSE' | 'INCOME' | 'TRANSFER';

/** 账本页的筛选条件 */
export interface LedgerFilters {
  ledger: string;         // "ALL" 或 具体账本名（默认 "ALL"）
  month: string;          // "ALL" 或 "2026-08"
  member: string;         // "ALL" 或 具体成员
  category: string;       // "ALL" 或 具体二级分类（如 "餐饮/午餐"）
  type: LedgerType;       // 全部 / 仅支出 / 仅收入 / 仅转账
  search: string;         // 搜索关键词
}

export interface DateGroup {
  date: string;
  shortDate: string;
  items: DisplayTransaction[];
}

export interface SummaryStats {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  count: number;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  source: 'web' | 'api' | 'import';
  action: 'create' | 'update' | 'delete' | 'batch_save';
  details: string;
  created_at?: string;
}

export interface ApiRequestLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status_code: number;
  success: number | boolean;
  ip_address: string;
  user_agent: string;
  token_used: string;
  payload_summary: string;
  execution_ms: number;
  created_at?: string;
}
