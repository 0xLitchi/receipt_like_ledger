import {
  cleanSecretString,
  ensureTransactionTransferColumns,
  getClientIp,
  getCorsHeaders,
  getTableNames,
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
    }, env);

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
    }, env);

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
      tx_type: url.searchParams.get('tx_type') ?? url.searchParams.get('record_type') ?? '',
      to_ledger: url.searchParams.get('to_ledger') ?? url.searchParams.get('toLedger') ?? url.searchParams.get('target_ledger') ?? '',
    };

    const source: 'web' | 'api' = isTokenAuthorized ? 'api' : 'web';
    const result = await insertTransactionsBatch(env.DB, item, source, env);

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
    }, env);

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
    }, env);

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
    }, env);

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
    const result = await insertTransactionsBatch(env.DB, body, source, env);

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
    }, env);

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
    }, env);

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: jsonHeaders(request, env),
    });
  }
};

// 管理员更新单条账目: PUT /api/transactions/:id
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const startTime = Date.now();
  const { request, env, params } = context;
  const id = params.id as string;
  const url = new URL(request.url);
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('User-Agent') || '';
  const endpoint = url.pathname + url.search;

  if (!(await isAdminAuthorized(env.DB, env, request, url))) {
    await recordApiRequestLog(env.DB, {
      method: 'PUT',
      endpoint,
      statusCode: 401,
      success: false,
      ipAddress,
      userAgent,
      tokenUsed: request.headers.get('X-Admin-Token') || '',
      payloadSummary: '未授权：更新账目被拒绝',
      executionMs: Date.now() - startTime,
    }, env);
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
    await ensureTransactionTransferColumns(env.DB, env);
    const { transactions } = getTableNames(env);
    const body = await request.json() as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title : '';
    const date = typeof body.date === 'string' ? body.date : '';
    let amount = Number(body.amount);
    let member = typeof body.member === 'string' ? body.member : '默认';
    let category = typeof body.category === 'string' ? body.category : '其它';
    let subcategory = typeof body.subcategory === 'string' ? body.subcategory : '';
    const ledger = typeof body.ledger === 'string' && body.ledger.trim() ? body.ledger.trim() : 'Default';
    const rawToLedger = typeof body.to_ledger === 'string' ? body.to_ledger.trim() : '';
    const rawTxType = typeof body.tx_type === 'string' ? body.tx_type.trim().toLowerCase() : '';
    const txType: 'normal' | 'transfer' =
      rawTxType === 'transfer' || rawTxType === '转账' || rawToLedger !== '' ? 'transfer' : 'normal';
    const toLedger = txType === 'transfer' ? rawToLedger : '';

    if (txType === 'transfer') {
      amount = Math.abs(amount);
      member = '';
      if (!category || category === '其它') category = '转账';
      if (!subcategory) subcategory = '内部转账';
    }

    await env.DB.prepare(
      `UPDATE ${transactions}
       SET title = ?, date = ?, amount = ?, member = ?, category = ?, subcategory = ?, ledger = ?, tx_type = ?, to_ledger = ?
       WHERE id = ?`
    ).bind(title, date, amount, member, category, subcategory, ledger, txType, toLedger, id).run();

    // 记录修改日志 (网页端修改)
    const catLabel = subcategory ? `${category}/${subcategory}` : category;
    const transferTag = txType === 'transfer' ? ` [${ledger}→${toLedger}]` : '';
    const logDetails = `更新账目 [${id}]: [${title || '无备注'}] ￥${amount.toFixed(2)} (${member} | ${catLabel}${transferTag}) 日期:${date}`;
    await recordActivityLog(env.DB, 'web', 'update', logDetails, env);

    await recordApiRequestLog(env.DB, {
      method: 'PUT',
      endpoint,
      statusCode: 200,
      success: true,
      ipAddress,
      userAgent,
      tokenUsed: request.headers.get('X-Admin-Token') || '',
      payloadSummary: `amt:${amount}, desc:"${title}", tag:"${member}", type:"${catLabel}"${transferTag}, date:${date}`,
      executionMs: Date.now() - startTime,
    }, env);

    return new Response(JSON.stringify({ success: true, message: 'Transaction updated' }), {
      headers: jsonHeaders(request, env),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await recordApiRequestLog(env.DB, {
      method: 'PUT',
      endpoint,
      statusCode: 500,
      success: false,
      ipAddress,
      userAgent,
      tokenUsed: request.headers.get('X-Admin-Token') || '',
      payloadSummary: `更新失败: ${message}`,
      executionMs: Date.now() - startTime,
    }, env);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: jsonHeaders(request, env),
    });
  }
};

// 管理员删除单条账目: DELETE /api/transactions/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const startTime = Date.now();
  const { request, env, params } = context;
  const id = params.id as string;
  const url = new URL(request.url);
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('User-Agent') || '';
  const endpoint = url.pathname + url.search;

  if (!(await isAdminAuthorized(env.DB, env, request, url))) {
    await recordApiRequestLog(env.DB, {
      method: 'DELETE',
      endpoint,
      statusCode: 401,
      success: false,
      ipAddress,
      userAgent,
      tokenUsed: request.headers.get('X-Admin-Token') || '',
      payloadSummary: `未授权：删除账目 ${id} 被拒绝`,
      executionMs: Date.now() - startTime,
    }, env);
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
    const { transactions } = getTableNames(env);
    let targetTitle = id;
    try {
      const existing = await env.DB.prepare(`SELECT title, amount FROM ${transactions} WHERE id = ?`)
        .bind(id)
        .first<Pick<TransactionRow, 'title' | 'amount'>>();
      if (existing) {
        targetTitle = `[${existing.title || '无备注'}] ￥${existing.amount}`;
      }
    } catch {
      // ignore
    }

    const result = await env.DB.prepare(`DELETE FROM ${transactions} WHERE id = ?`).bind(id).run();
    const changed = result.meta?.changes ?? 0;

    // 记录删除日志
    const logDetails = `删除账目 ID ${id}: ${targetTitle}`;
    if (changed > 0) {
      await recordActivityLog(env.DB, 'web', 'delete', logDetails, env);
    }

    await recordApiRequestLog(env.DB, {
      method: 'DELETE',
      endpoint,
      statusCode: changed > 0 ? 200 : 404,
      success: changed > 0,
      ipAddress,
      userAgent,
      tokenUsed: request.headers.get('X-Admin-Token') || '',
      payloadSummary: changed > 0 ? logDetails : `删除失败：账目 ${id} 不存在`,
      executionMs: Date.now() - startTime,
    }, env);

    // 记录不存在时明确返回 404，避免前端把“没删掉”当成成功
    if (changed === 0) {
      return new Response(JSON.stringify({ success: false, message: `账目 ${id} 不存在，可能已被删除` }), {
        status: 404,
        headers: jsonHeaders(request, env),
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Transaction deleted' }), {
      headers: jsonHeaders(request, env),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await recordApiRequestLog(env.DB, {
      method: 'DELETE',
      endpoint,
      statusCode: 500,
      success: false,
      ipAddress,
      userAgent,
      tokenUsed: request.headers.get('X-Admin-Token') || '',
      payloadSummary: `删除失败: ${message}`,
      executionMs: Date.now() - startTime,
    }, env);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: jsonHeaders(request, env),
    });
  }
};
