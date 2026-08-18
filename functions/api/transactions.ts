interface Env {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
  ACCESS_TOKEN?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // 读取 URL 查询参数中的 token 或 access_token
  const queryToken = url.searchParams.get('token') || url.searchParams.get('access_token');
  const authHeader = request.headers.get('X-Admin-Password');

  // 1. ADMIN_PASSWORD 校验 (独立用于管理员鉴权)
  const isAuthorizedAdmin = !!(env.ADMIN_PASSWORD && authHeader === env.ADMIN_PASSWORD);

  // 2. ACCESS_TOKEN 校验 (独立用于公开页面访问脱敏控制)
  // 严格从 Cloudflare 环境变量 env.ACCESS_TOKEN 读取，绝不使用固定的静态字符串
  const cfAccessToken = env.ACCESS_TOKEN ? env.ACCESS_TOKEN.trim() : '';

  let hasFullAccess = true;
  if (cfAccessToken !== '') {
    // 只有在 CF 中配置了 ACCESS_TOKEN 变量时，才要求 URL 中的 token 与其精确匹配（或具备管理员权限）
    hasFullAccess = isAuthorizedAdmin || (!!queryToken && queryToken === cfAccessToken);
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

    // 若无 fullAccess 权限，则将备注与金额置为脱敏数据
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

  const authHeader = request.headers.get('X-Admin-Password');
  const expectedPassword = env.ADMIN_PASSWORD;

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
