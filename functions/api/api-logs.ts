import {
  ensureApiRequestLogsTable,
  getCorsHeaders,
  isAdminAuthorized,
  type ApiRequestLogRow,
  type SharedEnv,
} from './_shared';

interface Env extends SharedEnv {}

const jsonHeaders = (request: Request, env: Env, extra: Record<string, string> = {}): Record<string, string> => ({
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  ...getCorsHeaders(request, env),
  ...extra,
});

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request, context.env),
  });
};

// 获取 API 请求调用日志列表（仅限管理员访问）
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!(await isAdminAuthorized(env.DB, env, request, url))) {
    return new Response(JSON.stringify({ success: false, message: '未授权：管理员凭证错误或未配置' }), {
      status: 401,
      headers: jsonHeaders(request, env),
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: true, data: [] }), {
      headers: jsonHeaders(request, env),
    });
  }

  try {
    await ensureApiRequestLogsTable(env.DB);
    const { results } = await env.DB.prepare(
      'SELECT * FROM api_request_logs ORDER BY created_at DESC, timestamp DESC LIMIT 200'
    ).all<ApiRequestLogRow>();

    return new Response(JSON.stringify({ success: true, data: results || [] }), {
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
