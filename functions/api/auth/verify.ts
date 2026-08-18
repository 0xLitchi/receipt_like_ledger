interface Env {
  ADMIN_PASSWORD?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { password?: string };
    const adminPassword = context.env.ADMIN_PASSWORD;

    // 如果未设置 ADMIN_PASSWORD，默认开发密码为 "admin" 或禁止登录（若提供非空密码与默认密码匹配）
    const targetPassword = adminPassword || 'admin';

    if (body.password === targetPassword) {
      return new Response(JSON.stringify({ success: true, message: 'Authentication successful' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ success: false, message: '密码错误，请重新输入' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message || 'Server Error' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
