import {
  cleanSecretString,
  createAdminSession,
  type SharedEnv,
} from '../_shared';

interface Env extends SharedEnv {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { password?: string };
    const inputPass = cleanSecretString(body.password);
    const adminPassword = cleanSecretString(context.env.ADMIN_PASSWORD);

    if (!adminPassword) {
      return new Response(JSON.stringify({ success: false, message: '服务端未配置 ADMIN_PASSWORD 环境变量' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!inputPass || inputPass !== adminPassword) {
      return new Response(JSON.stringify({ success: false, message: '密码错误，请重新输入' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!context.env.DB) {
      return new Response(JSON.stringify({ success: false, message: 'D1 DB binding not found，无法签发会话' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = await createAdminSession(context.env.DB);
    return new Response(JSON.stringify({ success: true, token, message: 'Authentication successful' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
