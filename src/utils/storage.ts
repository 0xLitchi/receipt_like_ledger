import type { Transaction } from '../types';

const LOCAL_STORAGE_KEY = 'receipt_ledger_transactions_v1';
const AUTH_PASSWORD_KEY = 'receipt_ledger_admin_token';

export const storage = {
  // 获取所有交易数据 (同时通过 URL Query 参数与 Header 传递 admin_password，彻底避免鉴权丢失)
  async getTransactions(): Promise<{ data: Transaction[]; hasFullAccess: boolean }> {
    const adminPassword = this.getSavedAdminPassword() || '';

    // 构造请求 URL，同时带上防缓存 _t 与 admin_password
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
            // 服务端鉴权成功返回 true 时即可全面解锁解密数据
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
        await fetch(`/api/transactions/${delId}?admin_password=${encodeURIComponent(adminPassword)}`, {
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

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    return true;
  }
};
