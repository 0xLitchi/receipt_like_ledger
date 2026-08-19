import {
  getCorsHeaders,
  isAdminAuthorized,
  recordActivityLog,
  type SharedEnv,
  type TransactionRow,
} from '../_shared';

interface Env extends SharedEnv {}

const jsonHeaders = (request: Request, env: Env, extra: Record<string, string> = {}): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...getCorsHeaders(request, env),
  ...extra,
});

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
    // 先查一下被删除的记录信息用于日志记录
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

    // 记录删除日志 (网页端修改)
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
