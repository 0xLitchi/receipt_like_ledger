#!/usr/bin/env node
/**
 * 确定性生成 2025-10 至 2026-11（共 14 个月、月均 30 条、总计 420 条）测试账单数据到 db/seed.test.sql
 * 包含收入、支出、跨账本转账以及少量测试审计日志/API 请求日志。
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../db/seed.test.sql');

// Mulberry32 确定性 PRNG
function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(2025102026);
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const round2 = (n) => Math.round(n * 100) / 100;
const randAmount = (min, max) => round2(min + rng() * (max - min));
const sqlStr = (s) => `'${String(s ?? '').replace(/'/g, "''")}'`;

const MONTHS = [
  { ym: '2025-10', maxDay: 31, count: 29 },
  { ym: '2025-11', maxDay: 30, count: 31 },
  { ym: '2025-12', maxDay: 31, count: 30 },
  { ym: '2026-01', maxDay: 31, count: 32 },
  { ym: '2026-02', maxDay: 28, count: 28 },
  { ym: '2026-03', maxDay: 31, count: 30 },
  { ym: '2026-04', maxDay: 30, count: 29 },
  { ym: '2026-05', maxDay: 31, count: 31 },
  { ym: '2026-06', maxDay: 30, count: 30 },
  { ym: '2026-07', maxDay: 31, count: 31 },
  { ym: '2026-08', maxDay: 31, count: 29 },
  { ym: '2026-09', maxDay: 30, count: 30 },
  { ym: '2026-10', maxDay: 31, count: 31 },
  { ym: '2026-11', maxDay: 24, count: 29 },
];

const EXPENSE_TEMPLATES = [
  { category: '餐饮', subcategory: '早餐', titles: ['豆浆油条', '包子铺', '瑞幸早餐', '便利店三明治', '肠粉'], min: 8, max: 28, ledgers: ['Default', '共同账户'] },
  { category: '餐饮', subcategory: '午餐', titles: ['工作餐', '牛肉面', '隆江猪脚饭', '轻食沙拉', '烧腊双拼'], min: 22, max: 65, ledgers: ['Default'] },
  { category: '餐饮', subcategory: '晚餐', titles: ['家常炒菜', '火锅聚餐', '烤肉', '湘菜馆', '日料简餐'], min: 45, max: 280, ledgers: ['Default', '共同账户'] },
  { category: '餐饮', subcategory: '咖啡奶茶', titles: ['霸王茶姬', '喜茶', '美式咖啡', '生椰拿铁', '柠檬茶'], min: 13, max: 38, ledgers: ['Default'] },
  { category: '餐饮', subcategory: '外卖', titles: ['夜宵烧烤', '炸鸡外卖', '麻辣烫', '炒粉外卖'], min: 25, max: 88, ledgers: ['Default', '共同账户'] },
  { category: '交通', subcategory: '地铁', titles: ['地铁通勤', '羊城通充值', '地铁单程'], min: 4, max: 50, ledgers: ['Default'] },
  { category: '交通', subcategory: '打车', titles: ['滴滴打车', '机场快车', '加班打车'], min: 18, max: 96, ledgers: ['Default'] },
  { category: '交通', subcategory: '高铁', titles: ['周末高铁往返', '城际列车'], min: 65, max: 320, ledgers: ['Default', '共同账户'] },
  { category: '杂项', subcategory: '麻将', titles: ['周末麻将', '牌局结算', '血战到底', ''], min: 25, max: 260, ledgers: ['Default'] },
  { category: '杂项', subcategory: '日用', titles: ['山姆采购', '盒马买菜', '超市日用品', '纸巾洗衣液', '水果采买'], min: 38, max: 360, ledgers: ['Default', '共同账户'] },
  { category: '杂项', subcategory: '红包', titles: ['生日红包', '群红包', '节日红包'], min: 50, max: 300, ledgers: ['Default'] },
  { category: '杂项', subcategory: '数码', titles: ['数据线充电头', '云存储续费', '键帽配件', 'App 订阅'], min: 18, max: 420, ledgers: ['Default'] },
  { category: '购物', subcategory: '服饰', titles: ['优衣库基础款', '运动鞋', '换季外套', '家居服'], min: 79, max: 580, ledgers: ['Default'] },
  { category: '购物', subcategory: '家居', titles: ['香薰蜡烛', '厨房收纳盒', '床上四件套', '保温杯'], min: 45, max: 320, ledgers: ['共同账户', 'Default'] },
  { category: '账单', subcategory: '花呗', titles: ['花呗分期', '花呗日常消费', ''], min: 85, max: 620, ledgers: ['Default'] },
  { category: '账单', subcategory: '白条', titles: ['白条月供', '京东白条还款', ''], min: 16.67, max: 280, ledgers: ['Default'] },
];

const EXTRA_INCOME_TEMPLATES = [
  { category: '收入', subcategory: '理财', titles: ['货币基金收益', '定期存款利息', '债基分红', '余额宝收益'], min: 45, max: 420, ledger: '储蓄' },
  { category: '收入', subcategory: '理财', titles: ['宽基定投止盈', '红利ETF分红', '固收+赎回收益'], min: 120, max: 880, ledger: '基金理财' },
  { category: '收入', subcategory: '报销', titles: ['差旅费报销', '加班餐补报销', '体检报销'], min: 180, max: 1250, ledger: 'Default' },
  { category: '杂项', subcategory: '麻将', titles: ['周末麻将赢钱', '雀神小胜', '牌局收米', ''], min: 40, max: 360, ledger: 'Default' },
  { category: '收入', subcategory: '兼职', titles: ['技术咨询费', '闲鱼回血', '二手数码出清'], min: 150, max: 1600, ledger: 'Default' },
];

const TRANSFER_ROUTES = [
  { from: 'Default', to: '储蓄', subcategory: '储蓄划转', titles: ['月度强制储蓄', '备用金定存', '应急基金转入'], min: 1500, max: 4500 },
  { from: 'Default', to: '基金理财', subcategory: '理财定投', titles: ['指数基金定投', '月度理财划转', '纳指/红利加仓'], min: 800, max: 3000 },
  { from: 'Default', to: '共同账户', subcategory: '共同基金', titles: ['共同生活费充值', '家庭公共基金', '房租水电预存'], min: 2000, max: 4000 },
  { from: '储蓄', to: 'Default', subcategory: '资金周转', titles: ['大额消费周转', '信用卡还款调拨', '短期备用金取回'], min: 500, max: 2200 },
  { from: '共同账户', to: 'Default', subcategory: '账户结算', titles: ['垫付采购结算', '旅行支出AA结算'], min: 300, max: 1200 },
  { from: '基金理财', to: '储蓄', subcategory: '止盈转存', titles: ['盈利落袋转存', '止盈转入定期'], min: 600, max: 2500 },
];

const MEMBERS = ['荔枝', '扶正', '荔枝,扶正'];

const rows = [];
let totalIncome = 0;
let totalExpense = 0;
let totalTransfer = 0;

for (const { ym, maxDay, count } of MONTHS) {
  const monthRows = [];
  const fmtDate = (day) => `${ym}-${String(Math.min(Math.max(1, day), maxDay)).padStart(2, '0')}`;

  // 1) 固定月度收入 (2条工资 + 2~3条浮动收入 => 每月约 4~5 条收入)
  monthRows.push({
    date: fmtDate(randInt(8, 11)),
    title: `${ym} 工资`,
    amount: randAmount(11800, 14600),
    member: '荔枝',
    category: '收入',
    subcategory: '工资',
    ledger: 'Default',
    tx_type: 'normal',
    to_ledger: '',
  });
  monthRows.push({
    date: fmtDate(randInt(10, 15)),
    title: `${ym} 工资`,
    amount: randAmount(12500, 15800),
    member: '扶正',
    category: '收入',
    subcategory: '工资',
    ledger: 'Default',
    tx_type: 'normal',
    to_ledger: '',
  });

  // 2026-01 / 2025-12 年终奖
  if (ym === '2026-01') {
    monthRows.push({
      date: fmtDate(18),
      title: '2025 年终奖',
      amount: randAmount(16000, 24000),
      member: '荔枝',
      category: '收入',
      subcategory: '奖金',
      ledger: 'Default',
      tx_type: 'normal',
      to_ledger: '',
    });
  }

  const extraIncomeCount = randInt(2, 3);
  for (let i = 0; i < extraIncomeCount; i++) {
    const tpl = pick(EXTRA_INCOME_TEMPLATES);
    monthRows.push({
      date: fmtDate(randInt(1, maxDay)),
      title: pick(tpl.titles),
      amount: randAmount(tpl.min, tpl.max),
      member: tpl.category === '杂项' ? '扶正' : pick(['荔枝', '扶正']),
      category: tpl.category,
      subcategory: tpl.subcategory,
      ledger: tpl.ledger,
      tx_type: 'normal',
      to_ledger: '',
    });
  }

  // 2) 固定月度转账 (4~5条，覆盖多条跨账本路线；转账不带人物 tag，二级分类必填)
  const transferCount = randInt(4, 5);
  for (let i = 0; i < transferCount; i++) {
    const route = i < 3 ? TRANSFER_ROUTES[i] : pick(TRANSFER_ROUTES.slice(2));
    monthRows.push({
      date: fmtDate(randInt(2, maxDay)),
      title: pick(route.titles),
      amount: Math.round(randAmount(route.min, route.max) / 50) * 50,
      member: '',
      category: '转账',
      subcategory: route.subcategory,
      ledger: route.from,
      tx_type: 'transfer',
      to_ledger: route.to,
    });
  }

  // 3) 固定大额月度支出 (房租、水电煤、招行账单)
  monthRows.push({
    date: fmtDate(randInt(1, 5)),
    title: `${ym} 房租`,
    amount: -3800,
    member: '荔枝,扶正',
    category: '住房',
    subcategory: '房租',
    ledger: '共同账户',
    tx_type: 'normal',
    to_ledger: '',
  });
  monthRows.push({
    date: fmtDate(randInt(5, 12)),
    title: '水电燃气物业费',
    amount: -randAmount(190, 420),
    member: '荔枝,扶正',
    category: '住房',
    subcategory: '水电煤',
    ledger: '共同账户',
    tx_type: 'normal',
    to_ledger: '',
  });
  monthRows.push({
    date: fmtDate(randInt(1, 3)),
    title: '招商银行信用卡账单',
    amount: -randAmount(1600, 4600),
    member: pick(['荔枝', '扶正']),
    category: '账单',
    subcategory: '招商银行',
    ledger: 'Default',
    tx_type: 'normal',
    to_ledger: '',
  });

  // 4) 补足当月剩余日常支出直至达到目标 count
  while (monthRows.length < count) {
    const tpl = pick(EXPENSE_TEMPLATES);
    const ledger = pick(tpl.ledgers);
    const member = ledger === '共同账户' ? '荔枝,扶正' : pick(MEMBERS.slice(0, 2));
    monthRows.push({
      date: fmtDate(randInt(1, maxDay)),
      title: pick(tpl.titles),
      amount: -randAmount(tpl.min, tpl.max),
      member,
      category: tpl.category,
      subcategory: tpl.subcategory,
      ledger,
      tx_type: 'normal',
      to_ledger: '',
    });
  }

  // 按日期倒序编号，生成稳定 ID
  monthRows.sort((a, b) => b.date.localeCompare(a.date));
  const ymCompact = ym.replace('-', '');
  monthRows.forEach((item, idx) => {
    const id = `tx_test_${ymCompact}_${String(idx + 1).padStart(2, '0')}`;
    if (!item.category || !item.category.trim()) {
      throw new Error(`Missing category on ${id}`);
    }
    if (!item.subcategory || !item.subcategory.trim()) {
      throw new Error(`Missing required subcategory on ${id}`);
    }
    if (item.tx_type === 'transfer') {
      if (item.member !== '') {
        throw new Error(`Transfer ${id} must not have a member tag`);
      }
      totalTransfer += 1;
    } else if (item.amount > 0) {
      totalIncome += 1;
    } else {
      totalExpense += 1;
    }
    rows.push({ id, ...item });
  });
}

const lines = [
  `-- Auto-generated by scripts/generate-test-seed.mjs`,
  `-- Period: 2025-10 ~ 2026-11 (14 months, ${rows.length} rows: income=${totalIncome}, expense=${totalExpense}, transfer=${totalTransfer})`,
  `DELETE FROM test_transactions WHERE id LIKE 'tx_test_%';`,
  '',
];

const BATCH_SIZE = 20;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  lines.push(
    'INSERT INTO test_transactions (id, title, date, amount, member, category, subcategory, ledger, tx_type, to_ledger) VALUES'
  );
  batch.forEach((r, idx) => {
    const suffix = idx === batch.length - 1 ? ';' : ',';
    lines.push(
      `(${sqlStr(r.id)}, ${sqlStr(r.title)}, ${sqlStr(r.date)}, ${r.amount.toFixed(2)}, ${sqlStr(r.member)}, ${sqlStr(r.category)}, ${sqlStr(r.subcategory)}, ${sqlStr(r.ledger)}, ${sqlStr(r.tx_type)}, ${sqlStr(r.to_ledger)})${suffix}`
    );
  });
  lines.push('');
}

// 附带测试审计日志与请求日志样例
lines.push(`DELETE FROM test_activity_logs WHERE id LIKE 'log_test_%';`);
lines.push(
  `INSERT INTO test_activity_logs (id, timestamp, source, action, details) VALUES`,
  `('log_test_01', '2026-11-24T10:15:00.000Z', 'web', 'create', '新增账目: [工作餐] ￥-36.00 (荔枝 | 餐饮/午餐) 日期:2026-11-24'),`,
  `('log_test_02', '2026-11-22T14:20:00.000Z', 'web', 'create', '新增转账 (Default→储蓄): [月度强制储蓄] ￥3000.00 (转账/储蓄划转) 日期:2026-11-22'),`,
  `('log_test_03', '2026-11-20T09:05:00.000Z', 'api', 'create', '新增账目: [霸王茶姬] ￥-22.00 (扶正 | 餐饮/咖啡奶茶) 日期:2026-11-20'),`,
  `('log_test_04', '2026-11-18T19:42:00.000Z', 'web', 'update', '更新账目 [tx_test_202611_05]: [水电燃气物业费] ￥-312.50 (荔枝,扶正 | 住房/水电煤) 日期:2026-11-18'),`,
  `('log_test_05', '2026-11-12T11:30:00.000Z', 'import', 'batch_save', '测试环境初始化导入 2025-10 至 2026-11 模拟账单共 ${rows.length} 条');`,
  ''
);

lines.push(`DELETE FROM test_api_request_logs WHERE id LIKE 'apilog_test_%';`);
lines.push(
  `INSERT INTO test_api_request_logs (id, timestamp, method, endpoint, status_code, success, ip_address, user_agent, token_used, payload_summary, execution_ms) VALUES`,
  `('apilog_test_01', '2026-11-24T10:15:00.000Z', 'POST', '/api/transactions', 200, 1, '127.0.0.1', 'Mozilla/5.0 (Test)', 'ses***', 'amt:-36, desc:"工作餐", tag:"荔枝", type:"餐饮/午餐", date:2026-11-24', 28),`,
  `('apilog_test_02', '2026-11-22T14:20:00.000Z', 'POST', '/api/transactions', 200, 1, '127.0.0.1', 'Mozilla/5.0 (Test)', 'ses***', 'amt:3000, desc:"月度强制储蓄", tag:"", type:"转账/储蓄划转", transfer:"Default→储蓄", date:2026-11-22', 35),`,
  `('apilog_test_03', '2026-11-20T09:05:00.000Z', 'GET', '/api/transactions/***?desc=霸王茶姬&amt=-22', 200, 1, '127.0.0.1', 'Shortcuts/1.0', 'tok***', 'amt:-22, desc:"霸王茶姬", tag:"扶正", type:"餐饮/咖啡奶茶", date:2026-11-20', 19);`,
  ''
);

writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(
  `Generated ${outPath}: ${rows.length} transactions (income=${totalIncome}, expense=${totalExpense}, transfer=${totalTransfer}) across ${MONTHS.length} months.`
);
