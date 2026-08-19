interface Env {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
  ACCESS_TOKEN?: string;
}

// 辅助函数：剥离换行符 (\r, \n)、制表符、多余空格及引号
const cleanSecretString = (str?: string | null): string => {
  if (!str) return '';
  return str.replace(/[\r\n\t\s"']/g, '').trim();
};

// CORS 跨域预检处理
export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Password',
    },
  });
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

  // 2. 支持 Header 或 Query 参数 (admin_password / password / X-Admin-Password) 校验管理员身份
  const rawAdminPass =
    request.headers.get('X-Admin-Password') ||
    request.headers.get('x-admin-password') ||
    url.searchParams.get('admin_password') ||
    url.searchParams.get('password');

  const authHeader = cleanSecretString(rawAdminPass);
  const expectedAdminPassword = cleanSecretString(env.ADMIN_PASSWORD);
  const isAuthorizedAdmin = !!(expectedAdminPassword && authHeader === expectedAdminPassword);

  // 3. 严格读取 Cloudflare 环境变量 ACCESS_TOKEN
  const cfAccessToken = cleanSecretString(env.ACCESS_TOKEN);

  let hasFullAccess = false;
  if (!cfAccessToken) {
    // 若服务端未设置 ACCESS_TOKEN，则默认公开访问
    hasFullAccess = true;
  } else {
    // 只要配置了 ACCESS_TOKEN，匹配 URL 参数或具备正确管理员凭证即可解密
    hasFullAccess = isAuthorizedAdmin || (queryToken !== '' && queryToken === cfAccessToken);
  }

  const responseHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Access-Control-Allow-Origin': '*',
  };

  if (!env.DB) {
    return new Response(JSON.stringify({
      success: false,
      message: 'D1 Binding DB not configured',
      useFallback: true,
      hasFullAccess,
    }), {
      status: 200,
      headers: responseHeaders,
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
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: responseHeaders,
    });
  }
};

// 通过 API 插入/追加账单数据 (HTTP POST，支持精简字段 desc, amt, tag, type:"账单/招商银行")
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 提取 Authorization: Bearer <TOKEN>
  const authHeaderRaw = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  let bearerToken = '';
  if (authHeaderRaw.toLowerCase().startsWith('bearer ')) {
    bearerToken = cleanSecretString(authHeaderRaw.substring(7));
  }

  // 2. 提取 X-Admin-Password
  const rawAdminPass =
    request.headers.get('X-Admin-Password') ||
    request.headers.get('x-admin-password') ||
    url.searchParams.get('admin_password');
  const adminPassHeader = cleanSecretString(rawAdminPass);

  const expectedAccessToken = cleanSecretString(env.ACCESS_TOKEN);
  const expectedAdminPassword = cleanSecretString(env.ADMIN_PASSWORD);

  const isBearerAuthorized = !!(expectedAccessToken && bearerToken === expectedAccessToken);
  const isAdminAuthorized = !!(expectedAdminPassword && adminPassHeader === expectedAdminPassword);

  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (!isBearerAuthorized && !isAdminAuthorized) {
    return new Response(
      JSON.stringify({
        success: false,
        message: '未授权：请提供有效的 Bearer Token (Authorization: Bearer <ACCESS_TOKEN>) 或 X-Admin-Password',
      }),
      { status: 401, headers: responseHeaders }
    );
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, message: 'D1 DB binding not found' }), {
      status: 500,
      headers: responseHeaders,
    });
  }

  try {
    const body = await request.json() as any;
    const items = Array.isArray(body) ? body : [body];
    const insertedList: any[] = [];

    for (const item of items) {
      const id = item.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // 1. desc -> title (兼容 title)
      const title = item.desc !== undefined ? String(item.desc) : (item.title || '');

      // 2. date
      const date = item.date || new Date().toISOString().split('T')[0];

      // 3. amt -> amount (兼容 amount)
      const rawAmt = item.amt !== undefined ? item.amt : item.amount;
      const amount = Number(rawAmt) || 0;

      // 4. tag -> member (兼容 member)
      const member = item.tag !== undefined ? String(item.tag) : (item.member || '默认');

      // 5. type -> category / subcategory (如 "账单/招商银行" 自动拆分还原)
      let category = item.category || '其它';
      let subcategory = item.subcategory || '';

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

      const ledger = item.ledger || 'Default';

      await env.DB.prepare(
        `INSERT INTO transactions (id, title, date, amount, member, category, subcategory, ledger)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, title, date, amount, member, category, subcategory, ledger).run();

      insertedList.push({ id, title, date, amount, member, category, subcategory, ledger });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `成功插入 ${insertedList.length} 条账目记录`,
        data: Array.isArray(body) ? insertedList : insertedList[0],
      }),
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: responseHeaders,
    });
  }
};
