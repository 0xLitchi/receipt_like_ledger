# 小票记账本 (Receipt Like Ledger)

个人/情侣自用的拟物化记账本：把月度账单渲染成热敏小票或针式打印机连续纸。后端使用 Cloudflare Pages Functions + D1 数据库。

## 技术栈

- 前端：React 19 + TypeScript + Vite 8 + Tailwind CSS 4
- 动画/图标：framer-motion、lucide-react
- 后端：Cloudflare Pages Functions（`functions/api/`）+ D1（`wrangler.toml`）
- 质量：oxlint、vitest、双份 tsconfig 类型检查（`src` 与 `functions`）

## 本地开发

```bash
npm install
npm run dev          # 启动 Vite 开发服务器
npm run lint         # oxlint
npm test             # vitest 单元测试
npm run build        # 前端构建 + functions 类型检查
```

后端 API 依赖 D1 与环境变量，可通过 `wrangler dev` 在本地联调：

```bash
wrangler dev --local
```

## 环境变量（Cloudflare 控制台或 `wrangler.toml` 的 `[vars]`）

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 是 | 管理员密码。登录成功后服务端签发 7 天有效的会话 token，密码本身不落前端存储 |
| `ACCESS_TOKEN` | 否 | 外部 API 的 `Authorization: Bearer <token>` 密钥。配置后，未登录 GET 返回脱敏数据（金额 0、标题 `***`） |
| `ALLOWED_ORIGINS` | 否 | 逗号分隔的跨域白名单（如 `https://my-site.pages.dev`）。不配置则拒绝一切跨域请求，同源访问不受影响 |
| `DEFAULT_LEDGER_TITLE` | 否 | 账本显示名（见 `wrangler.toml`） |

> 安全说明：请务必在 Cloudflare 控制台为 Worker/Pages 配置 `ADMIN_PASSWORD` 与 `ALLOWED_ORIGINS`，不要提交到仓库。

## 数据库初始化

首次部署需创建 D1 数据库并执行建表/种子数据：

```bash
npx wrangler d1 create receipt_ledger_db
# 将返回的 database_id 填入 wrangler.toml
npx wrangler d1 execute receipt_ledger_db --remote --file=db/schema.sql
npx wrangler d1 execute receipt_ledger_db --remote --file=db/seed.sql
```

`db/schema.sql` 包含 `transactions`、`activity_logs`（审计日志）、`admin_sessions`（会话表）三张表。API 运行时也会幂等建表，作为未执行迁移时的兜底。

## 功能概览

- 2 种拟物 UI 主题（小票 / 连续纸），后台可切换
- 月份拟物滑块切换，切换时触发打印/出纸动画
- 按 `.` 键快速呼出后台；后台支持增删改查、原始文本批量导入、CSV 导出、审计日志
- 未登录访问时金额/标题脱敏；管理员登录后显示明文
- 外部调用方可通过 `Authorization: Bearer ACCESS_TOKEN` 追加账目（来源记为 `api`）

## API 摘要

所有写接口需携带管理员凭证（推荐 `X-Admin-Token` 会话头；旧调用方仍支持 `X-Admin-Password` 或 `admin_password` query）。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/transactions` | 读取全部交易；未授权时脱敏 |
| POST | `/api/transactions` | 追加一条或多条交易（支持简写 `desc/amt/tag` 与 `type "分类/子分类"`） |
| PUT | `/api/transactions/:id` | 更新单条 |
| DELETE | `/api/transactions/:id` | 删除单条 |
| GET | `/api/logs` | 读取最近 200 条审计日志（需管理员） |
| POST | `/api/auth/verify` | 密码换会话 token：`{ "password": "..." }` → `{ "success": true, "token": "sess_..." }` |
| POST | `/api/auth/logout` | 注销会话（需 `X-Admin-Token`） |

## 测试与验证

- 单元测试：`npm test`（`src/utils/formatters.test.ts`、`src/utils/parser.test.ts`）
- 手动冒烟清单：
  1. 未登录 GET `/api/transactions`：金额为 0、标题为 `***`、`hasFullAccess: false`
  2. `POST /api/auth/verify` 换 token 后带 `X-Admin-Token` 请求：返回明文
  3. 无凭证 POST/PUT/DELETE：返回 401
  4. 管理员操作后 `GET /api/logs` 出现对应 `create/update/delete` 记录
