// MCP（Model Context Protocol）只读查询服务：工具定义、参数校验、D1 查询与 JSON-RPC 分发。
// 这里不处理 HTTP 鉴权与调用日志，那些由 mcp.ts 负责。
import type { TransactionRow } from './_shared';

export const MCP_LATEST_PROTOCOL_VERSION = '2025-06-18';
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;

export const MCP_SERVER_INFO = {
  name: 'receipt-like-ledger',
  title: '小票记账本 (Receipt Like Ledger)',
  version: '1.0.0',
} as const;

export const MCP_INSTRUCTIONS =
  '小票记账本只读查询服务。金额单位为人民币元，正数表示收入、负数表示支出；日期格式 YYYY-MM-DD。' +
  '本服务不提供新增、修改或删除账目的能力。可先调用 list_filter_options 了解可用的月份、成员与分类，' +
  '再用 list_transactions 查看明细，用 summarize_transactions 做汇总统计。';

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: true;
    destructiveHint: false;
    idempotentHint: true;
    openWorldHint: false;
  };
}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const FILTER_PROPERTIES: Record<string, unknown> = {
  month: {
    type: 'string',
    description: '月份，格式 YYYY-MM，例如 2026-08',
  },
  start_date: {
    type: 'string',
    description: '起始日期（含），格式 YYYY-MM-DD',
  },
  end_date: {
    type: 'string',
    description: '结束日期（含），格式 YYYY-MM-DD',
  },
  member: {
    type: 'string',
    description: '成员，精确匹配，例如 荔枝',
  },
  category: {
    type: 'string',
    description: '分类；可传主分类（如 杂项），也可传 主分类/子分类（如 杂项/麻将）',
  },
  subcategory: {
    type: 'string',
    description: '子分类，精确匹配，例如 麻将',
  },
  type: {
    type: 'string',
    enum: ['all', 'income', 'expense'],
    description: '收支类型：all 全部 / income 仅收入 / expense 仅支出',
    default: 'all',
  },
  keyword: {
    type: 'string',
    description: '关键词，模糊匹配备注、成员、分类与账本名',
  },
  ledger: {
    type: 'string',
    description: '账本名，精确匹配，例如 Default',
  },
};

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'list_transactions',
    title: '查询账目明细',
    description:
      '按月份、日期区间、成员、分类、收支类型或关键词查询账目明细，支持分页。' +
      '返回命中总数、整体收支汇总与当前页明细。只读，不会修改任何数据。',
    inputSchema: {
      type: 'object',
      properties: {
        ...FILTER_PROPERTIES,
        limit: {
          type: 'integer',
          description: '返回条数上限，1-500',
          minimum: 1,
          maximum: 500,
          default: 100,
        },
        offset: {
          type: 'integer',
          description: '分页偏移量，从 0 开始',
          minimum: 0,
          default: 0,
        },
      },
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: 'summarize_transactions',
    title: '汇总账目',
    description:
      '对满足筛选条件的账目做收支汇总，可按分类、成员、月份或日期分组。' +
      '分类分组使用“主分类/子分类”作为键（无子分类时只返回主分类）。只读。',
    inputSchema: {
      type: 'object',
      properties: {
        ...FILTER_PROPERTIES,
        group_by: {
          type: 'string',
          enum: ['none', 'category', 'member', 'month', 'day'],
          description: '分组维度：none 只返回总计 / category 分类 / member 成员 / month 月份 / day 日期',
          default: 'none',
        },
        top: {
          type: 'integer',
          description: '分组结果最多返回多少组，1-200',
          minimum: 1,
          maximum: 200,
          default: 50,
        },
      },
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: 'list_filter_options',
    title: '列出可用筛选项',
    description:
      '列出账本中实际出现过的月份（含条数与净额）、成员、主分类、分类标签与账本名，' +
      '便于调用其他查询工具前确认取值。只读。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: 'get_transaction',
    title: '按 ID 查询单条账目',
    description: '按账目 ID 查询一条明细。只读。',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '账目 ID，可从 list_transactions 的返回结果中获得',
        },
      },
      required: ['id'],
    },
    annotations: READ_ONLY_ANNOTATIONS,
  },
];

/* ------------------------------------------------------------------ */
/* 参数规范化与 SQL 构造                                               */
/* ------------------------------------------------------------------ */

export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

export interface NormalizedFilters {
  month: string;
  startDate: string;
  endDate: string;
  member: string;
  category: string;
  subcategory: string;
  type: 'all' | 'income' | 'expense';
  keyword: string;
  ledger: string;
}

