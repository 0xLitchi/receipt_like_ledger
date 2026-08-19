import {
  getCorsHeaders,
  isAdminAuthorized,
  type SharedEnv,
} from './_shared';

interface Env extends SharedEnv {}

const THEME_STYLE_KEY = 'theme_style';
const ALLOWED_THEME_STYLES = ['receipt', 'gameboy', 'wallet', 'tractor'] as const;

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

// 公开读取全局设置（主题不是敏感数据，无需鉴权）
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ success: true, data: { themeStyle: 'receipt' } }), {
      headers: jsonHeaders(request, env),
    });
  }

  try {
    await ensureSettingsTable(env.DB);
    const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?')
      .bind(THEME_STYLE_KEY)
      .first<{ value: string }>();

    const themeStyle = row && row.value ? row.value : 'receipt';
    return new Response(JSON.stringify({ success: true, data: { themeStyle } }), {
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

// 管理员写入全局设置（服务端持久化主题，其他访客访问时延续）
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
    const body = await request.json() as { themeStyle?: unknown };
    const themeStyle = typeof body.themeStyle === 'string' ? body.themeStyle : '';

    if (!(ALLOWED_THEME_STYLES as readonly string[]).includes(themeStyle)) {
      return new Response(JSON.stringify({
        success: false,
        message: `themeStyle 必须是 ${ALLOWED_THEME_STYLES.join(', ')} 之一`,
      }), {
        status: 400,
        headers: jsonHeaders(request, env),
      });
    }

    await ensureSettingsTable(env.DB);
    await env.DB.prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    ).bind(THEME_STYLE_KEY, themeStyle).run();

    return new Response(JSON.stringify({ success: true, data: { themeStyle } }), {
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
