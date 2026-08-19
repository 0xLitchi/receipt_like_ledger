import type { Transaction } from '../types';

const LOCAL_STORAGE_KEY = 'receipt_ledger_transactions_v1';
const AUTH_PASSWORD_KEY = 'receipt_ledger_admin_token';

export interface ActivityLog {
  id: string;
  timestamp: string;
  source: 'web' | 'api' | 'import';
  action: 'create' | 'update' | 'delete' | 'batch_save';
  details: string;
  created_at?: string;
}

export const storage = {
  // 获取所有交易数据
  async getTransactions(): Promise<{ data: Transaction[]; hasFullAccess: boolean }> {
    const adminPassword = this.getSavedAdminPassword() || '';

    const urlObj = new URL(window.location.href);
    const searchParams = new URLSearchParams(urlObj.search);

    searchParams.set('_t', String(Date.now()));
    if (adminPassword) {
      searchParams.set('admin_password', adminPassword);
    }

    const fetchUrl = `/api/transactions?${searchParams.toString()}`;

    try {
      const res = await fetch(fetchUrl, {
        headers: {
          'Cache-Control': 'no-cache, no-store',
          'X-Admin-Password': adminPassword,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return {
            data: json.data,
            hasFullAccess: json.hasFullAccess === true,
          };
        }
      }
    } catch (e) {
      console.warn('API error fetching transactions', e);
    }

    // 本地缓存兜底
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return { data: parsed, hasFullAccess: true };
      } catch (err) {
        console.error('Failed to parse local storage', err);
      }
    }
    return { data: [], hasFullAccess: true };
  },

  // 获取数据变更日志
  async getLogs(): Promise<ActivityLog[]> {
    const adminPassword = this.getSavedAdminPassword() || '';
    if (!adminPassword) return [];

    try {
      const res = await fetch(`/api/logs?admin_password=${encodeURIComponent(adminPassword)}&_t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store',
          'X-Admin-Password': adminPassword,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data;
        }
      }
    } catch (e) {
      console.warn('API error fetching logs', e);
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

  // 高性能增量保存：只对变动的 changedItems 和 deletedIds 发起网络请求！
  async batchSaveTransactions(changedItems: Transaction[], deletedIds: string[]): Promise<boolean> {
    const adminPassword = this.getSavedAdminPassword() || '';

    // 1. 删除变动行
    for (const delId of deletedIds) {
      if (!delId || delId.startsWith('new_') || delId.startsWith('parse_')) continue;
      try {
        await fetch(`/api/transactions/${delId}?admin_password=${encodeURIComponent(adminPassword)}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Password': adminPassword },
        });
      } catch (e) {
        console.warn('Failed to delete transaction ID', delId, e);
      }
    }

    // 2. 增量更新/插入变动行
    for (const item of changedItems) {
      const isNewItem = !item.id || item.id.startsWith('new_') || item.id.startsWith('parse_');

      if (isNewItem) {
        try {
          await fetch(`/api/transactions?admin_password=${encodeURIComponent(adminPassword)}`, {
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
        try {
          await fetch(`/api/transactions/${item.id}?admin_password=${encodeURIComponent(adminPassword)}`, {
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

    return true;
  }
};
