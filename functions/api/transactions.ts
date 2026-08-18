interface Env {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({
      success: false,
      message: 'D1 Binding DB not configured in Cloudflare environment',
      useFallback: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM transactions ORDER BY date DESC, created_at DESC'
    ).all();

    return new Response(JSON.stringify({ success: true, data: results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Verify Admin Password from header
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
    const id = item.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const title = item.title || '';
    const date = item.date;
    const amount = Number(item.amount);
    const member = item.member || '默认';
    const category = item.category || '其它';
    const subcategory = item.subcategory || '';
    const ledger = item.ledger || 'Default';

    await env.DB.prepare(
      `INSERT INTO transactions (id, title, date, amount, member, category, subcategory, ledger)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, title, date, amount, member, category, subcategory, ledger).run();

    return new Response(JSON.stringify({ success: true, data: { id, title, date, amount, member, category, subcategory, ledger } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
