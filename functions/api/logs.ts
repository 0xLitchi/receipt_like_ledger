interface Env {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
}

const cleanSecretString = (str?: string | null): string => {
  if (!str) return '';
  return str.replace(/[\r\n\t\s"']/g, '').trim();
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // 管理员身份鉴权
  const rawAdminPass =
    request.headers.get('X-Admin-Password') ||
    request.headers.get('x-admin-password') ||
    url.searchParams.get('admin_password') ||
    url.searchParams.get('password');

  const authHeader = cleanSecretString(rawAdminPass);
  const expectedAdminPassword = cleanSecretString(env.ADMIN_PASSWORD);
  const isAuthorizedAdmin = !!(expectedAdminPassword && authHeader === expectedAdminPassword);

  const responseHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Access-Control-Allow-Origin': '*',
  };

  if (!isAuthorizedAdmin) {
    return new Response(JSON.stringify({ success: false, message: '未授权查看变更日志' }), {
      status: 401,
      headers: responseHeaders,
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, message: 'D1 DB binding not found' }), {
      status: 500,
      headers: responseHeaders,
    });
  }

  try {
    // 确保表存在
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();

    const { results } = await env.DB.prepare(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 200'
    ).all();

    return new Response(JSON.stringify({ success: true, data: results || [] }), {
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: responseHeaders,
    });
  }
};