export interface FilterSql {
  sql: string;
  bindings: unknown[];
}

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFilters(args: Record<string, unknown>): NormalizedFilters {
  const month = asString(args.month);
  const startDate = asString(args.start_date);
  const endDate = asString(args.end_date);

  if (month && !MONTH_RE.test(month)) {
    throw new ToolInputError(`month 格式应为 YYYY-MM，收到: ${month}`);
  }
  if (startDate && !DATE_RE.test(startDate)) {
    throw new ToolInputError(`start_date 格式应为 YYYY-MM-DD，收到: ${startDate}`);
  }
  if (endDate && !DATE_RE.test(endDate)) {
    throw new ToolInputError(`end_date 格式应为 YYYY-MM-DD，收到: ${endDate}`);
  }
  if (startDate && endDate && startDate > endDate) {
    throw new ToolInputError('start_date 不能晚于 end_date');
  }

  let category = asString(args.category);
  let subcategory = asString(args.subcategory);
  if (category.includes('/')) {
    const parts = category.split('/');
    category = parts[0].trim();
    const sub = parts.slice(1).join('/').trim();
    if (sub && !subcategory) subcategory = sub;
  }

  const rawType = asString(args.type).toLowerCase();
  if (rawType && rawType !== 'all' && rawType !== 'income' && rawType !== 'expense') {
    throw new ToolInputError(`type 只能是 all / income / expense，收到: ${rawType}`);
  }
  const type: NormalizedFilters['type'] =
    rawType === 'income' || rawType === 'expense' ? rawType : 'all';

  return {
    month,
    startDate,
    endDate,
    member: asString(args.member),
    category,
    subcategory,
    type,
    keyword: asString(args.keyword),
    ledger: asString(args.ledger),
  };
}

/** 转义 LIKE 通配符，避免用户输入的 % / _ 变成通配 */
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

export function buildTransactionWhere(filters: NormalizedFilters): FilterSql {
  const clauses: string[] = [];
  const bindings: unknown[] = [];

  if (filters.month) {
    clauses.push('date LIKE ?');
    bindings.push(`${filters.month}-%`);
  }
  if (filters.startDate) {
    clauses.push('date >= ?');
    bindings.push(filters.startDate);
  }
  if (filters.endDate) {
    clauses.push('date <= ?');
    bindings.push(filters.endDate);
  }
  if (filters.member) {
    clauses.push('member = ?');
    bindings.push(filters.member);
  }
  if (filters.category) {
    clauses.push('category = ?');
    bindings.push(filters.category);
  }
  if (filters.subcategory) {
    clauses.push('subcategory = ?');
    bindings.push(filters.subcategory);
  }
  if (filters.ledger) {
    clauses.push('ledger = ?');
    bindings.push(filters.ledger);
  }
  if (filters.type === 'income') {
    clauses.push('amount > 0');
  } else if (filters.type === 'expense') {
    clauses.push('amount < 0');
  }
  if (filters.keyword) {
    const like = `%${escapeLike(filters.keyword)}%`;
    clauses.push(
      "(title LIKE ? ESCAPE '\\' OR member LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\'" +
        " OR subcategory LIKE ? ESCAPE '\\' OR ledger LIKE ? ESCAPE '\\')"
    );
    bindings.push(like, like, like, like, like);
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    bindings,
  };
}

/* ------------------------------------------------------------------ */
/* 汇总与分组                                                          */
/* ------------------------------------------------------------------ */

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface AggregateSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  count: number;
}

export function summarizeRows(rows: TransactionRow[]): AggregateSummary {
  let income = 0;
  let expense = 0;
  rows.forEach((row) => {
    const amount = Number(row.amount) || 0;
    if (amount > 0) income += amount;
    else expense += Math.abs(amount);
  });

  return {
    totalIncome: round2(income),
    totalExpense: round2(expense),
    netBalance: round2(income - expense),
    count: rows.length,
  };
}

export type GroupBy = 'none' | 'category' | 'member' | 'month' | 'day';

export interface GroupSummary extends AggregateSummary {
  key: string;
}

const groupKeyOf = (row: TransactionRow, groupBy: GroupBy): string => {
  switch (groupBy) {
    case 'category': {
      const category = row.category || '未分类';
      return row.subcategory ? `${category}/${row.subcategory}` : category;
    }
    case 'member':
      return row.member || '未指定';
    case 'month':
      return (row.date || '').substring(0, 7) || '未知月份';
    case 'day':
      return row.date || '未知日期';
    default:
      return 'all';
  }
};

export function groupRows(rows: TransactionRow[], groupBy: GroupBy): GroupSummary[] {
  if (groupBy === 'none') return [];

  const map = new Map<string, TransactionRow[]>();
  rows.forEach((row) => {
    const key = groupKeyOf(row, groupBy);
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  });

  const groups: GroupSummary[] = Array.from(map.entries()).map(([key, list]) => ({
    key,
    ...summarizeRows(list),
  }));

  if (groupBy === 'month' || groupBy === 'day') {
    groups.sort((a, b) => b.key.localeCompare(a.key));
  } else {
    groups.sort(
      (a, b) => b.totalExpense - a.totalExpense || a.key.localeCompare(b.key, 'zh-CN')
    );
  }

  return groups;
}

