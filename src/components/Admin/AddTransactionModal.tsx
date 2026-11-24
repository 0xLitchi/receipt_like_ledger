import React, { useEffect, useMemo, useState } from 'react';
import type { Transaction } from '../../types';
import {
  ADMIN_TX_KIND_LABELS,
  buildTransactionFromDraft,
  type AdminTxKind,
  type NewTransactionDraft,
} from '../../features/admin/transaction-form';
import { normalizeLedgerName } from '../../features/ledger/use-ledger';
import { PlatinumWindow } from '../Platinum/PlatinumChrome';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRows: Transaction[];
  availableLedgers: string[];
  onAdd: (tx: Transaction) => void;
}

const getTodayStr = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const createInitialDraft = (defaultMember: string, defaultToLedger: string): NewTransactionDraft => ({
  kind: 'expense',
  date: getTodayStr(),
  amount: '',
  member: defaultMember,
  category: '',
  subcategory: '',
  title: '',
  ledger: 'Default',
  to_ledger: defaultToLedger,
});

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  existingRows,
  availableLedgers,
  onAdd,
}) => {
  const { members, categories, subcategoriesByCategory } = useMemo(() => {
    const memberSet = new Set<string>(['荔枝', '扶正']);
    const catSet = new Set<string>();
    const subMap = new Map<string, Set<string>>();

    existingRows.forEach((r) => {
      if (r.member?.trim()) memberSet.add(r.member.trim());
      const cat = r.category?.trim();
      if (cat && cat !== '转账') {
        catSet.add(cat);
        const sub = r.subcategory?.trim();
        if (sub) {
          const set = subMap.get(cat) ?? new Set<string>();
          set.add(sub);
          subMap.set(cat, set);
        }
      }
    });

    const subcategoriesObj: Record<string, string[]> = {};
    subMap.forEach((set, cat) => {
      subcategoriesObj[cat] = Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    });

    return {
      members: Array.from(memberSet).sort((a, b) => a.localeCompare(b, 'zh-CN')),
      categories: Array.from(catSet).sort((a, b) => a.localeCompare(b, 'zh-CN')),
      subcategoriesByCategory: subcategoriesObj,
    };
  }, [existingRows]);

  const defaultToLedger = useMemo(
    () => availableLedgers.find((l) => l !== 'Default') || '',
    [availableLedgers]
  );

  const [draft, setDraft] = useState<NewTransactionDraft>(() =>
    createInitialDraft('荔枝', defaultToLedger)
  );
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(createInitialDraft('荔枝', defaultToLedger));
    setError(null);
    setAddedCount(0);
  }, [isOpen, defaultToLedger]);

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

  const isTransfer = draft.kind === 'transfer';
  const subcategorySuggestions = subcategoriesByCategory[draft.category.trim()] ?? [];

  const handleKindChange = (nextKind: AdminTxKind) => {
    setError(null);
    setDraft((prev) => {
      if (nextKind === 'transfer') {
        const from = normalizeLedgerName(prev.ledger);
        const fallbackTo =
          prev.to_ledger && prev.to_ledger !== from
            ? prev.to_ledger
            : availableLedgers.find((l) => l !== from) || '';
        return {
          ...prev,
          kind: 'transfer',
          ledger: from,
          to_ledger: fallbackTo,
          category: '转账',
          subcategory: '',
        };
      }
      return {
        ...prev,
        kind: nextKind,
        category: prev.category === '转账' ? '' : prev.category,
        to_ledger: prev.to_ledger,
      };
    });
  };

  const handleSwapTransferLedgers = () => {
    setError(null);
    setDraft((prev) => ({
      ...prev,
      ledger: prev.to_ledger.trim() || 'Default',
      to_ledger: normalizeLedgerName(prev.ledger),
    }));
  };

  const submitDraft = (keepOpen: boolean) => {
    const result = buildTransactionFromDraft(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    onAdd(result.transaction);
    setError(null);

    if (keepOpen) {
      setAddedCount((c) => c + 1);
      setDraft((prev) => ({
        ...prev,
        amount: '',
        title: '',
      }));
    } else {
      onClose();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitDraft(false);
  };

  const amountPrefix =
    draft.kind === 'expense' ? '-￥' : draft.kind === 'income' ? '+￥' : '⇄ ￥';
  const amountColor =
    draft.kind === 'expense'
      ? 'var(--expense)'
      : draft.kind === 'income'
      ? 'var(--income)'
      : 'var(--transfer)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 65,
        background: 'rgba(38, 38, 38, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ width: '100%', maxWidth: 460 }}>
        <PlatinumWindow title="新增交易记录 · Add Transaction" onClose={onClose} closeTitle="关闭">
          <form onSubmit={handleFormSubmit}>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* 类型三态切换 */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4, color: '#333' }}>
                  交易类型
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['expense', 'income', 'transfer'] as AdminTxKind[]).map((k) => {
                    const active = draft.kind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        className={`pt-btn${active ? ' on' : ''}`}
                        style={{ flex: 1 }}
                        aria-pressed={active}
                        onClick={() => handleKindChange(k)}
                      >
                        {ADMIN_TX_KIND_LABELS[k]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 日期 + 金额 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>日期 *</span>
                  <input
                    type="date"
                    className="pt-input"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                    value={draft.date}
                    onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
                    required
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>
                    金额 *{' '}
                    <span style={{ fontFamily: 'var(--font-mono)', color: amountColor }}>
                      ({amountPrefix})
                    </span>
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="输入正数金额"
                    className="pt-input"
                    style={{
                      width: '100%',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 'bold',
                      color: amountColor,
                    }}
                    value={draft.amount}
                    onChange={(e) => {
                      setError(null);
                      setDraft((p) => ({ ...p, amount: e.target.value }));
                    }}
                    autoFocus
                    required
                  />
                </label>
              </div>

              {/* 转账模式：转出账本 <-> 转入账本 */}
              {isTransfer ? (
                <div
                  style={{
                    padding: '8px 10px',
                    background: '#eef0ff',
                    border: '1px solid #b8bce8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--transfer)' }}>
                    账本间转账路径（不计入收支净额）
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 1fr',
                      alignItems: 'end',
                      gap: 6,
                    }}
                  >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>
                        转出账本 *
                      </span>
                      <input
                        type="text"
                        list="admin-modal-ledger-options"
                        className="pt-input"
                        style={{ width: '100%' }}
                        value={draft.ledger}
                        placeholder="Default"
                        onChange={(e) => {
                          setError(null);
                          setDraft((p) => ({ ...p, ledger: e.target.value }));
                        }}
                        required
                      />
                    </label>

                    <button
                      type="button"
                      className="pt-btn compact"
                      title="互换转出与转入账本"
                      aria-label="互换转出与转入账本"
                      onClick={handleSwapTransferLedgers}
                      style={{ marginBottom: 1 }}
                    >
                      ⇄
                    </button>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>
                        转入账本 *
                      </span>
                      <input
                        type="text"
                        list="admin-modal-ledger-options"
                        className="pt-input"
                        style={{ width: '100%', color: 'var(--transfer)' }}
                        value={draft.to_ledger}
                        placeholder="目标账本（如 储蓄）"
                        onChange={(e) => {
                          setError(null);
                          setDraft((p) => ({ ...p, to_ledger: e.target.value }));
                        }}
                        required
                      />
                    </label>
                  </div>
                </div>
              ) : (
                /* 收支模式：主分类 + 子分类 + 所属账本 */
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>主分类 *</span>
                      <input
                        type="text"
                        list="admin-modal-category-options"
                        className="pt-input"
                        style={{ width: '100%' }}
                        placeholder={draft.kind === 'income' ? '如：收入 / 杂项' : '如：餐饮 / 住房 / 账单'}
                        value={draft.category}
                        onChange={(e) => {
                          setError(null);
                          setDraft((p) => ({ ...p, category: e.target.value }));
                        }}
                        required
                      />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>子分类</span>
                      <input
                        type="text"
                        list="admin-modal-subcategory-options"
                        className="pt-input"
                        style={{ width: '100%' }}
                        placeholder="选填（如：午餐 / 麻将）"
                        value={draft.subcategory}
                        onChange={(e) => setDraft((p) => ({ ...p, subcategory: e.target.value }))}
                      />
                    </label>
                  </div>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>所属账本</span>
                    <input
                      type="text"
                      list="admin-modal-ledger-options"
                      className="pt-input"
                      style={{ width: '100%' }}
                      placeholder="Default"
                      value={draft.ledger}
                      onChange={(e) => setDraft((p) => ({ ...p, ledger: e.target.value }))}
                    />
                  </label>
                </>
              )}

              {/* 成员 + 备注 */}
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>成员 *</span>
                  <input
                    type="text"
                    list="admin-modal-member-options"
                    className="pt-input"
                    style={{ width: '100%' }}
                    value={draft.member}
                    onChange={(e) => {
                      setError(null);
                      setDraft((p) => ({ ...p, member: e.target.value }));
                    }}
                    required
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 'bold', color: '#333' }}>备注</span>
                  <input
                    type="text"
                    className="pt-input"
                    style={{ width: '100%' }}
                    placeholder={isTransfer ? '如：月度定存 / 还款调拨' : '选填备注说明'}
                    value={draft.title}
                    onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                  />
                </label>
              </div>

              {error && (
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
                  {error}
                </div>
              )}

              {addedCount > 0 && !error && (
                <div
                  style={{
                    padding: '5px 8px',
                    background: '#dcfce7',
                    border: '1px solid #166534',
                    color: '#166534',
                    fontSize: 11,
                  }}
                >
                  已加入待保存列表 {addedCount} 条，可继续填写或关闭后点击「保存变动」统一提交。
                </div>
              )}

              <datalist id="admin-modal-member-options">
                {members.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <datalist id="admin-modal-category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <datalist id="admin-modal-subcategory-options">
                {subcategorySuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <datalist id="admin-modal-ledger-options">
                {availableLedgers.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>

            <div className="pt-statusbar" style={{ padding: '8px 12px', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="pt-btn" onClick={onClose}>
                取消
              </button>
              <button type="button" className="pt-btn" onClick={() => submitDraft(true)}>
                加入并继续
              </button>
              <button type="submit" className="pt-btn primary">
                确认加入列表
              </button>
            </div>
          </form>
        </PlatinumWindow>
      </div>
    </div>
  );
};
