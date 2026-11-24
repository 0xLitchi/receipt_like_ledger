// Pages Functions 共享工具模块：密钥清洗、CORS 白名单、活动日志、管理员会话、API 请求日志、类型约束

export interface SharedEnv {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
  ACCESS_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
  DB_TABLE_PREFIX?: string;
}

export interface TableNames {
  prefix: string;
  transactions: string;
  activityLogs: string;
  apiRequestLogs: string;
  adminSessions: string;
  appSettings: string;
}

const SAFE_TABLE_PREFIX_RE = /^[a-z][a-z0-9_]{0,15}$/i;

export const resolveTablePrefix = (rawPrefix?: string | null): string => {
  const cleaned = cleanSecretString(rawPrefix);
  if (!cleaned) return '';
  return SAFE_TABLE_PREFIX_RE.test(cleaned) ? cleaned : '';
};

export const getTableNames = (env?: Pick<SharedEnv, 'DB_TABLE_PREFIX'>): TableNames => {
  const prefix = resolveTablePrefix(env?.DB_TABLE_PREFIX);
  return {
    prefix,
    transactions: `${prefix}transactions`,
    activityLogs: `${prefix}activity_logs`,
    apiRequestLogs: `${prefix}api_request_logs`,
    adminSessions: `${prefix}admin_sessions`,
    appSettings: `${prefix}app_settings`,
  };
};

export interface TransactionRow {
  id: string;
  title: string;
  date: string;
  amount: number;
  member: string;
  category: string;
  subcategory: string;
  ledger: string;
  tx_type?: 'normal' | 'transfer';
  to_ledger?: string;
  created_at?: string;
}

export interface ApiRequestLogRow {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status_code: number;
  success: number;
  ip_address: string;
  user_agent: string;
  token_used: string;
  payload_summary: string;
  execution_ms: number;
  created_at?: string;
}

// 剥离换行符 (\r, \n)、制表符、多余空格及引号
export const cleanSecretString = (str?: string | null): string => {
  if (!str) return '';
  return str.replace(/[\r\n\t\s"']/g, '').trim();
};

// 读取 Client IP (支持 Cloudflare cf-connecting-ip)
export const getClientIp = (request: Request): string => {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
};

// 读取管理员身份凭证（Header 优先，Query 仅兼容旧调用方）
export const readAdminCredentials = (request: Request, url: URL): string => {
  const rawAdminPass =
    request.headers.get('X-Admin-Password') ||
    request.headers.get('x-admin-password') ||
    url.searchParams.get('admin_password') ||
    url.searchParams.get('password');
  return cleanSecretString(rawAdminPass);
};

// 读取 Authorization: Bearer <TOKEN>
export const readBearerToken = (request: Request): string => {
  const authHeaderRaw =
    request.headers.get('Authorization') || request.headers.get('authorization') || '';
  if (authHeaderRaw.toLowerCase().startsWith('bearer ')) {
    return cleanSecretString(authHeaderRaw.substring(7));
  }
  return '';
};

// CORS：仅放行 ALLOWED_ORIGINS 白名单域名；同源请求无需 CORS 头
export const getCorsHeaders = (request: Request, env: SharedEnv): Record<string, string> => {
  const origin = request.headers.get('Origin');
  if (!origin) return {};

  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Password, X-Admin-Token',
    };
  }
  return {};
};

