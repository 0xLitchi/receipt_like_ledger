-- Cloudflare D1 Test Tables Schema (isolated inside receipt_ledger_db via test_ prefix)
CREATE TABLE IF NOT EXISTS test_transactions (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT '',
    date TEXT NOT NULL,            -- YYYY-MM-DD
    amount REAL NOT NULL,          -- 正数为收入 (+), 负数为支出 (-), 转账时为正数转账金额
    member TEXT NOT NULL,          -- 关联成员: 荔枝, 扶正, 等
    category TEXT NOT NULL,        -- 主分类: 住房, 杂项, 账单, 转账, 等
    subcategory TEXT DEFAULT '',   -- 子分类: 押金, 麻将, 招商银行, 白条, 等
    ledger TEXT DEFAULT 'Default', -- 账本（转账时为转出账本 A）
    tx_type TEXT DEFAULT 'normal', -- 交易类型: normal (按金额正负区分收支) | transfer (账本间转账)
    to_ledger TEXT DEFAULT '',     -- 转入账本 B（仅转账类型使用）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_test_transactions_date ON test_transactions(date);
CREATE INDEX IF NOT EXISTS idx_test_transactions_member ON test_transactions(member);
CREATE INDEX IF NOT EXISTS idx_test_transactions_category ON test_transactions(category);

CREATE TABLE IF NOT EXISTS test_activity_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_api_request_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    method TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    success INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    token_used TEXT,
    payload_summary TEXT,
    execution_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_admin_sessions (
    token TEXT PRIMARY KEY,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
