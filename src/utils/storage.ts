import type { Transaction } from '../types';

const LOCAL_STORAGE_KEY = 'receipt_ledger_transactions_v1';
const AUTH_PASSWORD_KEY = 'receipt_ledger_admin_token';

export const storage = {
  // 获取所有交易数据 (拼接时间戳 _t 防止浏览器 HTTP 缓存脱敏 Response)
  async getTransactions(): Promise<{ data: Transaction[]; hasFullAccess: boolean }> {
    const search = window.location.search;
    const adminPassword = this.getSavedAdminPassword() || '';

    // 拼接防缓存时间戳参数 _t
    const sep = search ? '&' : '?';
    const fetchUrl = `/api/transactions${search}${sep}_t=${Date.now()}`;

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
          // 只要具备有效的管理员密码，或者后端返回 hasFullAccess === true，均为解密状态！
          const hasAccess = !!adminPassword || json.hasFullAccess !== false;
          return {
            data: json.data,
            hasFullAccess: hasAccess,
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

  // Excel 批量保存接口逻辑
  async batchSaveTransactions(items: Transaction[], deletedIds: string[]): Promise<boolean> {
    const adminPassword = this.getSavedAdminPassword() || '';

    for (const delId of deletedIds) {
      if (!delId || delId.startsWith('new_') || delId.startsWith('parse_')) continue;
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
      const isNewItem = !item.id || item.id.startsWith('new_') || item.id.startsWith('parse_');

      if (isNewItem) {
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

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    return true;
  }
};
