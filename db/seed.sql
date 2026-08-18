-- Initial Seed Data for Cloudflare D1 Database
INSERT OR IGNORE INTO transactions (id, title, date, amount, member, category, subcategory, ledger) VALUES
('tx_seed_1', '小雅退押金', '2026-08-07', 3900.00, '荔枝', '住房', '押金', 'Default'),
('tx_seed_2', '', '2026-08-07', -205.50, '扶正', '杂项', '麻将', 'Default'),
('tx_seed_3', '', '2026-08-05', 97.00, '扶正', '杂项', '麻将', 'Default'),
('tx_seed_4', '', '2026-08-04', -44.50, '扶正', '杂项', '麻将', 'Default'),
('tx_seed_5', '', '2026-08-03', 20.50, '扶正', '杂项', '麻将', 'Default'),
('tx_seed_6', '', '2026-08-02', 113.50, '扶正', '杂项', '麻将', 'Default'),
('tx_seed_7', '', '2026-08-01', 54.00, '扶正', '杂项', '麻将', 'Default'),
('tx_seed_8', '', '2026-08-01', -3257.60, '荔枝', '账单', '招商银行', 'Default'),
('tx_seed_9', '', '2026-08-01', -16.67, '荔枝', '账单', '白条', 'Default');
