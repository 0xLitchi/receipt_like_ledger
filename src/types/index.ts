export interface Transaction {
  id: string;
  title: string;          // 备注 / 项目名称 (如 "小雅退押金" 或 "")
  date: string;           // 日期 YYYY-MM-DD
  amount: number;         // 金额 (正数为收入，负数为支出)
  member: string;         // 关联人员 (如 "荔枝", "扶正")
  category: string;       // 主分类 (如 "住房", "杂项", "账单")
  subcategory: string;    // 子分类 (如 "押金", "麻将", "招商银行", "白条")
  ledger: string;         // 账本 (如 "Default")
  created_at?: string;
  isMasked?: boolean;     // 未鉴权时服务端脱敏标记
}

/** 目前只保留拟真小票一种主题 */
export type ThemeStyle = 'receipt';

export type LedgerType = 'ALL' | 'EXPENSE' | 'INCOME';

/** 账本页的筛选条件，全部来源于 URL query */
export interface LedgerFilters {
  month: string;          // "ALL" 或 "2026-08"
  member: string;         // "ALL" 或 具体成员
  category: string;       // "ALL" 或 具体分类（可含 "杂项/麻将" 形式）
  type: LedgerType;       // 全部 / 仅支出 / 仅收入
  search: string;         // 搜索关键词
}

export interface DateGroup {
  date: string;
  shortDate: string;
  items: Transaction[];
}

export interface SummaryStats {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  count: number;
}

/** 访问者权限层级：管理员 / 已解密 / 脱敏 */
export type AccessMode = 'admin' | 'decrypted' | 'masked';

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

export interface AppSettings {
  theme_style: ThemeStyle;
}