// 活动日志表（数据变更审计，幂等建表）
export const ensureActivityLogsTable = async (
  db: D1Database,
  env?: Pick<SharedEnv, 'DB_TABLE_PREFIX'>
): Promise<void> => {
  const { activityLogs } = getTableNames(env);
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS ${activityLogs} (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
};

export const recordActivityLog = async (
  db: D1Database,
  source: 'web' | 'api' | 'import',
  action: 'create' | 'update' | 'delete' | 'batch_save',
  details: string,
  env?: Pick<SharedEnv, 'DB_TABLE_PREFIX'>
): Promise<void> => {
  try {
    await ensureActivityLogsTable(db, env);
    const { activityLogs } = getTableNames(env);
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    await db.prepare(
      `INSERT INTO ${activityLogs} (id, timestamp, source, action, details) VALUES (?, ?, ?, ?, ?)`
    ).bind(id, timestamp, source, action, details).run();
  } catch (e) {
    console.warn('Failed to record log', e);
  }
};

// API 请求日志表 (Req Log 幂等建表)
export const ensureApiRequestLogsTable = async (
  db: D1Database,
  env?: Pick<SharedEnv, 'DB_TABLE_PREFIX'>
): Promise<void> => {
  const { apiRequestLogs } = getTableNames(env);
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS ${apiRequestLogs} (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      method TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      success INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      token_used TEXT,
      payload_summary TEXT,
      execution_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
};

export const recordApiRequestLog = async (
  db: D1Database | undefined,
  logData: {
    method: string;
    endpoint: string;
    statusCode: number;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    tokenUsed?: string;
    payloadSummary?: string;
    executionMs?: number;
  },
  env?: Pick<SharedEnv, 'DB_TABLE_PREFIX'>
): Promise<void> => {
  if (!db) return;
  try {
    await ensureApiRequestLogsTable(db, env);
    const { apiRequestLogs } = getTableNames(env);
    const id = `apilog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    const tokenMasked = logData.tokenUsed
      ? (logData.tokenUsed.length > 6 ? `${logData.tokenUsed.substring(0, 3)}***` : '***')
      : 'none';

    await db.prepare(
      `INSERT INTO ${apiRequestLogs}
       (id, timestamp, method, endpoint, status_code, success, ip_address, user_agent, token_used, payload_summary, execution_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      timestamp,
      logData.method,
      logData.endpoint,
      logData.statusCode,
      logData.success ? 1 : 0,
      logData.ipAddress || 'unknown',
      logData.userAgent || 'unknown',
      tokenMasked,
      logData.payloadSummary || '',
      logData.executionMs || 0
    ).run();
  } catch (e) {
    console.warn('Failed to record API request log', e);
  }
};

// 管理员会话表（幂等建表）
export const ensureAdminSessionsTable = async (
  db: D1Database,
  env?: Pick<SharedEnv, 'DB_TABLE_PREFIX'>
): Promise<void> => {
  const { adminSessions } = getTableNames(env);
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS ${adminSessions} (
      token TEXT PRIMARY KEY,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
};

// 校验会话 token 是否有效
export const isValidSessionToken = async (
  db: D1Database,
  token: string,
  env?: Pick<SharedEnv, 'DB_TABLE_PREFIX'>
): Promise<boolean> => {
  if (!token) return false;
  try {
    await ensureAdminSessionsTable(db, env);
    const { adminSessions } = getTableNames(env);
    const row = await db.prepare(`SELECT expires_at FROM ${adminSessions} WHERE token = ?`)
      .bind(token)
      .first() as { expires_at?: string } | null;
    if (!row || !row.expires_at) return false;
    return new Date(row.expires_at).getTime() > Date.now();
  } catch (e) {
    console.warn('Failed to validate session token', e);
    return false;
  }
};

// 管理员鉴权：明文密码（兼容旧调用方）或会话 token
export const isAdminAuthorized = async (
  db: D1Database | undefined,
  env: SharedEnv,
  request: Request,
  url: URL
): Promise<boolean> => {
  const expectedPassword = cleanSecretString(env.ADMIN_PASSWORD);
  if (expectedPassword) {
    const pass = readAdminCredentials(request, url);
    if (pass !== '' && pass === expectedPassword) return true;
  }

  const token = cleanSecretString(
    request.headers.get('X-Admin-Token') ||
      request.headers.get('x-admin-token') ||
      url.searchParams.get('admin_token')
  );
  if (token && db) {
    return isValidSessionToken(db, token, env);
  }
  return false;
};

// 签发会话 token（默认 7 天有效）
export const createAdminSession = async (
  db: D1Database,
  env?: Pick<SharedEnv, 'DB_TABLE_PREFIX'>,
  ttlMs = 7 * 24 * 60 * 60 * 1000
): Promise<string> => {
  await ensureAdminSessionsTable(db, env);
  const { adminSessions } = getTableNames(env);
  const token = `sess_${crypto.randomUUID().replace(/-/g, '')}${Math.random().toString(36).substring(2, 10)}`;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await db.prepare(`INSERT INTO ${adminSessions} (token, expires_at) VALUES (?, ?)`).bind(token, expiresAt).run();
  return token;
};

// 删除会话（登出）
export const deleteAdminSession = async (
  db: D1Database,
  token: string,
  env?: Pick<SharedEnv, 'DB_TABLE_PREFIX'>
): Promise<void> => {
  if (!token) return;
  try {
    const { adminSessions } = getTableNames(env);
    await db.prepare(`DELETE FROM ${adminSessions} WHERE token = ?`).bind(token).run();
  } catch (e) {
    console.warn('Failed to delete session token', e);
  }
};

// 幂等补齐 transactions 表的转账扩展字段（兼容存量 D1 库；按表名缓存避免跨前缀跳过）
const ensuredTransferTables = new Set<string>();

export const ensureTransactionTransferColumns = async (
  db: D1Database,
  env?: Pick<SharedEnv, 'DB_TABLE_PREFIX'>
): Promise<void> => {
  const { transactions } = getTableNames(env);
  if (ensuredTransferTables.has(transactions)) return;
  try {
    const { results } = await db.prepare(`PRAGMA table_info(${transactions})`).all<{ name: string }>();
    const cols = new Set((results || []).map((c) => c.name));
    if (cols.size === 0) return;
    if (!cols.has('tx_type')) {
      try {
        await db.prepare(`ALTER TABLE ${transactions} ADD COLUMN tx_type TEXT DEFAULT 'normal'`).run();
      } catch {
        // 并发请求已添加时忽略
      }
    }
    if (!cols.has('to_ledger')) {
      try {
        await db.prepare(`ALTER TABLE ${transactions} ADD COLUMN to_ledger TEXT DEFAULT ''`).run();
      } catch {
        // 并发请求已添加时忽略
      }
    }
    ensuredTransferTables.add(transactions);
  } catch (e) {
    console.warn(`Failed to ensure transfer columns on ${transactions}`, e);
  }
};

// 统一追加/插入账目核心处理逻辑（兼容 desc/title, amt/amount, tag/member, type: "账单/招商银行", tx_type/to_ledger）
export const insertTransactionsBatch = async (
  db: D1Database,
  body: unknown,
  source: 'web' | 'api',
  env?: Pick<SharedEnv, 'DB_TABLE_PREFIX'>
): Promise<{ success: boolean; status: number; message?: string; data?: TransactionRow | TransactionRow[]; summaryText?: string }> => {
  const rawItems = Array.isArray(body) ? body : [body];
  if (rawItems.length === 0) {
    return { success: false, status: 400, message: '请求体不能为空' };
  }

  await ensureTransactionTransferColumns(db, env);
  const { transactions } = getTableNames(env);

  const insertedList: TransactionRow[] = [];
  const summaryParts: string[] = [];

  for (const rawItem of rawItems) {
    if (typeof rawItem !== 'object' || rawItem === null) {
      return { success: false, status: 400, message: '请求体必须是 JSON 对象或对象数组' };
    }

    const item = rawItem as Record<string, unknown>;
    const id = typeof item.id === 'string' && item.id
      ? item.id
      : `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const title = item.desc !== undefined ? String(item.desc) : (item.title !== undefined ? String(item.title) : '');
    const date = typeof item.date === 'string' && item.date
      ? item.date
      : new Date().toISOString().split('T')[0];

    const rawAmt = item.amt !== undefined ? item.amt : item.amount;
    let amount = Number(rawAmt);
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      return { success: false, status: 400, message: `金额字段 amt/amount 非法: ${String(rawAmt)}` };
    }

    const member = item.tag !== undefined ? String(item.tag) : (item.member !== undefined ? String(item.member) : '默认');

    let category = item.category !== undefined ? String(item.category) : '其它';
    let subcategory = item.subcategory !== undefined ? String(item.subcategory) : '';

    const typeStr = item.type !== undefined ? String(item.type).trim() : '';
    if (typeStr) {
      if (typeStr.includes('/')) {
        const typeParts = typeStr.split('/');
        category = typeParts[0].trim();
        subcategory = typeParts.slice(1).join('/').trim();
      } else {
        category = typeStr;
        subcategory = '';
      }
    }

    const ledger = item.ledger !== undefined && String(item.ledger).trim() ? String(item.ledger).trim() : 'Default';
    const rawToLedger = item.to_ledger ?? item.toLedger ?? item.target_ledger ?? '';
    const toLedger = String(rawToLedger).trim();
    const rawTxType = String(item.tx_type ?? item.txType ?? item.record_type ?? '').trim().toLowerCase();
    const txType: 'normal' | 'transfer' =
      rawTxType === 'transfer' || rawTxType === '转账' || toLedger !== '' ? 'transfer' : 'normal';

    if (txType === 'transfer') {
      amount = Math.abs(amount);
      if (!category || category === '其它') {
        category = '转账';
      }
    }

    await db.prepare(
      `INSERT INTO ${transactions} (id, title, date, amount, member, category, subcategory, ledger, tx_type, to_ledger)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, title, date, amount, member, category, subcategory, ledger, txType, txType === 'transfer' ? toLedger : '').run();

    const inserted: TransactionRow = {
      id,
      title,
      date,
      amount,
      member,
      category,
      subcategory,
      ledger,
      tx_type: txType,
      to_ledger: txType === 'transfer' ? toLedger : '',
    };
    insertedList.push(inserted);

    const catLabel = subcategory ? `${category}/${subcategory}` : category;
    const transferTag = txType === 'transfer' ? `, transfer:"${ledger}→${toLedger}"` : '';
    summaryParts.push(`amt:${amount}, desc:"${title}", tag:"${member}", type:"${catLabel}"${transferTag}, date:${date}`);

    // 记录活动日志
    const logPrefix = txType === 'transfer' ? `新增转账 (${ledger}→${toLedger})` : '新增账目';
    const logDetails = `${logPrefix}: [${title || '无备注'}] ￥${amount.toFixed(2)} (${member} | ${catLabel}) 日期:${date}`;
    await recordActivityLog(db, source, 'create', logDetails, env);
  }

  return {
    success: true,
    status: 200,
    message: `成功插入 ${insertedList.length} 条账目记录`,
    data: Array.isArray(body) ? insertedList : insertedList[0],
    summaryText: summaryParts.join('; '),
  };
};
