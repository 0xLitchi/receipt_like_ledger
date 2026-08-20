import type { Transaction } from '../types';

const LOCAL_STORAGE_KEY = 'receipt_ledger_transactions_v1';
const AUTH_PASSWORD_KEY = 'receipt_ledger_admin_token';
const THEME_STYLE_KEY = 'receipt_ledger_theme_style';

export type ThemeStyle = 'receipt' | 'tractor';

export interface ActivityLog {
  id: string;
  timestamp: string;
  source: 'web' | 'api' | 'import';
  action: 'create' | 'update' | 'delete' | 'batch_save';
  details: string;
  created_at?: string;
}

export interface ApiRequestLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status_code: number;
  success: number | boolean;
  ip_address: string;
  user_agent: string;
  token_used: string;
  payload_summary: string;
  execution_ms: number;
  created_at?: string;
}

export const storage = {
  // 获取/设置 UI 界面主题配置
  getThemeStyle(): ThemeStyle {
    return (localStorage.getItem(THEME_STYLE_KEY) as ThemeStyle) || 'receipt';
  },

  setThemeStyle(style: ThemeStyle) {
    localStorage.setItem(THEME_STYLE_KEY, style);
  },

  // 从服务端拉取全局设置
  async fetchSettings(): Promise<{ themeStyle: ThemeStyle }> {
    try {
      const res = await fetch(`/api/settings?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const themeStyle = (json.data.theme_style as ThemeStyle) || 'receipt';
          this.setThemeStyle(themeStyle);
          return { themeStyle };
        }
      }
    } catch (e) {
      console.warn('API error fetching settings', e);
    }
    return {
      themeStyle: this.getThemeStyle(),
    };
  },

  // 保存设置到服务端
  async updateSetting(key: 'theme_style', value: string): Promise<boolean> {
    const adminPassword = this.getSavedAdminPassword() || '';
    try {
      const res = await fetch(`/api/settings?admin_password=${encodeURIComponent(adminPassword)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword,
        },
        body: JSON.stringify({ [key]: value }),
      });
      if (res.ok) {
        const json = await res.json();
        return json.success === true;
      }
    } catch (e) {
      console.warn('API error updating setting', key, e);
    }
    return false;
  },

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

  // 获取 API 请求调用日志 (Req Log)
  async getApiLogs(): Promise<ApiRequestLog[]> {
    const adminPassword = this.getSavedAdminPassword() || '';
    if (!adminPassword) return [];

    try {
      const res = await fetch(`/api/api-logs?admin_password=${encodeURIComponent(adminPassword)}&_t=${Date.now()}`, {
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
      console.warn('API error fetching API logs', e);
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

  // 高性能增量保存
  async batchSaveTransactions(changedItems: Transaction[], deletedIds: string[]): Promise<boolean> {
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
