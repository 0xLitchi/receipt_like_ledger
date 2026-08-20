import {
  getCorsHeaders,
  isAdminAuthorized,
  type SharedEnv,
} from './_shared';

interface Env extends SharedEnv {}

const ALLOWED_THEME_STYLES = ['receipt', 'gameboy', 'wallet', 'tractor'] as const;
const ALLOWED_KEYS = ['theme_style'] as const;
const DEFAULT_SETTINGS: Record<string, string> = {
  theme_style: 'receipt',
};

const jsonHeaders = (request: Request, env: Env, extra: Record<string, string> = {}): Record<string, string> => ({
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  ...getCorsHeaders(request, env),
  ...extra,
});

// 全局设置表（幂等建表）
const ensureSettingsTable = async (db: D1Database): Promise<void> => {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
};

const isValidValue = (key: string, value: string): boolean => {
  if (key === 'theme_style') {
    return (ALLOWED_THEME_STYLES as readonly string[]).includes(value);
  }
  return false;
};

// 公开读取全局设置（主题设置无需敏感鉴权）
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const data: Record<string, string> = { ...DEFAULT_SETTINGS };

  if (!env.DB) {
    return new Response(JSON.stringify({ success: true, data }), {
      headers: jsonHeaders(request, env),
    });
  }

  try {
    await ensureSettingsTable(env.DB);
    const { results } = await env.DB.prepare(
      'SELECT key, value FROM app_settings'
    ).all<{ key: string; value: string }>();

    (results || []).forEach((row) => {
      if (row.key in DEFAULT_SETTINGS) {
        data[row.key] = row.value;
      }
    });

    return new Response(JSON.stringify({ success: true, data }), {
      headers: jsonHeaders(request, env),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: jsonHeaders(request, env),
    });
  }
};

// 管理员写入全局设置（支持 theme_style 设置）
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!(await isAdminAuthorized(env.DB, env, request, url))) {
    return new Response(JSON.stringify({ success: false, message: '未授权：管理员凭证错误或未配置' }), {
      status: 401,
      headers: jsonHeaders(request, env),
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, message: 'D1 DB binding not found' }), {
      status: 500,
      headers: jsonHeaders(request, env),
    });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const entries = Object.entries(body).filter(([key]) =>
      (ALLOWED_KEYS as readonly string[]).includes(key)
    );

    if (entries.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: `至少需要一个可写设置键: ${ALLOWED_KEYS.join(', ')}`,
      }), {
        status: 400,
        headers: jsonHeaders(request, env),
      });
    }

    await ensureSettingsTable(env.DB);
    for (const [key, rawValue] of entries) {
      const value = String(rawValue);
      if (!isValidValue(key, value)) {
        return new Response(JSON.stringify({
          success: false,
          message: `theme_style 必须是 ${ALLOWED_THEME_STYLES.join(', ')} 之一`,
        }), {
          status: 400,
          headers: jsonHeaders(request, env),
        });
      }
      await env.DB.prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
      ).bind(key, value).run();
    }

    const { results } = await env.DB.prepare(
      'SELECT key, value FROM app_settings'
    ).all<{ key: string; value: string }>();
    const data: Record<string, string> = { ...DEFAULT_SETTINGS };
    (results || []).forEach((row) => {
      if (row.key in DEFAULT_SETTINGS) {
        data[row.key] = row.value;
      }
    });

    return new Response(JSON.stringify({ success: true, data }), {
      headers: jsonHeaders(request, env),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: jsonHeaders(request, env),
    });
  }
};