/* ------------------------------------------------------------------ */
/* 工具执行                                                            */
/* ------------------------------------------------------------------ */

const requireDb = (db: D1Database | undefined): D1Database => {
  if (!db) throw new Error('D1 数据库未配置，无法执行查询');
  return db;
};

const runList = async (db: D1Database, args: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const filters = parseFilters(args);
  const { sql: whereSql, bindings } = buildTransactionWhere(filters);
  const limit = asInt(args.limit, 100, 1, 500);
  const offset = asInt(args.offset, 0, 0, 1_000_000);

  const aggregateSql =
    'SELECT COUNT(*) AS total,' +
    ' SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,' +
    ' SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS expense' +
    ` FROM transactions ${whereSql}`;
  const aggregateStmt = db.prepare(aggregateSql);
  const aggregate = await (bindings.length > 0
    ? aggregateStmt.bind(...bindings)
    : aggregateStmt
  ).first<{ total: number | null; income: number | null; expense: number | null }>();

  const listSql =
    `SELECT * FROM transactions ${whereSql}` +
    ' ORDER BY date DESC, created_at DESC, id ASC LIMIT ? OFFSET ?';
  const { results } = await db
    .prepare(listSql)
    .bind(...bindings, limit, offset)
    .all<TransactionRow>();

  const total = Number(aggregate?.total ?? 0);
  const income = Number(aggregate?.income ?? 0);
  const expense = Number(aggregate?.expense ?? 0);

  return {
    filters,
    pagination: {
      limit,
      offset,
      returned: (results || []).length,
      total,
      has_more: offset + (results || []).length < total,
    },
    summary: {
      totalIncome: round2(income),
      totalExpense: round2(expense),
      netBalance: round2(income - expense),
      count: total,
    },
    transactions: results || [],
  };
};

const runSummarize = async (
  db: D1Database,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const filters = parseFilters(args);
  const { sql: whereSql, bindings } = buildTransactionWhere(filters);

  const rawGroupBy = asString(args.group_by) || 'none';
  const allowedGroupBy: GroupBy[] = ['none', 'category', 'member', 'month', 'day'];
  if (!allowedGroupBy.includes(rawGroupBy as GroupBy)) {
    throw new ToolInputError(`group_by 只能是 ${allowedGroupBy.join(' / ')}`);
  }
  const groupBy = rawGroupBy as GroupBy;
  const top = asInt(args.top, 50, 1, 200);

  const statement = db.prepare(
    `SELECT * FROM transactions ${whereSql} ORDER BY date DESC, created_at DESC, id ASC`
  );
  const { results } = await (bindings.length > 0
    ? statement.bind(...bindings)
    : statement
  ).all<TransactionRow>();

  const rows = results || [];
  const groups = groupRows(rows, groupBy);

  return {
    filters,
    summary: summarizeRows(rows),
    group_by: groupBy,
    groups: groups.slice(0, top),
    groups_truncated: groups.length > top,
  };
};

const runListFilterOptions = async (db: D1Database): Promise<Record<string, unknown>> => {
  const months = await db
    .prepare(
      `SELECT substr(date, 1, 7) AS month, COUNT(*) AS count, SUM(amount) AS net
       FROM transactions
       WHERE date IS NOT NULL AND date <> ''
       GROUP BY month
       ORDER BY month DESC`
    )
    .all<{ month: string; count: number; net: number }>();

  const members = await db
    .prepare(
      `SELECT DISTINCT member FROM transactions
       WHERE member IS NOT NULL AND member <> '' ORDER BY member`
    )
    .all<{ member: string }>();

  const categories = await db
    .prepare(
      `SELECT DISTINCT category FROM transactions
       WHERE category IS NOT NULL AND category <> '' ORDER BY category`
    )
    .all<{ category: string }>();

  const subcategories = await db
    .prepare(
      `SELECT DISTINCT category, subcategory FROM transactions
       WHERE subcategory IS NOT NULL AND subcategory <> ''
       ORDER BY category, subcategory`
    )
    .all<{ category: string; subcategory: string }>();

  const ledgers = await db
    .prepare(
      `SELECT DISTINCT ledger FROM transactions
       WHERE ledger IS NOT NULL AND ledger <> '' ORDER BY ledger`
    )
    .all<{ ledger: string }>();

  return {
    months: (months.results || []).map((row) => ({
      month: row.month,
      count: Number(row.count) || 0,
      net: round2(Number(row.net) || 0),
    })),
    members: (members.results || []).map((row) => row.member),
    categories: (categories.results || []).map((row) => row.category),
    category_labels: (subcategories.results || []).map((row) =>
      row.subcategory ? `${row.category}/${row.subcategory}` : row.category
    ),
    ledgers: (ledgers.results || []).map((row) => row.ledger),
  };
};

