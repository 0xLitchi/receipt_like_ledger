import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types';
import {
  applyAdminTxKind,
  applyAmountForKind,
  buildTransactionFromDraft,
  deriveAdminTxKind,
  findInvalidTransfer,
  type NewTransactionDraft,
} from './transaction-form';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'tx_1',
  title: '午餐',
  date: '2026-11-20',
  amount: -35,
  member: '荔枝',
  category: '餐饮',
  subcategory: '午餐',
  ledger: 'Default',
  tx_type: 'normal',
  to_ledger: '',
  ...over,
});

const baseDraft = (over: Partial<NewTransactionDraft> = {}): NewTransactionDraft => ({
  kind: 'expense',
  date: '2026-11-24',
  amount: '42.5',
  member: '荔枝',
  category: '餐饮',
  subcategory: '午餐',
  title: '牛肉面',
  ledger: 'Default',
  to_ledger: '',
  ...over,
});

describe('deriveAdminTxKind', () => {
  it('derives expense, income, and transfer accurately', () => {
    expect(deriveAdminTxKind(tx({ amount: -20 }))).toBe('expense');
    expect(deriveAdminTxKind(tx({ amount: 200 }))).toBe('income');
    expect(deriveAdminTxKind(tx({ amount: 500, tx_type: 'transfer', to_ledger: '储蓄' }))).toBe('transfer');
    expect(deriveAdminTxKind(tx({ amount: 0 }))).toBe('expense');
    expect(deriveAdminTxKind(tx({ amount: 0 }), 'income')).toBe('income');
  });
});

describe('applyAdminTxKind', () => {
  it('flips sign between expense and income and clears transfer fields', () => {
    const asIncome = applyAdminTxKind(tx({ amount: -88 }), 'income');
    expect(asIncome.amount).toBe(88);
    expect(asIncome.tx_type).toBe('normal');
    expect(asIncome.to_ledger).toBe('');

    const asExpense = applyAdminTxKind(asIncome, 'expense');
    expect(asExpense.amount).toBe(-88);
    expect(asExpense.tx_type).toBe('normal');
  });

  it('switches to transfer with positive amount, empty member, and default category/subcategory', () => {
    const asTransfer = applyAdminTxKind(tx({ amount: -500, category: '杂项', subcategory: '' }), 'transfer');
    expect(asTransfer.tx_type).toBe('transfer');
    expect(asTransfer.member).toBe('');
    expect(asTransfer.amount).toBe(500);
    expect(asTransfer.category).toBe('转账');
    expect(asTransfer.subcategory).toBe('内部转账');

    const backToExpense = applyAdminTxKind({ ...asTransfer, to_ledger: '储蓄' }, 'expense');
    expect(backToExpense.tx_type).toBe('normal');
    expect(backToExpense.to_ledger).toBe('');
    expect(backToExpense.amount).toBe(-500);
    expect(backToExpense.category).toBe('');
    expect(backToExpense.subcategory).toBe('');
  });
});

describe('applyAmountForKind', () => {
  it('enforces sign according to kind', () => {
    expect(applyAmountForKind('expense', '50')).toBe(-50);
    expect(applyAmountForKind('expense', '-50')).toBe(-50);
    expect(applyAmountForKind('income', '-50')).toBe(50);
    expect(applyAmountForKind('transfer', '-100')).toBe(100);
    expect(applyAmountForKind('expense', '')).toBe(0);
  });
});

describe('buildTransactionFromDraft', () => {
  it('builds expense with negative amount', () => {
    const res = buildTransactionFromDraft(baseDraft(), () => 'new_1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.transaction).toMatchObject({
        id: 'new_1',
        amount: -42.5,
        tx_type: 'normal',
        to_ledger: '',
        ledger: 'Default',
        category: '餐饮',
      });
    }
  });

  it('builds income with positive amount', () => {
    const res = buildTransactionFromDraft(
      baseDraft({ kind: 'income', amount: '12000', category: '收入', subcategory: '工资' }),
      () => 'new_2'
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.transaction.amount).toBe(12000);
      expect(res.transaction.tx_type).toBe('normal');
    }
  });

  it('builds transfer with positive amount, empty member, and validates source != target', () => {
    const missingTarget = buildTransactionFromDraft(
      baseDraft({ kind: 'transfer', ledger: 'Default', to_ledger: '' })
    );
    expect(missingTarget.ok).toBe(false);

    const sameLedger = buildTransactionFromDraft(
      baseDraft({ kind: 'transfer', ledger: 'Default', to_ledger: 'Default' })
    );
    expect(sameLedger.ok).toBe(false);

    const valid = buildTransactionFromDraft(
      baseDraft({ kind: 'transfer', ledger: 'Default', to_ledger: '储蓄', amount: '2000', category: '', subcategory: '', member: '荔枝' }),
      () => 'new_3'
    );
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.transaction).toMatchObject({
        id: 'new_3',
        tx_type: 'transfer',
        member: '',
        amount: 2000,
        ledger: 'Default',
        to_ledger: '储蓄',
        category: '转账',
        subcategory: '内部转账',
      });
    }
  });

  it('rejects zero/negative amount, invalid date, missing category, and missing subcategory', () => {
    expect(buildTransactionFromDraft(baseDraft({ amount: '0' })).ok).toBe(false);
    expect(buildTransactionFromDraft(baseDraft({ date: '2026/11/24' })).ok).toBe(false);
    expect(buildTransactionFromDraft(baseDraft({ category: '' })).ok).toBe(false);
    expect(buildTransactionFromDraft(baseDraft({ subcategory: '' })).ok).toBe(false);
    expect(buildTransactionFromDraft(baseDraft({ member: '' })).ok).toBe(false);
  });
});

describe('findInvalidTransfer', () => {
  it('flags missing target, identical ledgers, and zero amount', () => {
    expect(findInvalidTransfer([tx({ tx_type: 'transfer', ledger: 'Default', to_ledger: '', amount: 100 })])).toBeTruthy();
    expect(findInvalidTransfer([tx({ tx_type: 'transfer', ledger: 'Default', to_ledger: 'Default', amount: 100 })])).toBeTruthy();
    expect(findInvalidTransfer([tx({ tx_type: 'transfer', ledger: 'Default', to_ledger: '储蓄', amount: 0 })])).toBeTruthy();
    expect(findInvalidTransfer([tx({ tx_type: 'transfer', ledger: 'Default', to_ledger: '储蓄', amount: 100 })])).toBeNull();
  });
});
