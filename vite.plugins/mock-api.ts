// 本地开发用的 mock API 中间件：`MOCK_API=1 npm run dev` 时启用，无需 wrangler/D1
import type { Plugin } from 'vite';

const sample = [
  { title: '早餐·豆浆油条', date: '2026-10-20', amount: -12.5, member: '荔枝', category: '餐饮', subcategory: '早餐', ledger: 'Default' },
  { title: '超市采购', date: '2026-10-20', amount: -238.9, member: '扶正', category: '杂项', subcategory: '日用', ledger: 'Default' },
  { title: '房租', date: '2026-10-05', amount: -3900, member: '荔枝', category: '住房', subcategory: '押金', ledger: 'Default' },
  { title: '本月工资', date: '2026-10-10', amount: 12800, member: '扶正', category: '收入', subcategory: '工资', ledger: 'Default' },
  { title: '奶茶', date: '2026-10-18', amount: -18, member: '荔枝', category: '餐饮', subcategory: '饮料', ledger: 'Default' },
  { title: '地铁通勤', date: '2026-10-19', amount: -48, member: '扶正', category: '交通', subcategory: '地铁', ledger: 'Default' },
  { title: '', date: '2026-10-19', amount: -6, member: '荔枝', category: '交通', subcategory: '公交', ledger: 'Default' },
  { title: '花呗还款', date: '2026-09-28', amount: -1520.3, member: '荔枝', category: '账单', subcategory: '花呗', ledger: 'Default' },
  { title: '麻将赢钱', date: '2026-09-15', amount: 320, member: '扶正', category: '杂项', subcategory: '麻将', ledger: 'Default' },
  { title: '午饭', date: '2026-09-12', amount: -32, member: '荔枝', category: '餐饮', subcategory: '午餐', ledger: 'Default' },
];

let mockAuthed = true;
// 模拟服务端 ACCESS_TOKEN 校验：?token= 命中才返回明文
const mockAccessToken = 'mock_access_token';
// 模拟后台 MCP 开关（MOCK_API=1 时可在 General 页切换）
let mockMcpEnabled = false;

const mockSettings = () => ({
  theme_style: 'receipt',
  mcp_enabled: mockMcpEnabled ? 'true' : 'false',
});

export function mockApi(): Plugin {
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) return next();
        // 带会话头即视为已登录，返回明文数据（模拟真实后端行为）
        const authed = mockAuthed;

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const json = (body: unknown) => res.end(JSON.stringify(body));

        if (url.startsWith('/api/settings')) {
          if (req.method === 'PUT') {
            let raw = '';
            req.on('data', (chunk: Buffer) => {
              raw += chunk.toString();
            });
            req.on('end', () => {
              try {
                const body = JSON.parse(raw || '{}') as { mcp_enabled?: unknown };
                if (typeof body.mcp_enabled === 'boolean') mockMcpEnabled = body.mcp_enabled;
              } catch {
                /* 模拟环境忽略非法请求体 */
              }
              json({ success: true, data: mockSettings() });
            });
            return;
          }
          return json({ success: true, data: mockSettings() });
        }
        if (url.startsWith('/api/mcp-logs'))
          return json({
            success: true,
            data: [
              { id: 'm1', timestamp: '2026-10-31 18:22:10', method: 'initialize', tool_name: '', status: 'ok', error_message: '', params_summary: '{"protocolVersion":"2025-06-18"}', duration_ms: 3, client_name: 'claude-code', client_version: '2.0.14', ip_address: '203.0.113.8', user_agent: 'claude-code/2.0.14', auth_mode: 'access_token' },
              { id: 'm2', timestamp: '2026-10-31 18:22:11', method: 'tools/call', tool_name: 'list_transactions', status: 'ok', error_message: '', params_summary: '{"month":"2026-10","type":"expense"}', duration_ms: 12, client_name: 'claude-code', client_version: '2.0.14', ip_address: '203.0.113.8', user_agent: 'claude-code/2.0.14', auth_mode: 'access_token' },
              { id: 'm3', timestamp: '2026-10-31 18:23:04', method: 'tools/call', tool_name: 'get_transaction', status: 'error', error_message: '未找到 id 为 nope 的账目', params_summary: '{"id":"nope"}', duration_ms: 5, client_name: 'curl', client_version: '8.7', ip_address: '198.51.100.2', user_agent: 'curl/8.7', auth_mode: 'access_token' },
            ],
          });
        if (url.startsWith('/api/auth/verify')) {
          mockAuthed = true;
          return json({ success: true, token: 'sess_mock' });
        }
        if (url.startsWith('/api/auth/logout')) return json({ success: true });
        if (url.startsWith('/api/logs'))
          return json({
            success: true,
            data: [
              { id: '1', timestamp: '2026-10-20 09:12', source: 'web', action: 'create', details: '新增 早餐·豆浆油条 -12.50' },
              { id: '2', timestamp: '2026-10-19 21:03', source: 'api', action: 'create', details: 'API 追加 奶茶 -18.00' },
            ],
          });
        if (url.startsWith('/api/api-logs'))
          return json({
            success: true,
            data: [
              { id: '1', timestamp: '2026-10-19 21:03', method: 'POST', endpoint: '/api/transactions', status_code: 200, success: 1, ip_address: '1.2.3.4', user_agent: 'Mozilla/5.0', token_used: '***', payload_summary: '奶茶 -18', execution_ms: 41 },
            ],
          });
        if (url.startsWith('/api/transactions')) {
          const q = new URL(url, 'http://localhost').searchParams.get('token');
          const viaToken = q === mockAccessToken;
          return json({
            success: true,
            hasFullAccess: authed || viaToken,
            data: sample.map((t, i) => ({ id: `t${i}`, ...t })),
          });
        }
        return json({ success: false, message: 'not found' });
      });
    },
  };
}
