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

        if (url.startsWith('/api/settings')) return json({ success: true, data: { theme_style: 'receipt' } });
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
          return json({
            success: true,
            hasFullAccess: authed,
            data: sample.map((t, i) => ({ id: `t${i}`, ...t })),
          });
        }
        return json({ success: false, message: 'not found' });
      });
    },
  };
}
