import {
  cleanSecretString,
  getClientIp,
  getCorsHeaders,
  insertTransactionsBatch,
  isAdminAuthorized,
  recordActivityLog,
  recordApiRequestLog,
  type SharedEnv,
  type TransactionRow,
} from '../_shared';

interface Env extends SharedEnv {}

const jsonHeaders = (request: Request, env: Env, extra: Record<string, string> = {}): Record<string, string> => ({
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  ...getCorsHeaders(request, env),
  ...extra,
});

// CORS 预检
export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request, context.env),
  });
};

// 支持通过 GET URL Query 参数追加账单数据: GET /api/transactions/<token>?desc=午餐&amt=-35&tag=荔枝&type=餐饮/外卖
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const startTime = Date.now();
  const { request, env, params } = context;
  const tokenOrId = params.id as string;
  const url = new URL(request.url);

  const urlToken = cleanSecretString(tokenOrId);
  const expectedAccessToken = cleanSecretString(env.ACCESS_TOKEN);

  const isTokenAuthorized = !!(expectedAccessToken && urlToken && urlToken === expectedAccessToken);
  const isAdmin = await isAdminAuthorized(env.DB, env, request, url);

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('User-Agent') || '';
  const endpoint = url.pathname + url.search;

  if (!isTokenAuthorized && !isAdmin) {
    const errorMsg = '未授权：URL 中拼接的 Access Token 无效，校验未通过';
    await recordApiRequestLog(env.DB, {
      method: 'GET',
      endpoint,
      statusCode: 401,
      success: false,
      ipAddress,
      userAgent,
      tokenUsed: urlToken,
      payloadSummary: errorMsg,
      executionMs: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ success: false, message: errorMsg }),
      { status: 401, headers: jsonHeaders(request, env) }
    );
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, message: 'D1 DB binding not found' }), {
      status: 500,
      headers: jsonHeaders(request, env),
    });
  }

  const rawAmt = url.searchParams.get('amt') ?? url.searchParams.get('amount');
  const desc = url.searchParams.get('desc') ?? url.searchParams.get('title');

  if (rawAmt === null && desc === null) {
    const errorMsg = 'GET 追加数据请拼接参数，示例: /api/transactions/<token>?desc=午餐&amt=-35.5&tag=荔枝&type=餐饮/外卖';
    await recordApiRequestLog(env.DB, {
      method: 'GET',
      endpoint,
      statusCode: 400,
      success: false,
      ipAddress,
      userAgent,
      tokenUsed: urlToken,
      payloadSummary: errorMsg,
      executionMs: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ success: false, message: errorMsg }),
      { status: 400, headers: jsonHeaders(request, env) }
    );
  }

  try {
    const item = {
      desc: desc ?? '',
      amt: rawAmt ?? 0,
      tag: url.searchParams.get('tag') ?? url.searchParams.get('member') ?? '默认',
      type: url.searchParams.get('type') ?? '',
      category: url.searchParams.get('category') ?? '其它',
      subcategory: url.searchParams.get('subcategory') ?? '',
      date: url.searchParams.get('date') ?? new Date().toISOString().split('T')[0],
      ledger: url.searchParams.get('ledger') ?? 'Default',
    };

    const source: 'web' | 'api' = isTokenAuthorized ? 'api' : 'web';
    const result = await insertTransactionsBatch(env.DB, item, source);

    await recordApiRequestLog(env.DB, {
      method: 'GET',
      endpoint,
      statusCode: result.status,
      success: result.success,
      ipAddress,
      userAgent,
      tokenUsed: urlToken,
      payloadSummary: result.summaryText || result.message || 'GET 追加账目',
      executionMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify(result), {
      status: result.status,
      headers: jsonHeaders(request, env),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await recordApiRequestLog(env.DB, {
      method: 'GET',
      endpoint,
      statusCode: 500,
      success: false,
      ipAddress,
      userAgent,
      tokenUsed: urlToken,
      payloadSummary: `系统异常: ${message}`,
      executionMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: jsonHeaders(request, env),
    });
  }
};

// 通过 URL 路径中的 Token 追加账单数据: POST /api/transactions/<token>
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const startTime = Date.now();
  const { request, env, params } = context;
  const tokenOrId = params.id as string;
  const url = new URL(request.url);

  const urlToken = cleanSecretString(tokenOrId);
  const expectedAccessToken = cleanSecretString(env.ACCESS_TOKEN);

  const isTokenAuthorized = !!(expectedAccessToken && urlToken && urlToken === expectedAccessToken);
  const isAdmin = await isAdminAuthorized(env.DB, env, request, url);

  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('User-Agent') || '';
  const endpoint = url.pathname + url.search;

  if (!isTokenAuthorized && !isAdmin) {
    const errorMsg = '未授权：URL 中拼接的 Access Token 无效，校验未通过';
    await recordApiRequestLog(env.DB, {
      method: 'POST',
      endpoint,
      statusCode: 401,
      success: false,
      ipAddress,
      userAgent,
      tokenUsed: urlToken,
      payloadSummary: errorMsg,
      executionMs: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({ success: false, message: errorMsg }),
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
    const source: 'web' | 'api' = isTokenAuthorized ? 'api' : 'web';
    const result = await insertTransactionsBatch(env.DB, body, source);

    await recordApiRequestLog(env.DB, {
      method: 'POST',
      endpoint,
      statusCode: result.status,
      success: result.success,
      ipAddress,
      userAgent,
      tokenUsed: urlToken,
      payloadSummary: result.summaryText || result.message || 'POST 追加账目',
      executionMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify(result), {
      status: result.status,
      headers: jsonHeaders(request, env),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await recordApiRequestLog(env.DB, {
      method: 'POST',
      endpoint,
      statusCode: 500,
      success: false,
      ipAddress,
      userAgent,
      tokenUsed: urlToken,
      payloadSummary: `解析 Body 或插入失败: ${message}`,
      executionMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: jsonHeaders(request, env),
    });
  }
};

// 管理员更新单条账目: PUT /api/transactions/:id
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const id = params.id as string;
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
    const title = typeof body.title === 'string' ? body.title : '';
    const date = typeof body.date === 'string' ? body.date : '';
    const amount = Number(body.amount);
    const member = typeof body.member === 'string' ? body.member : '默认';
    const category = typeof body.category === 'string' ? body.category : '其它';
    const subcategory = typeof body.subcategory === 'string' ? body.subcategory : '';
    const ledger = typeof body.ledger === 'string' ? body.ledger : 'Default';

    await env.DB.prepare(
      `UPDATE transactions
       SET title = ?, date = ?, amount = ?, member = ?, category = ?, subcategory = ?, ledger = ?
       WHERE id = ?`
    ).bind(title, date, amount, member, category, subcategory, ledger, id).run();

    // 记录修改日志 (网页端修改)
    const catLabel = subcategory ? `${category}/${subcategory}` : category;
    const logDetails = `更新账目 [${id}]: [${title || '无备注'}] ￥${amount.toFixed(2)} (${member} | ${catLabel}) 日期:${date}`;
    await recordActivityLog(env.DB, 'web', 'update', logDetails);

    return new Response(JSON.stringify({ success: true, message: 'Transaction updated' }), {
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

// 管理员删除单条账目: DELETE /api/transactions/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const id = params.id as string;
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
    let targetTitle = id;
    try {
      const existing = await env.DB.prepare('SELECT title, amount FROM transactions WHERE id = ?')
        .bind(id)
        .first<Pick<TransactionRow, 'title' | 'amount'>>();
      if (existing) {
        targetTitle = `[${existing.title || '无备注'}] ￥${existing.amount}`;
      }
    } catch {
      // ignore
    }

    await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();

    // 记录删除日志
    const logDetails = `删除账目 ID ${id}: ${targetTitle}`;
    await recordActivityLog(env.DB, 'web', 'delete', logDetails);

    return new Response(JSON.stringify({ success: true, message: 'Transaction deleted' }), {
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
