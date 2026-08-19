import {
  cleanSecretString,
  deleteAdminSession,
  type SharedEnv,
} from '../_shared';

interface Env extends SharedEnv {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const token = cleanSecretString(
    request.headers.get('X-Admin-Token') ||
      request.headers.get('x-admin-token')
  );

  if (env.DB && token) {
    await deleteAdminSession(env.DB, token);
  }

  return new Response(JSON.stringify({ success: true, message: 'Logged out' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
