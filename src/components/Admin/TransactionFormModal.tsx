import React, { useState, useEffect } from 'react';
import type { Transaction } from '../../types';
import { X, PlusCircle, Save } from 'lucide-react';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (t: Transaction | Omit<Transaction, 'id'>) => void;
  initialData?: Transaction | null;
}

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    type: 'EXPENSE', // EXPENSE | INCOME
    member: '荔枝',
    category: '杂项',
    subcategory: '',
    ledger: 'Default',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        date: initialData.date || new Date().toISOString().split('T')[0],
        amount: String(Math.abs(initialData.amount)),
        type: initialData.amount >= 0 ? 'INCOME' : 'EXPENSE',
        member: initialData.member || '荔枝',
        category: initialData.category || '杂项',
        subcategory: initialData.subcategory || '',
        ledger: initialData.ledger || 'Default',
      });
    } else {
      setFormData({
        title: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        type: 'EXPENSE',
        member: '荔枝',
        category: '杂项',
        subcategory: '',
        ledger: 'Default',
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmt = parseFloat(formData.amount);
    if (isNaN(rawAmt) || rawAmt === 0) {
      alert('请输入有效的金额');
      return;
    }

    const finalAmount = formData.type === 'EXPENSE' ? -Math.abs(rawAmt) : Math.abs(rawAmt);

    const payload = {
      title: formData.title.trim(),
      date: formData.date,
      amount: finalAmount,
      member: formData.member.trim() || '通用',
      category: formData.category.trim() || '其它',
      subcategory: formData.subcategory.trim(),
      ledger: formData.ledger.trim() || 'Default',
    };

    if (initialData?.id) {
      onSave({ ...payload, id: initialData.id });
    } else {
      onSave(payload);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm no-print">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl text-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          {initialData ? <Save className="w-5 h-5 text-indigo-400" /> : <PlusCircle className="w-5 h-5 text-emerald-400" />}
          {initialData ? '修改记账条目' : '新增记账条目'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 类型与金额 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">交易类型</label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-800 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
                  className={`py-1.5 rounded-md font-bold transition-colors ${
                    formData.type === 'EXPENSE'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  支出 (-)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'INCOME' })}
                  className={`py-1.5 rounded-md font-bold transition-colors ${
                    formData.type === 'INCOME'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  收入 (+)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">金额 (￥)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 备注名称 */}
          <div>
            <label className="block text-slate-400 mb-1">备注 / 说明名称 (选填)</label>
            <input
              type="text"
              placeholder="如：小雅退押金、扶正麻将、等"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* 日期 & 关联人员 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">日期</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">关联成员</label>
              <input
                type="text"
                required
                placeholder="如：荔枝 / 扶正"
                value={formData.member}
                onChange={(e) => setFormData({ ...formData, member: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 主分类与子分类 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">主分类</label>
              <input
                type="text"
                required
                placeholder="如：住房、杂项、账单"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">子分类 (选填)</label>
              <input
                type="text"
                placeholder="如：押金、麻将、招商银行"
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow"
            >
              保存交易
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
