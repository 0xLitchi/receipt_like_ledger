// MCP（Model Context Protocol）只读查询端点：POST /api/mcp
// - 鉴权：Authorization: Bearer <ACCESS_TOKEN>，或管理员会话（X-Admin-Token / Bearer 会话 token）
// - 开关：后台 General 页的 mcp_enabled 设置，默认关闭
// - 审计：每次请求写入 mcp_call_logs（后台 MCP 调用日志页可查）
import {
  cleanSecretString,
  getClientIp,
  getCorsHeaders,
  isAdminAuthorized,
  isMcpEnabled,
  isValidSessionToken,
  readBearerToken,
  recordMcpCallLog,
  type McpCallStatus,
  type SharedEnv,
} from './_shared';
import { handleRpc } from './_mcp';

interface Env extends SharedEnv {}

type McpAuthMode = 'access_token' | 'admin_session' | 'admin' | 'none';

const MCP_ALLOWED_HEADERS =
  'Content-Type, Authorization, X-Admin-Token, Mcp-Session-Id, MCP-Protocol-Version';

const corsHeaders = (request: Request, env: Env): Record<string, string> => {
  const cors = getCorsHeaders(request, env);
  if (cors['Access-Control-Allow-Origin']) {
    cors['Access-Control-Allow-Headers'] = MCP_ALLOWED_HEADERS;
  }
  return cors;
};

const jsonHeaders = (
  request: Request,
  env: Env,
  extra: Record<string, string> = {}
): Record<string, string> => ({
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  ...corsHeaders(request, env),
  ...extra,
});

const jsonResponse = (
  request: Request,
  env: Env,
  body: unknown,
  status = 200,
  extra: Record<string, string> = {}
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders(request, env, extra),
  });

const rpcErrorBody = (code: number, message: string): Record<string, unknown> => ({
  jsonrpc: '2.0',
  id: null,
  error: { code, message },
});

/** 解析调用方凭证：优先 ACCESS_TOKEN，其次管理员会话 token / 管理员凭证 */
const resolveAuth = async (
  request: Request,
  env: Env,
  url: URL
): Promise<{ mode: McpAuthMode }> => {
  const bearer = readBearerToken(request);
  const expectedAccessToken = cleanSecretString(env.ACCESS_TOKEN);

  if (expectedAccessToken && bearer && bearer === expectedAccessToken) {
    return { mode: 'access_token' };
  }

  if (bearer && env.DB && (await isValidSessionToken(env.DB, bearer))) {
    return { mode: 'admin_session' };
  }

  if (await isAdminAuthorized(env.DB, env, request, url)) {
    return { mode: 'admin' };
  }

  return { mode: 'none' };
};

const summarizeParams = (message: unknown): string => {
  if (typeof message !== 'object' || message === null) return '';
  const params = (message as Record<string, unknown>).params;
  if (params === undefined) return '';
  try {
    const text = JSON.stringify(params);
    return text.length > 800 ? `${text.slice(0, 800)}…` : text;
  } catch {
    return '';
  }
};

const readClientInfo = (message: unknown): { name?: string; version?: string } => {
  if (typeof message !== 'object' || message === null) return {};
  const params = (message as Record<string, unknown>).params;
  if (typeof params !== 'object' || params === null) return {};
  const clientInfo = (params as Record<string, unknown>).clientInfo;
  if (typeof clientInfo !== 'object' || clientInfo === null) return {};
  const info = clientInfo as Record<string, unknown>;
  return {
    name: typeof info.name === 'string' ? info.name.slice(0, 100) : undefined,
    version: typeof info.version === 'string' ? info.version.slice(0, 50) : undefined,
  };
};

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(context.request, context.env),
  });
};

// 不提供服务器推送的 SSE 流：明确告知客户端只支持 POST
export const onRequestGet: PagesFunction<Env> = async (context) => {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'MCP 端点仅支持 POST（Streamable HTTP，无服务端 SSE 推送）',
    }),
    {
      status: 405,
      headers: jsonHeaders(context.request, context.env, { Allow: 'POST, OPTIONS, DELETE' }),
    }
  );
};

// 无状态服务，没有需要终止的会话
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(context.request, context.env),
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  const logMeta = {
    ipAddress,
    userAgent,
  };

  const auth = await resolveAuth(request, env, url);
  if (auth.mode === 'none') {
    context.waitUntil(
      recordMcpCallLog(env.DB, {
        method: 'http',
        status: 'unauthorized',
        errorMessage: '缺少或错误的外部访问令牌',
        authMode: 'none',
        ...logMeta,
      })
    );
    return jsonResponse(
      request,
      env,
      rpcErrorBody(-32001, '未授权：请携带 Authorization: Bearer <ACCESS_TOKEN>'),
      401,
      { 'WWW-Authenticate': 'Bearer realm="receipt-like-ledger"' }
    );
  }

  if (!env.DB) {
    return jsonResponse(request, env, rpcErrorBody(-32000, 'D1 数据库未配置'), 500);
  }

  if (!(await isMcpEnabled(env.DB))) {
    context.waitUntil(
      recordMcpCallLog(env.DB, {
        method: 'http',
        status: 'disabled',
        errorMessage: 'MCP 服务未开启',
        authMode: auth.mode,
        ...logMeta,
      })
    );
    return jsonResponse(
      request,
      env,
      rpcErrorBody(-32002, 'MCP 服务未开启，请先在后台 General 设置中启用'),
      403
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    context.waitUntil(
      recordMcpCallLog(env.DB, {
        method: 'http',
        status: 'error',
        errorMessage: '请求体不是合法 JSON',
        authMode: auth.mode,
        ...logMeta,
      })
    );
    return jsonResponse(request, env, rpcErrorBody(-32700, 'Parse error'), 400);
  }

  const isBatch = Array.isArray(body);
  const messages: unknown[] = isBatch ? (body as unknown[]) : [body];

  if (messages.length === 0) {
    return jsonResponse(request, env, rpcErrorBody(-32600, 'Invalid Request'), 400);
  }

  const responses: unknown[] = [];

  for (const message of messages) {
    const startedAt = Date.now();
    const outcome = await handleRpc(env.DB, message);
    const client = readClientInfo(message);

    const status: McpCallStatus = outcome.ok ? 'ok' : 'error';
    context.waitUntil(
      recordMcpCallLog(env.DB, {
        method: outcome.method,
        toolName: outcome.toolName,
        status,
        errorMessage: outcome.errorMessage,
        paramsSummary: summarizeParams(message),
        durationMs: Date.now() - startedAt,
        clientName: client.name,
        clientVersion: client.version,
        authMode: auth.mode,
        ...logMeta,
      })
    );

    if (outcome.response !== null) responses.push(outcome.response);
  }

  // 全部都是通知（notification）时按规范返回 202，无响应体
  if (responses.length === 0) {
    return new Response(null, {
      status: 202,
      headers: jsonHeaders(request, env),
    });
  }

  return jsonResponse(request, env, isBatch ? responses : responses[0]);
};
