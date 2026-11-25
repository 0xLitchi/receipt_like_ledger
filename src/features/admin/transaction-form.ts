import type { Transaction } from '../../types';
import { isTransferTransaction, normalizeLedgerName } from '../ledger/use-ledger';

export type AdminTxKind = 'expense' | 'income' | 'transfer';

export const ADMIN_TX_KIND_LABELS: Record<AdminTxKind, string> = {
  expense: '支出',
  income: '收入',
  transfer: '转账',
};

export interface NewTransactionDraft {
  kind: AdminTxKind;
  date: string;
  amount: string;
  member: string;
  category: string;
  subcategory: string;
  title: string;
  ledger: string;
  to_ledger: string;
}

/** 根据交易字段（及 0 元行显式覆盖）推导后台三态类型 */
export function deriveAdminTxKind(
  tx: Pick<Transaction, 'amount' | 'tx_type' | 'to_ledger'>,
  override?: AdminTxKind
): AdminTxKind {
  if (isTransferTransaction(tx)) return 'transfer';
  if (tx.amount > 0) return 'income';
  if (tx.amount < 0) return 'expense';
  return override ?? 'expense';
}

/** 切换交易的后台三态类型，自动规范金额正负号、转入账本、人物标记与默认分类 */
export function applyAdminTxKind(tx: Transaction, kind: AdminTxKind): Transaction {
  const abs = Math.abs(Number(tx.amount) || 0);
  if (kind === 'transfer') {
    const nextCategory =
      !tx.category || tx.category === '杂项' || tx.category === '其它' ? '转账' : tx.category;
    const nextSubcategory = tx.subcategory?.trim() || '内部转账';
    return {
      ...tx,
      tx_type: 'transfer',
      member: '',
      amount: abs,
      category: nextCategory,
      subcategory: nextSubcategory,
      to_ledger: tx.to_ledger || '',
    };
  }

  const nextCategory = tx.category === '转账' ? '' : tx.category;
  const nextSubcategory = tx.subcategory === '内部转账' ? '' : tx.subcategory;
  return {
    ...tx,
    tx_type: 'normal',
    to_ledger: '',
    category: nextCategory,
    subcategory: nextSubcategory,
    amount: kind === 'expense' ? (abs === 0 ? 0 : -abs) : abs,
  };
}

/** 在表格内编辑金额时，根据当前选中的类型保持合法正负号 */
export function applyAmountForKind(kind: AdminTxKind, rawValue: string): number {
  if (rawValue.trim() === '') return 0;
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) return 0;
  const abs = Math.abs(parsed);
  if (abs === 0) return 0;
  return kind === 'expense' ? -abs : abs;
}

/** 校验并构建新增弹窗提交的 Transaction */
export function buildTransactionFromDraft(
  draft: NewTransactionDraft,
  idFactory: () => string = () => `new_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
): { ok: true; transaction: Transaction } | { ok: false; error: string } {
  const date = draft.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: '请填写合法日期（格式 YYYY-MM-DD）' };
  }

  const parsedAmt = Number.parseFloat(draft.amount);
  if (!Number.isFinite(parsedAmt) || Math.abs(parsedAmt) <= 0) {
    return { ok: false, error: '请填写大于 0 的金额' };
  }
  const absAmt = Math.round(Math.abs(parsedAmt) * 100) / 100;

  const fromLedger = normalizeLedgerName(draft.ledger);
  const title = draft.title.trim();
  const subcategory = draft.subcategory.trim();

  if (draft.kind === 'transfer') {
    const toLedger = draft.to_ledger.trim();
    if (!toLedger) {
      return { ok: false, error: '转账记录必须填写「转入账本」' };
    }
    if (fromLedger === toLedger) {
      return { ok: false, error: '「转出账本」与「转入账本」不能相同' };
    }

    return {
      ok: true,
      transaction: {
        id: idFactory(),
        date,
        member: '',
        category: draft.category.trim() || '转账',
        subcategory: subcategory || '内部转账',
        title,
        amount: absAmt,
        ledger: fromLedger,
        tx_type: 'transfer',
        to_ledger: toLedger,
      },
    };
  }

  const member = draft.member.trim();
  if (!member) {
    return { ok: false, error: '请填写关联成员' };
  }

  const category = draft.category.trim();
  if (!category) {
    return { ok: false, error: '请填写主分类（例如：餐饮、住房、收入）' };
  }

  if (!subcategory) {
    return { ok: false, error: '请填写二级分类（例如：午餐、房租、工资）' };
  }

  return {
    ok: true,
    transaction: {
      id: idFactory(),
      date,
      member,
      category,
      subcategory,
      title,
      amount: draft.kind === 'expense' ? -absAmt : absAmt,
      ledger: fromLedger,
      tx_type: 'normal',
      to_ledger: '',
    },
  };
}

/** 批量落库前校验待提交转账项的合法性 */
export function findInvalidTransfer(items: Transaction[]): string | null {
  for (const item of items) {
    if (!isTransferTransaction(item)) continue;
    const from = normalizeLedgerName(item.ledger);
    const to = (item.to_ledger || '').trim();
    if (!to || from === to) {
      return '存在无效的转账记录：请填写「转入账本」，且不能与「账本(转出)」相同。';
    }
    if (!Number.isFinite(Number(item.amount)) || Math.abs(Number(item.amount)) <= 0) {
      return '存在金额为 0 或非法的转账记录，请检查转账金额。';
    }
  }
  return null;
}
