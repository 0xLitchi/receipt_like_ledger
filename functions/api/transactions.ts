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

// 动态创建并记录日志 Helper
const recordActivityLog = async (
  db: D1Database,
  source: 'web' | 'api' | 'import',
  action: 'create' | 'update' | 'delete' | 'batch_save',
  details: string
) => {
  try {
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

    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    await db.prepare(
      `INSERT INTO activity_logs (id, timestamp, source, action, details) VALUES (?, ?, ?, ?, ?)`
    ).bind(id, timestamp, source, action, details).run();
  } catch (e) {
    console.warn('Failed to record log', e);
  }
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
    hasFullAccess = true;
  } else {
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

// 通过 API 插入/追加账单数据 (区分 web 与 api 修改来源，并自动写入 activity_logs)
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

    // 区分数据变更来源：Bearer Token 鉴权判定为 'api'，网页管理员登录判定为 'web'
    const source: 'web' | 'api' = isBearerAuthorized ? 'api' : 'web';

    for (const item of items) {
      const id = item.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const title = item.desc !== undefined ? String(item.desc) : (item.title || '');
      const date = item.date || new Date().toISOString().split('T')[0];
      const rawAmt = item.amt !== undefined ? item.amt : item.amount;
      const amount = Number(rawAmt) || 0;
      const member = item.tag !== undefined ? String(item.tag) : (item.member || '默认');

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

      // 记录活动日志
      const catLabel = subcategory ? `${category}/${subcategory}` : category;
      const logDetails = `新增账目: [${title || '无备注'}] ￥${amount.toFixed(2)} (${member} | ${catLabel}) 日期:${date}`;
      await recordActivityLog(env.DB, source, 'create', logDetails);
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
