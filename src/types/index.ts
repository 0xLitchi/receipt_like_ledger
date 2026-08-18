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
}

export type ThemeType = 'paper-white' | 'paper-vintage' | 'paper-dark' | 'paper-receipt-blue';

export interface FilterState {
  month: string;          // "ALL" 或 "2026-08"
  member: string;         // "ALL" 或 具体成员 ("荔枝", "扶正")
  category: string;       // "ALL" 或 具体分类
  type: 'ALL' | 'EXPENSE' | 'INCOME'; // 全部 / 仅支出 / 仅收入
  search: string;         // 搜索关键词
}

export interface SummaryStats {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  count: number;
}
