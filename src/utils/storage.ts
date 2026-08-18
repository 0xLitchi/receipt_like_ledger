import type { Transaction } from '../types';

const LOCAL_STORAGE_KEY = 'receipt_ledger_transactions_v1';
const AUTH_PASSWORD_KEY = 'receipt_ledger_admin_token';

export const storage = {
  // 获取所有交易数据
  async getTransactions(): Promise<Transaction[]> {
    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch (e) {
      console.warn('API error fetching transactions', e);
    }

    // 本地缓存兜底
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (err) {
        console.error('Failed to parse local storage', err);
      }
    }
    return [];
  },

  // 验证管理员密码
  async verifyAdminPassword(password: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          localStorage.setItem(AUTH_PASSWORD_KEY, password);
          return true;
        }
      }
    } catch (e) {
      console.warn('Auth API failed', e);
    }
    return false;
  },

  getSavedAdminPassword(): string | null {
    return localStorage.getItem(AUTH_PASSWORD_KEY);
  },

  logoutAdmin() {
    localStorage.removeItem(AUTH_PASSWORD_KEY);
  },

  // 5. Excel 批量保存接口逻辑
  async batchSaveTransactions(items: Transaction[], deletedIds: string[]): Promise<boolean> {
    const adminPassword = this.getSavedAdminPassword() || '';

    // 逐条保存/新增与删除
    for (const delId of deletedIds) {
      try {
        await fetch(`/api/transactions/${delId}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Password': adminPassword },
        });
      } catch (e) {
        console.warn('Failed to delete transaction ID', delId, e);
      }
    }

    for (const item of items) {
      if (item.id.startsWith('new_')) {
        // 新行：POST 新增
        try {
          await fetch('/api/transactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Admin-Password': adminPassword,
            },
            body: JSON.stringify({ ...item, id: undefined }),
          });
        } catch (e) {
          console.warn('Failed to insert new item', e);
        }
      } else {
        // 已有行：PUT 更新
        try {
          await fetch(`/api/transactions/${item.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Admin-Password': adminPassword,
            },
            body: JSON.stringify(item),
          });
        } catch (e) {
          console.warn('Failed to update item', item.id, e);
        }
      }
    }

    // 更新 LocalStorage 兜底
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    return true;
  }
};
