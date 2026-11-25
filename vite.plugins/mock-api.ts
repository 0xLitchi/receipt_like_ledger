// 本地开发用的 mock API 中间件：`MOCK_API=1 npm run dev` 时启用，无需 wrangler/D1
import type { Plugin } from 'vite';

interface MockTx {
  id: string;
  title: string;
  date: string;
  amount: number;
  member: string;
  category: string;
  subcategory: string;
  ledger: string;
  tx_type?: 'normal' | 'transfer';
  to_ledger?: string;
}

const sample: MockTx[] = [
  { id: 't0', title: '早餐·豆浆油条', date: '2026-10-20', amount: -12.5, member: '荔枝', category: '餐饮', subcategory: '早餐', ledger: 'Default', tx_type: 'normal', to_ledger: '' },
  { id: 't1', title: '超市采购', date: '2026-10-20', amount: -238.9, member: '扶正', category: '杂项', subcategory: '日用', ledger: 'Default', tx_type: 'normal', to_ledger: '' },
  { id: 't2', title: '月度定存', date: '2026-10-16', amount: 2000, member: '', category: '转账', subcategory: '储蓄划转', ledger: 'Default', tx_type: 'transfer', to_ledger: '储蓄' },
  { id: 't3', title: '房租', date: '2026-10-05', amount: -3900, member: '荔枝', category: '住房', subcategory: '押金', ledger: 'Default', tx_type: 'normal', to_ledger: '' },
  { id: 't4', title: '本月工资', date: '2026-10-10', amount: 12800, member: '扶正', category: '收入', subcategory: '工资', ledger: 'Default', tx_type: 'normal', to_ledger: '' },
  { id: 't5', title: '奶茶', date: '2026-10-18', amount: -18, member: '荔枝', category: '餐饮', subcategory: '饮料', ledger: 'Default', tx_type: 'normal', to_ledger: '' },
  { id: 't6', title: '地铁通勤', date: '2026-10-19', amount: -48, member: '扶正', category: '交通', subcategory: '地铁', ledger: 'Default', tx_type: 'normal', to_ledger: '' },
  { id: 't7', title: '', date: '2026-10-19', amount: -6, member: '荔枝', category: '交通', subcategory: '公交', ledger: 'Default', tx_type: 'normal', to_ledger: '' },
  { id: 't8', title: '理财利息', date: '2026-10-15', amount: 85.6, member: '扶正', category: '收入', subcategory: '理财', ledger: '储蓄', tx_type: 'normal', to_ledger: '' },
  { id: 't9', title: '花呗还款', date: '2026-09-28', amount: -1520.3, member: '荔枝', category: '账单', subcategory: '花呗', ledger: 'Default', tx_type: 'normal', to_ledger: '' },
  { id: 't10', title: '麻将赢钱', date: '2026-09-15', amount: 320, member: '扶正', category: '杂项', subcategory: '麻将', ledger: 'Default', tx_type: 'normal', to_ledger: '' },
  { id: 't11', title: '午饭', date: '2026-09-12', amount: -32, member: '荔枝', category: '餐饮', subcategory: '午餐', ledger: 'Default', tx_type: 'normal', to_ledger: '' },
  { id: 't12', title: '基金定投', date: '2026-09-10', amount: -1000, member: '荔枝', category: '投资', subcategory: '基金', ledger: '储蓄', tx_type: 'normal', to_ledger: '' },
];

let mockAuthed = true;
// 模拟服务端 ACCESS_TOKEN 校验：?token= 命中才返回明文
const mockAccessToken = 'mock_access_token';

function readJsonBody(req: NodeJS.ReadableStream): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += String(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        resolve({});
      }
    });
  });
}

export function mockApi(): Plugin {
  const store: MockTx[] = sample.map((t) => ({ ...t }));

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
          const parsedUrl = new URL(url, 'http://localhost');
          const idMatch = parsedUrl.pathname.match(/^\/api\/transactions\/(.+)$/);
          const method = (req.method || 'GET').toUpperCase();

          if (method === 'POST') {
            void readJsonBody(req).then((body) => {
              const id = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const isTransfer = body.tx_type === 'transfer' || Boolean(body.to_ledger);
              const nextItem: MockTx = {
                id,
                title: String(body.title ?? ''),
                date: String(body.date ?? new Date().toISOString().split('T')[0]),
                amount: isTransfer ? Math.abs(Number(body.amount) || 0) : Number(body.amount) || 0,
                member: isTransfer ? '' : String(body.member ?? '默认'),
                category: String(body.category ?? (isTransfer ? '转账' : '其它')),
                subcategory: isTransfer
                  ? String(body.subcategory ?? '').trim() || '内部转账'
                  : String(body.subcategory ?? ''),
                ledger: String(body.ledger ?? 'Default') || 'Default',
                tx_type: isTransfer ? 'transfer' : 'normal',
                to_ledger: isTransfer ? String(body.to_ledger ?? '') : '',
              };
              store.unshift(nextItem);
              json({ success: true, data: nextItem });
            });
            return;
          }

          if (method === 'PUT' && idMatch) {
            const targetId = decodeURIComponent(idMatch[1]);
            void readJsonBody(req).then((body) => {
              const idx = store.findIndex((item) => item.id === targetId);
              if (idx >= 0) {
                const isTransfer = body.tx_type === 'transfer' || Boolean(body.to_ledger);
                store[idx] = {
                  ...store[idx],
                  title: String(body.title ?? ''),
                  date: String(body.date ?? store[idx].date),
                  amount: isTransfer ? Math.abs(Number(body.amount) || 0) : Number(body.amount) || 0,
                  member: isTransfer ? '' : String(body.member ?? '默认'),
                  category: String(body.category ?? (isTransfer ? '转账' : '其它')),
                  subcategory: isTransfer
                    ? String(body.subcategory ?? '').trim() || '内部转账'
                    : String(body.subcategory ?? ''),
                  ledger: String(body.ledger ?? 'Default') || 'Default',
                  tx_type: isTransfer ? 'transfer' : 'normal',
                  to_ledger: isTransfer ? String(body.to_ledger ?? '') : '',
                };
              }
              json({ success: true, message: 'Transaction updated' });
            });
            return;
          }

          if (method === 'DELETE' && idMatch) {
            const targetId = decodeURIComponent(idMatch[1]);
            const idx = store.findIndex((item) => item.id === targetId);
            if (idx >= 0) store.splice(idx, 1);
            return json({ success: true, message: 'Transaction deleted' });
          }

          const q = parsedUrl.searchParams.get('token');
          const viaToken = q === mockAccessToken;
          return json({
            success: true,
            hasFullAccess: authed || viaToken,
            data: store,
          });
        }
        return json({ success: false, message: 'not found' });
      });
    },
  };
}
