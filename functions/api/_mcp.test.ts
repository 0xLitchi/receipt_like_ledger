import { describe, expect, it } from 'vitest';
import {
  buildTransactionWhere,
  groupRows,
  handleRpc,
  MCP_LATEST_PROTOCOL_VERSION,
  MCP_TOOLS,
  parseFilters,
  summarizeRows,
  ToolInputError,
} from './_mcp';
import type { TransactionRow } from './_shared';

const row = (over: Partial<TransactionRow>): TransactionRow => ({
  id: Math.random().toString(36),
  title: '',
  date: '2026-08-01',
  amount: -10,
  member: '荔枝',
  category: '餐饮',
  subcategory: '',
  ledger: 'Default',
  ...over,
});

describe('parseFilters', () => {
  it('splits category label into main category and subcategory', () => {
    const filters = parseFilters({ category: '杂项/麻将', month: '2026-08' });
    expect(filters.category).toBe('杂项');
    expect(filters.subcategory).toBe('麻将');
    expect(filters.month).toBe('2026-08');
    expect(filters.type).toBe('all');
  });

  it('rejects malformed month and date values', () => {
    expect(() => parseFilters({ month: '2026-8' })).toThrow(ToolInputError);
    expect(() => parseFilters({ start_date: '2026/08/01' })).toThrow(ToolInputError);
    expect(() => parseFilters({ start_date: '2026-09-01', end_date: '2026-08-01' })).toThrow(
      ToolInputError
    );
  });

  it('rejects unknown transaction type', () => {
    expect(() => parseFilters({ type: 'transfer' })).toThrow(ToolInputError);
  });
});

describe('buildTransactionWhere', () => {
  it('builds clauses and bindings for common filters', () => {
    const filters = parseFilters({
      month: '2026-08',
      member: '荔枝',
      category: '杂项/麻将',
      type: 'expense',
      ledger: 'Default',
    });
    const { sql, bindings } = buildTransactionWhere(filters);

    expect(sql).toContain('date LIKE ?');
    expect(sql).toContain('member = ?');
    expect(sql).toContain('category = ?');
    expect(sql).toContain('subcategory = ?');
    expect(sql).toContain('amount < 0');
    expect(bindings).toEqual(['2026-08-%', '荔枝', '杂项', '麻将', 'Default']);
  });

  it('escapes LIKE wildcards in keyword search', () => {
    const { sql, bindings } = buildTransactionWhere(parseFilters({ keyword: '50%_off' }));
    expect(sql).toContain("ESCAPE '\\'");
    expect(bindings).toEqual(['%50\\%\\_off%', '%50\\%\\_off%', '%50\\%\\_off%', '%50\\%\\_off%', '%50\\%\\_off%']);
  });

  it('returns an empty WHERE when no filters are given', () => {
    expect(buildTransactionWhere(parseFilters({}))).toEqual({ sql: '', bindings: [] });
  });
});

describe('summarizeRows', () => {
  it('separates income and expense and rounds to cents', () => {
    const rows = [
      row({ amount: 5000.005, category: '工资' }),
      row({ amount: -1000 }),
      row({ amount: -30.335 }),
      row({ amount: 0.1 }),
    ];
    expect(summarizeRows(rows)).toEqual({
      totalIncome: 5000.11,
      totalExpense: 1030.34,
      netBalance: 3969.77,
      count: 4,
    });
  });
});

describe('groupRows', () => {
  const rows = [
    row({ amount: -30, category: '餐饮', subcategory: '' }),
    row({ amount: -50, category: '餐饮', subcategory: '外卖' }),
    row({ amount: -1000, category: '住房', subcategory: '房租' }),
    row({ amount: 5000, category: '工资', subcategory: '' }),
  ];

  it('uses 主分类/子分类 labels and sorts by expense desc', () => {
    expect(groupRows(rows, 'category').map((g) => [g.key, g.totalExpense])).toEqual([
      ['住房/房租', 1000],
      ['餐饮/外卖', 50],
      ['餐饮', 30],
      ['工资', 0],
    ]);
  });

  it('sorts month groups in reverse chronological order', () => {
    const months = groupRows(
      [
        row({ date: '2026-07-02', amount: -10 }),
        row({ date: '2026-08-02', amount: -20 }),
        row({ date: '2026-08-03', amount: -30 }),
      ],
      'month'
    );
    expect(months.map((g) => g.key)).toEqual(['2026-08', '2026-07']);
    expect(months[0].totalExpense).toBe(50);
  });

  it('returns no groups for group_by none', () => {
    expect(groupRows(rows, 'none')).toEqual([]);
  });
});

describe('MCP tools', () => {
  it('exposes only read-only query tools', () => {
    expect(MCP_TOOLS.map((tool) => tool.name)).toEqual([
      'list_transactions',
      'summarize_transactions',
      'list_filter_options',
      'get_transaction',
    ]);
    MCP_TOOLS.forEach((tool) => {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.destructiveHint).toBe(false);
      expect(tool.inputSchema.type).toBe('object');
    });
  });
});

describe('handleRpc', () => {
  it('negotiates initialize and echoes supported protocol versions', async () => {
    const outcome = await handleRpc(undefined, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', clientInfo: { name: 'test-client' } },
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.response).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-03-26',
        serverInfo: { name: 'receipt-like-ledger' },
        capabilities: { tools: { listChanged: false } },
      },
    });
  });

  it('falls back to the latest protocol version for unknown clients', async () => {
    const outcome = await handleRpc(undefined, {
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: { protocolVersion: '1999-01-01' },
    });
    expect(outcome.response).toMatchObject({
      result: { protocolVersion: MCP_LATEST_PROTOCOL_VERSION },
    });
  });

  it('lists tools', async () => {
    const outcome = await handleRpc(undefined, { jsonrpc: '2.0', id: 3, method: 'tools/list' });
    expect(outcome.ok).toBe(true);
    expect(outcome.response).toMatchObject({
      result: { tools: MCP_TOOLS },
    });
  });

  it('returns protocol errors for unknown methods', async () => {
    const outcome = await handleRpc(undefined, { jsonrpc: '2.0', id: 4, method: 'tools/remove' });
    expect(outcome.ok).toBe(false);
    expect(outcome.response).toMatchObject({
      error: { code: -32601 },
    });
  });

  it('reports a tool error when the database is unavailable', async () => {
    const outcome = await handleRpc(undefined, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'list_transactions', arguments: {} },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.toolName).toBe('list_transactions');
    expect(outcome.response).toMatchObject({
      result: { isError: true },
    });
  });

  it('ignores notifications without producing a response', async () => {
    const outcome = await handleRpc(undefined, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.response).toBeNull();
  });
});
