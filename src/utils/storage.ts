import type { Transaction } from '../types';

const LOCAL_STORAGE_KEY = 'receipt_ledger_transactions_v1';
const LEGACY_AUTH_PASSWORD_KEY = 'receipt_ledger_admin_token';
const AUTH_TOKEN_KEY = 'receipt_ledger_admin_session';
const THEME_STYLE_KEY = 'receipt_ledger_theme_style';
const ALL_THEME_STYLES: ThemeStyle[] = ['receipt', 'gameboy', 'wallet', 'tractor'];

export type ThemeStyle = 'receipt' | 'gameboy' | 'wallet' | 'tractor';

export interface ActivityLog {
  id: string;
  timestamp: string;
  source: 'web' | 'api' | 'import';
  action: 'create' | 'update' | 'delete' | 'batch_save';
  details: string;
  created_at?: string;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  message?: string;
}

// 统一的请求头：仅携带会话 token，绝不把密码放进 URL/Header
const authHeaders = (token: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache, no-store',
  };
  if (token) {
    headers['X-Admin-Token'] = token;
  }
  return headers;
};

export const storage = {
  // 获取/设置 UI 界面主题配置
  getThemeStyle(): ThemeStyle {
    return (localStorage.getItem(THEME_STYLE_KEY) as ThemeStyle) || 'receipt';
  },

  setThemeStyle(style: ThemeStyle) {
    localStorage.setItem(THEME_STYLE_KEY, style);
  },

  // 读取服务端持久化的全局主题（管理员配置后所有访客延续）
  async getGlobalThemeStyle(): Promise<ThemeStyle | null> {
    try {
      const res = await fetch(`/api/settings?_t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });
      if (res.ok) {
        const json = await res.json();
        const style = json?.data?.themeStyle;
        if (typeof style === 'string' && (ALL_THEME_STYLES as string[]).includes(style)) {
          return style as ThemeStyle;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch global theme style', e);
    }
    return null;
  },

  // 管理员将主题持久化到服务端
  async setGlobalThemeStyle(style: ThemeStyle): Promise<boolean> {
    const token = this.getAdminToken();
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeStyle: style }),
      });
      if (res.ok) {
        const json = await res.json();
        return json.success === true;
      }
    } catch (e) {
      console.warn('Failed to persist global theme style', e);
    }
    return false;
  },

  // 获取所有交易数据
  async getTransactions(): Promise<{ data: Transaction[]; hasFullAccess: boolean }> {
    const token = this.getAdminToken();

    const urlObj = new URL(window.location.href);
    const searchParams = new URLSearchParams(urlObj.search);
    searchParams.set('_t', String(Date.now()));

    const fetchUrl = `/api/transactions?${searchParams.toString()}`;

    try {
      const res = await fetch(fetchUrl, {
        headers: authHeaders(token),
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

    // 本地缓存兜底：未登录时不信任缓存明文，交给前端脱敏渲染
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        return { data: parsed, hasFullAccess: !!token };
      } catch (err) {
        console.error('Failed to parse local storage', err);
      }
    }
    return { data: [], hasFullAccess: !!token };
  },

  // 获取数据变更日志
  async getLogs(): Promise<ActivityLog[]> {
    const token = this.getAdminToken();
    if (!token) return [];

    try {
      const res = await fetch(`/api/logs?_t=${Date.now()}`, {
        headers: authHeaders(token),
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

  // 验证管理员密码，成功后服务端签发会话 token（仅 token 落本地存储）
  async verifyAdminPassword(password: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const json = (await res.json()) as AuthResponse;
        if (json.success && json.token) {
          localStorage.setItem(AUTH_TOKEN_KEY, json.token);
          localStorage.removeItem(LEGACY_AUTH_PASSWORD_KEY);
          return true;
        }
      }
    } catch (e) {
      console.warn('Auth API failed', e);
    }
    return false;
  },

  // 读取会话 token；同时清理旧版明文密码缓存（旧会话失效需重新登录）
  getAdminToken(): string | null {
    const legacy = localStorage.getItem(LEGACY_AUTH_PASSWORD_KEY);
    if (legacy) {
      localStorage.removeItem(LEGACY_AUTH_PASSWORD_KEY);
    }
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  // 登出：通知服务端删除会话，并清除本地 token
  async logoutAdmin(): Promise<void> {
    const token = this.getAdminToken();
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_AUTH_PASSWORD_KEY);
    if (!token) return;

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
      });
    } catch (e) {
      console.warn('Logout API failed (local session cleared anyway)', e);
    }
  },

  // 高性能增量保存
  async batchSaveTransactions(changedItems: Transaction[], deletedIds: string[]): Promise<boolean> {
    const token = this.getAdminToken();

    for (const delId of deletedIds) {
      if (!delId || delId.startsWith('new_') || delId.startsWith('parse_')) continue;
      try {
        await fetch(`/api/transactions/${delId}`, {
          method: 'DELETE',
          headers: authHeaders(token),
        });
      } catch (e) {
        console.warn('Failed to delete transaction ID', delId, e);
      }
    }

    for (const item of changedItems) {
      const isNewItem = !item.id || item.id.startsWith('new_') || item.id.startsWith('parse_');

      if (isNewItem) {
        try {
          await fetch(`/api/transactions`, {
            method: 'POST',
            headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...item, id: undefined }),
          });
        } catch (e) {
          console.warn('Failed to insert new item', e);
        }
      } else {
        try {
          await fetch(`/api/transactions/${item.id}`, {
            method: 'PUT',
            headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
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
