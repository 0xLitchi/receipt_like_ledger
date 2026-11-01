import { describe, expect, it } from 'vitest';
import { onRequestPost } from './mcp';
import type { TransactionRow } from './_shared';

interface FakeLog {
  method: string;
  tool_name: string;
  status: string;
  auth_mode: string;
  params_summary: string;
}

/** 只为 MCP 链路服务的极简 D1 替身：识别本测试用到的 SQL 形状 */
class FakeDb {
  rows: TransactionRow[] = [
    {
      id: 'tx_aug_expense',
      title: '麻将',
      date: '2026-08-07',
      amount: -205.5,
      member: '扶正',
      category: '杂项',
      subcategory: '麻将',
      ledger: 'Default',
    },
    {
      id: 'tx_aug_income',
      title: '退押金',
      date: '2026-08-07',
      amount: 3900,
      member: '荔枝',
      category: '住房',
      subcategory: '押金',
      ledger: 'Default',
    },
    {
      id: 'tx_jul_expense',
      title: '账单',
      date: '2026-07-02',
      amount: -6883.42,
      member: '荔枝',
      category: '账单',
      subcategory: '招商银行',
      ledger: 'Default',
    },
  ];

  settings = new Map<string, string>([['mcp_enabled', 'true']]);
  logs: FakeLog[] = [];

  prepare(sql: string): D1PreparedStatement {
    return new FakeStatement(this, sql) as unknown as D1PreparedStatement;
  }

  first(sql: string, params: unknown[]): unknown {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('SELECT value FROM app_settings')) {
      const value = this.settings.get(String(params[0]));
      return value === undefined ? null : { value };
    }

    if (normalized.includes('COUNT(*) AS total') && normalized.includes('FROM transactions')) {
      const rows = this.filterRows(normalized, params);
      return {
        total: rows.length,
        income: rows.reduce((sum, row) => (row.amount > 0 ? sum + row.amount : sum), 0),
        expense: rows.reduce((sum, row) => (row.amount < 0 ? sum - row.amount : sum), 0),
      };
    }

    if (normalized.includes('FROM transactions WHERE id = ?')) {
      return this.rows.find((row) => row.id === params[0]) ?? null;
    }

    return null;
  }

  all(sql: string, params: unknown[]): unknown[] {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('SELECT * FROM transactions')) {
      let rows = this.filterRows(normalized, params);
      if (normalized.includes('LIMIT ? OFFSET ?')) {
        const limit = Number(params[params.length - 2]);
        const offset = Number(params[params.length - 1]);
        rows = rows.slice(offset, offset + limit);
      }
      return rows;
    }

    return [];
  }

  run(sql: string, params: unknown[]): void {
    if (sql.includes('INSERT INTO mcp_call_logs')) {
      this.logs.push({
        method: String(params[2]),
        tool_name: String(params[3]),
        status: String(params[4]),
        auth_mode: String(params[12]),
        params_summary: String(params[6]),
      });
    }
  }

  private filterRows(sql: string, params: unknown[]): TransactionRow[] {
    let rows = [...this.rows];
    let index = 0;
    // 只看 WHERE 子句，避免把 SELECT 里 SUM(CASE WHEN amount < 0 ...) 误当成筛选条件
    const where = sql.includes(' WHERE ') ? sql.slice(sql.indexOf(' WHERE ')) : '';

    if (where.includes('date LIKE ?')) {
      const prefix = String(params[index++]).replace(/%$/, '');
      rows = rows.filter((row) => row.date.startsWith(prefix));
    }
    if (where.includes('amount < 0')) rows = rows.filter((row) => row.amount < 0);
    if (where.includes('amount > 0')) rows = rows.filter((row) => row.amount > 0);

    return rows;
  }
}

class FakeStatement {
  private args: unknown[] = [];
  private db: FakeDb;
  private sql: string;

