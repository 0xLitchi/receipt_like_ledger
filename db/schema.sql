-- Cloudflare D1 Database Schema for Receipt Like Ledger
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT '',
    date TEXT NOT NULL,         -- YYYY-MM-DD
    amount REAL NOT NULL,       -- 正数为收入 (+), 负数为支出 (-)
    member TEXT NOT NULL,       -- 关联成员: 荔枝, 扶正, 等
    category TEXT NOT NULL,     -- 主分类: 住房, 杂项, 账单, 等
    subcategory TEXT DEFAULT '',-- 子分类: 押金, 麻将, 招商银行, 白条, 等
    ledger TEXT DEFAULT 'Default', -- 账本
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_member ON transactions(member);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

-- 活动审计日志（API 运行时也会幂等建表，此处显式声明便于初始化）
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 管理员会话表（签发会话 token，替代明文密码传递）
CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 全局应用设置（key-value，如全局主题风格）
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
