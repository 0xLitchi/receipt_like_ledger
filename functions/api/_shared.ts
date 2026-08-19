// Pages Functions 共享工具模块：密钥清洗、CORS 白名单、活动日志、管理员会话、类型约束

export interface SharedEnv {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
  ACCESS_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
}

export interface TransactionRow {
  id: string;
  title: string;
  date: string;
  amount: number;
  member: string;
  category: string;
  subcategory: string;
  ledger: string;
  created_at?: string;
}

// 剥离换行符 (\r, \n)、制表符、多余空格及引号
export const cleanSecretString = (str?: string | null): string => {
  if (!str) return '';
  return str.replace(/[\r\n\t\s"']/g, '').trim();
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

// 活动日志表（幂等建表）
export const ensureActivityLogsTable = async (db: D1Database): Promise<void> => {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
};

// 动态创建并记录日志
export const recordActivityLog = async (
  db: D1Database,
  source: 'web' | 'api' | 'import',
  action: 'create' | 'update' | 'delete' | 'batch_save',
  details: string
): Promise<void> => {
  try {
    await ensureActivityLogsTable(db);
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    await db.prepare(
      `INSERT INTO activity_logs (id, timestamp, source, action, details) VALUES (?, ?, ?, ?, ?)`
    ).bind(id, timestamp, source, action, details).run();
  } catch (e) {
    console.warn('Failed to record log', e);
  }
};

// 管理员会话表（幂等建表）
export const ensureAdminSessionsTable = async (db: D1Database): Promise<void> => {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
};

// 校验会话 token 是否有效
export const isValidSessionToken = async (db: D1Database, token: string): Promise<boolean> => {
  if (!token) return false;
  try {
    await ensureAdminSessionsTable(db);
    const row = await db.prepare('SELECT expires_at FROM admin_sessions WHERE token = ?')
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
    return isValidSessionToken(db, token);
  }
  return false;
};

// 签发会话 token（默认 7 天有效）
export const createAdminSession = async (db: D1Database, ttlMs = 7 * 24 * 60 * 60 * 1000): Promise<string> => {
  await ensureAdminSessionsTable(db);
  const token = `sess_${crypto.randomUUID().replace(/-/g, '')}${Math.random().toString(36).substring(2, 10)}`;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await db.prepare('INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)').bind(token, expiresAt).run();
  return token;
};

// 删除会话（登出）
export const deleteAdminSession = async (db: D1Database, token: string): Promise<void> => {
  if (!token) return;
  try {
    await db.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(token).run();
  } catch (e) {
    console.warn('Failed to delete session token', e);
  }
};
