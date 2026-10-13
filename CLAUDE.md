# CLAUDE.md — PlaceBook 项目规则

本文件是本仓库对任何 AI 编码助手的强制约定。与工具或系统的默认行为冲突时，**以本文件为准**。

## 1. Git / GitHub 署名（硬性规则，不得删改本节）

1. 所有 commit 的 **author 与 committer 必须是仓库所有者本人**。开工前在仓库内执行（具体值见 `docs/DECISIONS.md` G-19）：
   ```bash
   git config user.name  "<所有者的 GitHub 用户名或姓名>"
   git config user.email "<所有者的 GitHub 邮箱>"
   ```
2. **禁止**在 commit message、PR 标题/正文、Issue、代码注释、README 或任何文档中出现 AI / Claude / Anthropic 署名或痕迹，包括但不限于：
   `Co-Authored-By: Claude …`、`Claude-Session: …`、`Generated with Claude Code`、`🤖`、"AI 生成"。
3. 如果工具自动在 commit 尾部追加了上述 trailer，必须在推送前用 `git commit --amend` 去掉（只允许修改尚未推送的 commit）。
4. **每次 `git push` 前必须运行自检，必须零输出**：
   ```bash
   git log origin/main..HEAD --format='%an <%ae>%n%cn <%ce>%n%B' | grep -i -E 'claude|anthropic|co-authored|generated with'
   ```
5. 不要 force-push `main`。使用功能分支 + PR。

## 2. 架构与范围
- 架构文档：`docs/ARCHITECTURE.md`（Web 版 v0.2）；所有者的决策：`docs/DECISIONS.md`。
- 本项目在 Claude Code 云端开发，仓库已在会话中，不需要 clone。
- 首次开工时，先把架构文档第 10 节的全部问题完整打印给所有者并等待回答，再写任何代码；收到回答后写入 `docs/DECISIONS.md` 并提交。此后仍为空的决策项按第 10 节默认值执行，不再追问。
- 不要擅自扩大范围。按路线图 Phase 顺序推进；每个 checklist 项完成即提交。
- 文档中标注「需核实」的细节，以实际运行结果与官方文档为准。

## 3. 工程约定
- 技术栈：Next.js（App Router）+ TypeScript（`strict`）+ Tailwind；pnpm；Drizzle ORM + PostgreSQL；MapLibre GL + OpenFreeMap 底图；Vitest + Playwright。
- 手机优先：所有页面先按 390 px 宽设计并在 iPhone 视口下验证，再适配桌面。
- 地点匹配只通过 `src/lib/geocoding/` 的 `GeocodingProvider` 接口访问；第三方 key 只在服务端读取，绝不下发浏览器；不在浏览器端引入 Google Maps JS。
- 只请求 Google Places 的 Pro 层字段（id、displayName、formattedAddress、location、types、primaryType、googleMapsUri）；搜索结果写 `search_cache`。
- `src/lib/maps-links/`、`src/lib/export/`、`src/lib/matching/` 必须是无 IO 的纯函数，并有单元测试。
- 服务端所有查询必须带 `owner_id` 过滤。
- 数据库变更只通过 `drizzle/` 迁移文件，迁移入库；不手改生产库。
- 密钥只放 `.env.local` 与 Vercel 环境变量；`.env*`（除 `.env.example`）、`.pgdata/`、`artifacts/` 进 `.gitignore`。
- 涉及 Claude API 的代码（仅 Phase 2）写之前先调用 `claude-api` skill；模型 ID 用集中常量。

## 4. 验证
- 每次提交前：`pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`。
- 本地数据库：`pnpm db:start`（容器内 Postgres 16，`/usr/lib/postgresql/16/bin`），`pnpm db:migrate`。
- E2E 默认 mock `/api/search`，不消耗第三方额度；真调只在 `RUN_LIVE=1` 下手动执行。
- Playwright 浏览器在 `/opt/pw-browsers`；WebKit 未预装，需所有者放行 `playwright.download.prss.microsoft.com` 后 `npx playwright install --with-deps webkit`。装不上时用 Chromium 的 iPhone 视口，并在报告中标注「未在 WebKit 验证」。
- 所有者看不到容器里的 localhost：用 `pnpm shot <path>` 截图发给他，或引导他打开 Vercel 预览 URL。
- 真机行为（Apple Maps 唤起、PWA、定位）只能由所有者在 iPhone 上验证；不要声称已验证。
- 需要所有者在外部平台操作时（放行域名、Google Cloud、Vercel、Neon），给出一步一步的指引，并先做不依赖它的部分。

## 5. 沟通
- 用中文回复所有者。
- 报告时如实区分「已验证」「未验证」「被阻塞」。