const runGetTransaction = async (
  db: D1Database,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const id = asString(args.id);
  if (!id) throw new ToolInputError('缺少必填参数 id');

  const row = await db
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .bind(id)
    .first<TransactionRow>();

  if (!row) throw new ToolInputError(`未找到 id 为 ${id} 的账目`);

  return { transaction: row };
};

export async function executeTool(
  db: D1Database | undefined,
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const database = requireDb(db);

  switch (name) {
    case 'list_transactions':
      return runList(database, args);
    case 'summarize_transactions':
      return runSummarize(database, args);
    case 'list_filter_options':
      return runListFilterOptions(database);
    case 'get_transaction':
      return runGetTransaction(database, args);
    default:
      throw new ToolInputError(`未知工具: ${name}`);
  }
}

/* ------------------------------------------------------------------ */
/* JSON-RPC 分发                                                       */
/* ------------------------------------------------------------------ */

export interface RpcOutcome {
  /** 需要回给客户端的 JSON-RPC 响应；通知类请求为 null */
  response: Record<string, unknown> | null;
  method: string;
  toolName?: string;
  ok: boolean;
  errorMessage?: string;
}

const resultResponse = (id: unknown, result: unknown): Record<string, unknown> => ({
  jsonrpc: '2.0',
  id: id === undefined ? null : id,
  result,
});

const errorResponse = (
  id: unknown,
  code: number,
  message: string
): Record<string, unknown> => ({
  jsonrpc: '2.0',
  id: id === undefined ? null : id,
  error: { code, message },
});

const asParams = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export async function handleRpc(
  db: D1Database | undefined,
  message: unknown
): Promise<RpcOutcome> {
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    return {
      response: errorResponse(null, -32600, 'Invalid Request'),
      method: 'invalid',
      ok: false,
      errorMessage: 'Invalid Request',
    };
  }

  const msg = message as Record<string, unknown>;
  const method = typeof msg.method === 'string' ? msg.method : '';
  const hasId = Object.prototype.hasOwnProperty.call(msg, 'id');
  const id = msg.id;

  if (msg.jsonrpc !== '2.0' || !method) {
    return {
      response: errorResponse(id, -32600, 'Invalid Request'),
      method: method || 'invalid',
      ok: false,
      errorMessage: 'Invalid Request',
    };
  }

  const params = asParams(msg.params);

  if (method.startsWith('notifications/')) {
    return { response: null, method, ok: true };
  }

  switch (method) {
    case 'initialize': {
      const requested = asString(params.protocolVersion);
      const protocolVersion = (MCP_SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(
        requested
      )
        ? requested
        : MCP_LATEST_PROTOCOL_VERSION;

      return {
        response: hasId
          ? resultResponse(id, {
              protocolVersion,
              capabilities: { tools: { listChanged: false } },
              serverInfo: MCP_SERVER_INFO,
              instructions: MCP_INSTRUCTIONS,
            })
          : null,
        method,
        ok: true,
      };
    }

    case 'ping':
      return { response: hasId ? resultResponse(id, {}) : null, method, ok: true };

    case 'tools/list':
      return {
        response: hasId ? resultResponse(id, { tools: MCP_TOOLS }) : null,
        method,
        ok: true,
      };

    case 'tools/call': {
      const name = asString(params.name);
      if (!name) {
        return {
          response: errorResponse(id, -32602, 'tools/call 缺少 tool name'),
          method,
          ok: false,
          errorMessage: 'tools/call 缺少 tool name',
        };
      }

      const args = asParams(params.arguments);
      try {
        const payload = await executeTool(db, name, args);
        return {
          response: hasId
            ? resultResponse(id, {
                content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
                structuredContent: payload,
                isError: false,
              })
            : null,
          method,
          toolName: name,
          ok: true,
        };
      } catch (error: unknown) {
        const messageText = error instanceof Error ? error.message : String(error);
        return {
          response: hasId
            ? resultResponse(id, {
                content: [{ type: 'text', text: `查询失败: ${messageText}` }],
                isError: true,
              })
            : null,
          method,
          toolName: name,
          ok: false,
          errorMessage: messageText,
        };
      }
    }

    default:
      return {
        response: hasId
          ? errorResponse(id, -32601, `Method not found: ${method}`)
          : null,
        method,
        ok: false,
        errorMessage: `Method not found: ${method}`,
      };
  }
}