  constructor(db: FakeDb, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  bind(...args: unknown[]): FakeStatement {
    const next = new FakeStatement(this.db, this.sql);
    next.args = args;
    return next;
  }

  async first<T>(): Promise<T | null> {
    return this.db.first(this.sql, this.args) as T | null;
  }

  async all<T>(): Promise<D1Result<T>> {
    return {
      results: this.db.all(this.sql, this.args) as T[],
      success: true,
      meta: {},
    } as unknown as D1Result<T>;
  }

  async run(): Promise<D1Result<unknown>> {
    this.db.run(this.sql, this.args);
    return { results: [], success: true, meta: {} } as unknown as D1Result<unknown>;
  }
}

const makeContext = (db: FakeDb, body: unknown, token?: string) => {
  const waiting: Array<Promise<unknown>> = [];
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const request = new Request('https://ledger.example/api/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const context = {
    request,
    env: { DB: db as unknown as D1Database, ACCESS_TOKEN: 'test-access-token' },
    waitUntil: (promise: Promise<unknown>) => {
      waiting.push(promise);
    },
  } as unknown as Parameters<typeof onRequestPost>[0];

  return { context, waiting };
};

const post = async (db: FakeDb, body: unknown, token?: string) => {
  const { context, waiting } = makeContext(db, body, token);
  const response = await onRequestPost(context);
  await Promise.all(waiting);
  return { response, json: await response.json() };
};

describe('MCP HTTP endpoint', () => {
  it('rejects requests without an access token and records the attempt', async () => {
    const db = new FakeDb();
    const { response, json } = await post(db, { jsonrpc: '2.0', id: 1, method: 'tools/list' });

    expect(response.status).toBe(401);
    expect(json).toMatchObject({ error: { code: -32001 } });
    expect(db.logs).toHaveLength(1);
    expect(db.logs[0]).toMatchObject({ method: 'http', status: 'unauthorized' });
  });

  it('rejects requests while the admin toggle is off', async () => {
    const db = new FakeDb();
    db.settings.set('mcp_enabled', 'false');

    const { response, json } = await post(
      db,
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      'test-access-token'
    );

    expect(response.status).toBe(403);
    expect(json).toMatchObject({ error: { code: -32002 } });
    expect(db.logs[0]).toMatchObject({ status: 'disabled', auth_mode: 'access_token' });
  });

  it('serves initialize and tools/list when enabled', async () => {
    const db = new FakeDb();

    const init = await post(
      db,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          clientInfo: { name: 'vitest-client', version: '1.0.0' },
        },
      },
      'test-access-token'
    );
    expect(init.response.status).toBe(200);
    expect(init.json).toMatchObject({
      result: {
        protocolVersion: '2025-06-18',
        serverInfo: { name: 'receipt-like-ledger' },
      },
    });

    const list = await post(
      db,
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      'test-access-token'
    );
    expect(list.response.status).toBe(200);
    const tools = (list.json as { result: { tools: Array<{ name: string }> } }).result.tools;
    expect(tools.map((tool) => tool.name)).toContain('list_transactions');
    expect(db.logs.map((log) => log.method)).toEqual(['initialize', 'tools/list']);
  });

  it('runs list_transactions and returns structured query results', async () => {
    const db = new FakeDb();

    const { response, json } = await post(
      db,
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_transactions',
          arguments: { month: '2026-08', type: 'expense', limit: 10 },
        },
      },
      'test-access-token'
    );

    expect(response.status).toBe(200);
    const result = (json as {
      result: {
        isError: boolean;
        structuredContent: {
          summary: { totalExpense: number; count: number };
          transactions: Array<{ id: string }>;
        };
      };
    }).result;

    expect(result.isError).toBe(false);
    expect(result.structuredContent.summary).toEqual({
      totalIncome: 0,
      totalExpense: 205.5,
      netBalance: -205.5,
      count: 1,
    });
    expect(result.structuredContent.transactions.map((row) => row.id)).toEqual(['tx_aug_expense']);

    expect(db.logs).toHaveLength(1);
    expect(db.logs[0]).toMatchObject({
      method: 'tools/call',
      tool_name: 'list_transactions',
      status: 'ok',
      auth_mode: 'access_token',
    });
    expect(db.logs[0].params_summary).toContain('2026-08');
  });

  it('returns a tool error for an unknown transaction id', async () => {
    const db = new FakeDb();

    const { json } = await post(
      db,
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'get_transaction', arguments: { id: 'missing' } },
      },
      'test-access-token'
    );

    expect(json).toMatchObject({
      result: { isError: true },
    });
    expect(db.logs[0]).toMatchObject({ status: 'error', tool_name: 'get_transaction' });
  });
});
