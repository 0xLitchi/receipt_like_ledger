interface Env {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
  ACCESS_TOKEN?: string;
}

// 辅助函数：彻底去除换行符 (\r, \n)、制表符、多余空格及引号
const cleanSecretString = (str?: string | null): string => {
  if (!str) return '';
  return str.replace(/[\r\n\t\s"']/g, '').trim();
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 支持各类 Query 参数 (token / access_token)
  let rawQueryToken = '';
  for (const [key, value] of url.searchParams.entries()) {
    const k = key.toLowerCase();
    if (k === 'token' || k === 'access_token') {
      rawQueryToken = value;
      break;
    }
  }

  const queryToken = cleanSecretString(rawQueryToken);
  const authHeader = cleanSecretString(request.headers.get('X-Admin-Password'));

  const expectedAdminPassword = cleanSecretString(env.ADMIN_PASSWORD);
  const isAuthorizedAdmin = !!(expectedAdminPassword && authHeader === expectedAdminPassword);

  // 2. 严格从 Cloudflare Pages 环境变量中读取 ACCESS_TOKEN 并彻底清洗换行符
  const cfAccessToken = cleanSecretString(env.ACCESS_TOKEN);

  let hasFullAccess = true;

  // 只要 Cloudflare 环境变量中配置了 ACCESS_TOKEN（非空），即强制触发脱敏校验
  if (cfAccessToken !== '') {
    hasFullAccess = isAuthorizedAdmin || (queryToken !== '' && queryToken === cfAccessToken);
  }

  if (!env.DB) {
    return new Response(JSON.stringify({
      success: false,
      message: 'D1 Binding DB not configured',
      useFallback: true,
      hasFullAccess,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM transactions ORDER BY date DESC, created_at DESC'
    ).all();

    // 根据 hasFullAccess 决定返回真实数据还是脱敏数据
    const data = (results || []).map((t: any) => {
      if (hasFullAccess) return t;
      return {
        ...t,
        title: '***',
        amount: 0,
        isMasked: true,
      };
    });

    return new Response(JSON.stringify({ success: true, data, hasFullAccess }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const authHeader = cleanSecretString(request.headers.get('X-Admin-Password'));
  const expectedPassword = cleanSecretString(env.ADMIN_PASSWORD);

  if (!expectedPassword || authHeader !== expectedPassword) {
    return new Response(JSON.stringify({ success: false, message: '未授权：管理员密码错误或未配置 ADMIN_PASSWORD' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, message: 'D1 DB binding not found' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const item = await request.json() as any;
    const id = item.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const title = item.title || '';
    const date = item.date;
    const amount = Number(item.amount);
    const member = item.member || '默认';
    const category = item.category || '其它';
    const subcategory = item.subcategory || '';
    const ledger = item.ledger || 'Default';

    await env.DB.prepare(
      `INSERT INTO transactions (id, title, date, amount, member, category, subcategory, ledger)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, title, date, amount, member, category, subcategory, ledger).run();

    return new Response(JSON.stringify({ success: true, data: { id, title, date, amount, member, category, subcategory, ledger } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
