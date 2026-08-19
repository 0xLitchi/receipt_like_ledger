import {
  cleanSecretString,
  getCorsHeaders,
  isAdminAuthorized,
  readBearerToken,
  recordActivityLog,
  type SharedEnv,
  type TransactionRow,
} from './_shared';

interface Env extends SharedEnv {}

const jsonHeaders = (request: Request, env: Env, extra: Record<string, string> = {}): Record<string, string> => ({
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  ...getCorsHeaders(request, env),
  ...extra,
});

// CORS 跨域预检处理（仅白名单域名放行）
export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request, context.env),
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

  // 2. 严格读取 Cloudflare 环境变量 ACCESS_TOKEN
  const cfAccessToken = cleanSecretString(env.ACCESS_TOKEN);

  let hasFullAccess = false;
  if (!cfAccessToken) {
    hasFullAccess = true;
  } else {
    hasFullAccess =
      (await isAdminAuthorized(env.DB, env, request, url)) ||
      (queryToken !== '' && queryToken === cfAccessToken);
  }

  if (!env.DB) {
    return new Response(JSON.stringify({
      success: false,
      message: 'D1 Binding DB not configured',
      useFallback: true,
      hasFullAccess,
    }), {
      status: 200,
      headers: jsonHeaders(request, env),
    });
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM transactions ORDER BY date DESC, created_at DESC'
    ).all<TransactionRow>();

    const data = (results || []).map((t) => {
      if (hasFullAccess) return t;
      return {
        ...t,
        title: '***',
        amount: 0,
        isMasked: true,
      };
    });

    return new Response(JSON.stringify({ success: true, data, hasFullAccess }), {
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

// 通过 API 插入/追加账单数据 (区分 web 与 api 修改来源，并自动写入 activity_logs)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  const expectedAccessToken = cleanSecretString(env.ACCESS_TOKEN);
  const bearerToken = readBearerToken(request);
  const isBearerAuthorized = !!(expectedAccessToken && bearerToken && bearerToken === expectedAccessToken);
  const isAdmin = await isAdminAuthorized(env.DB, env, request, url);

  if (!isBearerAuthorized && !isAdmin) {
    return new Response(
      JSON.stringify({
        success: false,
        message: '未授权：请提供有效的 Bearer Token (Authorization: Bearer <ACCESS_TOKEN>) 或管理员凭证',
      }),
      { status: 401, headers: jsonHeaders(request, env) }
    );
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, message: 'D1 DB binding not found' }), {
      status: 500,
      headers: jsonHeaders(request, env),
    });
  }

  try {
    const body = await request.json() as unknown;
    const rawItems = Array.isArray(body) ? body : [body];
    if (rawItems.length === 0) {
      return new Response(JSON.stringify({ success: false, message: '请求体不能为空' }), {
        status: 400,
        headers: jsonHeaders(request, env),
      });
    }

    const insertedList: TransactionRow[] = [];
    // 区分数据变更来源：Bearer Token 鉴权判定为 'api'，网页管理员登录判定为 'web'
    const source: 'web' | 'api' = isBearerAuthorized ? 'api' : 'web';

    for (const rawItem of rawItems) {
      if (typeof rawItem !== 'object' || rawItem === null) {
        return new Response(JSON.stringify({ success: false, message: '请求体必须是对象或对象数组' }), {
          status: 400,
          headers: jsonHeaders(request, env),
        });
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
      const amount = Number(rawAmt);
      if (typeof amount !== 'number' || Number.isNaN(amount)) {
        return new Response(JSON.stringify({ success: false, message: `金额字段 amt/amount 非法: ${String(rawAmt)}` }), {
          status: 400,
          headers: jsonHeaders(request, env),
        });
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

      const ledger = item.ledger !== undefined ? String(item.ledger) : 'Default';

      await env.DB.prepare(
        `INSERT INTO transactions (id, title, date, amount, member, category, subcategory, ledger)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, title, date, amount, member, category, subcategory, ledger).run();

      const inserted: TransactionRow = { id, title, date, amount, member, category, subcategory, ledger };
      insertedList.push(inserted);

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
      { status: 200, headers: jsonHeaders(request, env) }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: jsonHeaders(request, env),
    });
  }
};
