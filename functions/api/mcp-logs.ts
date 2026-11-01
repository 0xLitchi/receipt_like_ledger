// MCP 调用日志（仅管理员）：GET /api/mcp-logs
import {
  ensureMcpCallLogsTable,
  getCorsHeaders,
  isAdminAuthorized,
  type McpCallLogRow,
  type SharedEnv,
} from './_shared';

interface Env extends SharedEnv {}

const jsonHeaders = (
  request: Request,
  env: Env,
  extra: Record<string, string> = {}
): Record<string, string> => ({
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!(await isAdminAuthorized(env.DB, env, request, url))) {
    return new Response(
      JSON.stringify({ success: false, message: '未授权：管理员凭证错误或未配置' }),
      {
        status: 401,
        headers: jsonHeaders(request, env),
      }
    );
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: true, data: [] }), {
      headers: jsonHeaders(request, env),
    });
  }

  try {
    await ensureMcpCallLogsTable(env.DB);

    // 会话探测：只判断鉴权是否有效，不必读回日志内容
    if (url.searchParams.get('probe') === '1') {
      return new Response(JSON.stringify({ success: true }), {
        headers: jsonHeaders(request, env),
      });
    }

    const rawLimit = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit)
      ? Math.min(500, Math.max(1, Math.trunc(rawLimit)))
      : 200;

    const { results } = await env.DB.prepare(
      'SELECT * FROM mcp_call_logs ORDER BY created_at DESC, timestamp DESC LIMIT ?'
    )
      .bind(limit)
      .all<McpCallLogRow>();

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
