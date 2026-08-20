import {
  cleanSecretString,
  getCorsHeaders,
  insertTransactionsBatch,
  isAdminAuthorized,
  readBearerToken,
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

// CORS 跨域预检处理
export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request, context.env),
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  let rawQueryToken = '';
  for (const [key, value] of url.searchParams.entries()) {
    const k = key.toLowerCase();
    if (k === 'token' || k === 'access_token') {
      rawQueryToken = value;
      break;
    }
  }
  const queryToken = cleanSecretString(rawQueryToken);
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

// 通过 API 插入/追加账单数据: POST /api/transactions
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  const expectedAccessToken = cleanSecretString(env.ACCESS_TOKEN);
  const bearerToken = readBearerToken(request);
  const queryToken = cleanSecretString(url.searchParams.get('token') || url.searchParams.get('access_token'));

  const isTokenAuthorized = !!(
    expectedAccessToken &&
    ((bearerToken && bearerToken === expectedAccessToken) || (queryToken && queryToken === expectedAccessToken))
  );
  const isAdmin = await isAdminAuthorized(env.DB, env, request, url);

  if (!isTokenAuthorized && !isAdmin) {
    return new Response(
      JSON.stringify({
        success: false,
        message: '未授权：请把 Token 拼接在请求 URL 中 (如 /api/transactions/<token>)，或在 Header/Query 中提供有效凭证',
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
    const source: 'web' | 'api' = isTokenAuthorized ? 'api' : 'web';
    const result = await insertTransactionsBatch(env.DB, body, source);

    return new Response(JSON.stringify(result), {
      status: result.status,
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
