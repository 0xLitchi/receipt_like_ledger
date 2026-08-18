interface Env {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const id = params.id as string;

  const authHeader = request.headers.get('X-Admin-Password');
  const expectedPassword = env.ADMIN_PASSWORD || 'admin';

  if (authHeader !== expectedPassword) {
    return new Response(JSON.stringify({ success: false, message: '未授权：管理员密码错误' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, message: 'D1 DB binding not found' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const item = await request.json() as any;
    const title = item.title || '';
    const date = item.date;
    const amount = Number(item.amount);
    const member = item.member;
    const category = item.category;
    const subcategory = item.subcategory || '';
    const ledger = item.ledger || 'Default';

    await env.DB.prepare(
      `UPDATE transactions 
       SET title = ?, date = ?, amount = ?, member = ?, category = ?, subcategory = ?, ledger = ?
       WHERE id = ?`
    ).bind(title, date, amount, member, category, subcategory, ledger, id).run();

    return new Response(JSON.stringify({ success: true, message: 'Transaction updated' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const id = params.id as string;

  const authHeader = request.headers.get('X-Admin-Password');
  const expectedPassword = env.ADMIN_PASSWORD || 'admin';

  if (authHeader !== expectedPassword) {
    return new Response(JSON.stringify({ success: false, message: '未授权：管理员密码错误' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, message: 'D1 DB binding not found' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true, message: 'Transaction deleted' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
