interface Env {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
}

const cleanSecretString = (str?: string | null): string => {
  if (!str) return '';
  return str.replace(/[\r\n\t\s"']/g, '').trim();
};

const recordActivityLog = async (
  db: D1Database,
  source: 'web' | 'api' | 'import',
  action: 'create' | 'update' | 'delete' | 'batch_save',
  details: string
) => {
  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();

    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    await db.prepare(
      `INSERT INTO activity_logs (id, timestamp, source, action, details) VALUES (?, ?, ?, ?, ?)`
    ).bind(id, timestamp, source, action, details).run();
  } catch (e) {
    console.warn('Failed to record log', e);
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const id = params.id as string;
  const url = new URL(request.url);

  const rawAdminPass =
    request.headers.get('X-Admin-Password') ||
    request.headers.get('x-admin-password') ||
    url.searchParams.get('admin_password');

  const authHeader = cleanSecretString(rawAdminPass);
  const expectedPassword = cleanSecretString(env.ADMIN_PASSWORD);

  if (!expectedPassword || authHeader !== expectedPassword) {
    return new Response(JSON.stringify({ success: false, message: '未授权：管理员密码错误或未配置' }), {
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
    const member = item.member || '默认';
    const category = item.category || '其它';
    const subcategory = item.subcategory || '';
    const ledger = item.ledger || 'Default';

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
  const url = new URL(request.url);

  const rawAdminPass =
    request.headers.get('X-Admin-Password') ||
    request.headers.get('x-admin-password') ||
    url.searchParams.get('admin_password');

  const authHeader = cleanSecretString(rawAdminPass);
  const expectedPassword = cleanSecretString(env.ADMIN_PASSWORD);

  if (!expectedPassword || authHeader !== expectedPassword) {
    return new Response(JSON.stringify({ success: false, message: '未授权：管理员密码错误或未配置' }), {
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
    // 先查一下被删除的记录信息用于日志记录
    let targetTitle = id;
    try {
      const existing = await env.DB.prepare('SELECT title, amount FROM transactions WHERE id = ?').bind(id).first() as any;
      if (existing) {
        targetTitle = `[${existing.title || '无备注'}] ￥${existing.amount}`;
      }
    } catch (e) {
      // ignore
    }

    await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();

    // 记录删除日志 (网页端修改)
    const logDetails = `删除账目 ID ${id}: ${targetTitle}`;
    await recordActivityLog(env.DB, 'web', 'delete', logDetails);

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
