import type {
  ActivityLog,
  ApiRequestLog,
  AppSettings,
  ThemeStyle,
  Transaction,
} from '../types';

/** localStorage 中保存管理员会话 token 的键名 */
const TOKEN_STORAGE_KEY = 'receipt_ledger_admin_token';
/** localStorage 中保存 URL 访问令牌的键名（?token= 首次访问后落盘） */
const ACCESS_TOKEN_KEY = 'receipt_ledger_access_token';

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      /* localStorage 不可用时静默降级为匿名访问 */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* noop */
    }
  },
  /** 是否已通过密码换到会话令牌（可以进入后台） */
  hasSession(): boolean {
    return !!tokenStore.get();
  },

  /** 是否能读到明文：会话令牌，或 URL 上的访问令牌 */
  has(): boolean {
    return tokenStore.hasSession() || !!readUrlCredential('admin_token') || !!urlAccessToken();
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  hasFullAccess?: boolean;
}

/**
 * 页面 URL 上的令牌参数。
 * 支持老式 `?token=` / `?access_token=` 直接访问（服务端把它当作 ACCESS_TOKEN 校验），
 * 也兼容 `?admin_token=` 形式的会话令牌。
 */
function readUrlCredential(name: 'token' | 'access_token' | 'admin_token'): string {
  try {
    return new URLSearchParams(window.location.search).get(name)?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * 访问令牌：优先取地址栏，其次取已落盘的副本。
 * `?token=` 只在首次访问时出现，之后即便地址栏被浏览器/App 抹掉也能继续读到明文。
 */
export function urlAccessToken(): string {
  const fromUrl = readUrlCredential('token') || readUrlCredential('access_token');
  if (fromUrl) {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, fromUrl);
    } catch {
      /* 隐私模式下不可写，忽略 */
    }
    return fromUrl;
  }
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** 是否携带管理员 token（默认携带） */
  auth?: boolean;
  /** 附加查询参数 */
  query?: Record<string, string | undefined>;
}

/**
 * 统一的 API 请求入口：注入 X-Admin-Token、解包 { success, data }、统一抛错。
 * 所有写接口优先使用会话 token，不再把密码拼进 URL。
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { method = 'GET', body, auth = true, query } = options;

  const url = new URL(path, window.location.origin);
  url.searchParams.set('_t', String(Date.now()));

  // 把页面 URL 上的令牌参数透传给 API，保持 `?token=xxx` 直接访问的老用法可用
  const accessToken = auth ? urlAccessToken() : '';
  if (accessToken) url.searchParams.set('token', accessToken);
  const adminTokenParam = auth ? readUrlCredential('admin_token') : '';
  if (adminTokenParam) url.searchParams.set('admin_token', adminTokenParam);

  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    });
  }

  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache, no-store',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = auth ? tokenStore.get() || adminTokenParam : null;
  if (token) headers['X-Admin-Token'] = token;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('网络请求失败，请检查连接后重试', 0);
  }

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    json = null;
  }

  if (!res.ok || !json) {
    const message = json?.message || json?.error || `请求失败 (HTTP ${res.status})`;
    throw new ApiError(message, res.status);
  }

  return json;
}

/* ------------------------------------------------------------------ */
/* 认证                                                                */
/* ------------------------------------------------------------------ */

export async function verifyAdmin(password: string): Promise<boolean> {
  const json = await request<unknown>('/api/auth/verify', {
    method: 'POST',
    body: { password },
    auth: false,
  });

  // 服务端在顶层返回会话 token：{ success: true, token: "sess_..." }
  const envelope = json as { token?: string } | null;
  const token = envelope && typeof envelope.token === 'string' ? envelope.token : undefined;
  if (json.success === true && token) tokenStore.set(token);
  return json.success === true;
}

export async function logoutAdmin(): Promise<void> {
  try {
    if (tokenStore.get()) {
      await request('/api/auth/logout', { method: 'POST' });
    }
  } catch {
    /* 注销失败不影响本地清理 */
  } finally {
    tokenStore.clear();
  }
}

/* ------------------------------------------------------------------ */
/* 交易                                                                */
/* ------------------------------------------------------------------ */

export interface TransactionsResult {
  data: Transaction[];
  hasFullAccess: boolean;
}

export async function fetchTransactions(): Promise<TransactionsResult> {
  const json = await request<Transaction[]>('/api/transactions');
  return {
    data: Array.isArray(json.data) ? json.data : [],
    hasFullAccess: json.hasFullAccess === true,
  };
}

export async function createTransaction(item: Transaction): Promise<void> {
  await request('/api/transactions', {
    method: 'POST',
    body: { ...item, id: undefined },
  });
}

export async function updateTransaction(item: Transaction): Promise<void> {
  await request(`/api/transactions/${encodeURIComponent(item.id)}`, {
    method: 'PUT',
    body: item,
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  await request(`/api/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** 批量落库：先删后写，逐条执行并汇总失败数 */
export async function batchSaveTransactions(
  changedItems: Transaction[],
  deletedIds: string[]
): Promise<{ failed: number }> {
  let failed = 0;

  for (const delId of deletedIds) {
    if (!delId || delId.startsWith('new_') || delId.startsWith('parse_')) continue;
    try {
      await deleteTransaction(delId);
    } catch {
      failed += 1;
    }
  }

  for (const item of changedItems) {
    const isNew = !item.id || item.id.startsWith('new_') || item.id.startsWith('parse_');
    try {
      if (isNew) await createTransaction(item);
      else await updateTransaction(item);
    } catch {
      failed += 1;
    }
  }

  return { failed };
}

/* ------------------------------------------------------------------ */
/* 设置                                                                */
/* ------------------------------------------------------------------ */

export async function fetchSettings(): Promise<AppSettings> {
  try {
    const json = await request<AppSettings>('/api/settings', { auth: false });
    const style = json.data?.theme_style;
    return { theme_style: style === 'receipt' ? style : 'receipt' };
  } catch {
    return { theme_style: 'receipt' };
  }
}

export async function updateThemeStyle(value: ThemeStyle): Promise<void> {
  await request('/api/settings', {
    method: 'PUT',
    body: { theme_style: value },
  });
}

/* ------------------------------------------------------------------ */
/* 日志                                                                */
/* ------------------------------------------------------------------ */

export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  const json = await request<ActivityLog[]>('/api/logs');
  return Array.isArray(json.data) ? json.data : [];
}

export async function fetchApiLogs(): Promise<ApiRequestLog[]> {
  const json = await request<ApiRequestLog[]>('/api/api-logs');
  return Array.isArray(json.data) ? json.data : [];
}
