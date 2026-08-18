interface Env {
  ADMIN_PASSWORD?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { password?: string };
    const adminPassword = context.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return new Response(JSON.stringify({ success: false, message: '服务端未配置 ADMIN_PASSWORD 环境变量' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.password && body.password === adminPassword) {
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
