import type { Transaction } from '../types';
import { INITIAL_DEMO_DATA } from './demoData';

const LOCAL_STORAGE_KEY = 'receipt_ledger_transactions_v1';
const AUTH_PASSWORD_KEY = 'receipt_ledger_admin_token';

export const storage = {
  // 获取所有交易
  async getTransactions(): Promise<Transaction[]> {
    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch (e) {
      console.warn('API error, using LocalStorage fallback', e);
    }

    // 尝试 LocalStorage 缓存
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (err) {
        console.error('Failed to parse local storage', err);
      }
    }

    // 初始化为 Demo 数据并存入 LocalStorage
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_DATA));
    return INITIAL_DEMO_DATA;
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
      console.warn('Auth API failed, falling back to dev mode password check', e);
    }

    // 开发/离线备用验证 (若未能接入 D1 函数，默认支持客户端输入 admin)
    if (password === 'admin' || password === '123456') {
      localStorage.setItem(AUTH_PASSWORD_KEY, password);
      return true;
    }
    return false;
  },

  // 获取离线/缓存的 Token/Password Header
  getSavedAdminPassword(): string | null {
    return localStorage.getItem(AUTH_PASSWORD_KEY);
  },

  // 清除管理员登录标记
  logoutAdmin() {
    localStorage.removeItem(AUTH_PASSWORD_KEY);
  },

  // 保存/新增交易
  async addTransaction(item: Omit<Transaction, 'id'>): Promise<Transaction> {
    const newTx: Transaction = {
      ...item,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };

    const adminPassword = this.getSavedAdminPassword() || '';

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword,
        },
        body: JSON.stringify(newTx),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          return json.data;
        }
      }
    } catch (e) {
      console.warn('API error saving transaction to D1', e);
    }

    // LocalStorage Fallback
    const current = await this.getTransactions();
    const updated = [newTx, ...current];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return newTx;
  },

  // 更新交易
  async updateTransaction(item: Transaction): Promise<boolean> {
    const adminPassword = this.getSavedAdminPassword() || '';

    try {
      const res = await fetch(`/api/transactions/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword,
        },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return true;
      }
    } catch (e) {
      console.warn('API update failed', e);
    }

    // LocalStorage Fallback
    const current = await this.getTransactions();
    const updated = current.map((t) => (t.id === item.id ? item : t));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return true;
  },

  // 删除交易
  async deleteTransaction(id: string): Promise<boolean> {
    const adminPassword = this.getSavedAdminPassword() || '';

    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: {
          'X-Admin-Password': adminPassword,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) return true;
      }
    } catch (e) {
      console.warn('API delete failed', e);
    }

    // LocalStorage Fallback
    const current = await this.getTransactions();
    const updated = current.filter((t) => t.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return true;
  },

  // 重置恢复 Demo 数据
  async resetToDemo(): Promise<Transaction[]> {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_DATA));
    return INITIAL_DEMO_DATA;
  }
};
