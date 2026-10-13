# PlaceBook（暂定名）— 架构设计文档（Web 版）

> 版本 v0.2 · 2026-10-13 · 取代 v0.1（原生 iOS 方案已放弃，原因见 §2.6）
>
> 一句话：你在别处发现一个好吃、好玩、值得逛的地方，打开网页**手动输入**它，网页自动匹配到真实地点并显示在地图上，你**确认**后就存进按城市整理的收藏；到了当地一键跳到 Apple Maps / Google Maps 导航，或把整个集合导出到 Google My Maps。

---

## 0. 给执行者（Opus）的说明 — 先读这一节

### 0.1 开工顺序（固定，不要跳步）
1. **① 环境**：本项目在 **Claude Code 云端** 开发，仓库已经在会话里，**不需要 clone**。先完整阅读 `CLAUDE.md`、本文档、`docs/DECISIONS.md`。此时不要写任何代码。
2. **② 先问再做**：把 **第 10 节的全部问题**（编号、问题、选项、默认值）完整打印在聊天里给 Marc，**然后停下来等他回答**。G-19（commit 姓名和邮箱）是必填项，拿不到就不能提交。收到回答后：把答案写进 `docs/DECISIONS.md`；按 0.2 节设置 git 身份；提交这一次改动。Marc 留空的项从此按默认值执行，不再追问。
3. **③ 环境自检**：按 0.3 节检查 WebKit、本地 Postgres、网络放行；缺什么用一句话告诉 Marc 要放行哪个域名，然后先做不依赖它的部分。
4. **④ 按路线图开工**：按 **第 9 节** 的 Phase 顺序推进。每完成一个 checklist 项：`pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` 通过后提交一次，并用 Playwright 截图把页面效果发给 Marc。
5. 文档标注 **「需核实」** 的细节，以实际运行结果和官方文档为准。涉及 Claude API 的代码（仅 Phase 2）先调用 `claude-api` skill 再写。

### 0.2 Git / GitHub 硬性规则（最高优先级）
- 所有 commit 的 author 和 committer 必须是 Marc 本人（姓名和邮箱见第 10 节 G-19）：
  ```bash
  git config user.name  "<Marc 的 GitHub 用户名或姓名>"
  git config user.email "<Marc 的 GitHub 邮箱>"
  ```
- 禁止在 commit message、PR、Issue、代码注释、README、任何文档中出现 AI / Claude / Anthropic 署名或痕迹（`Co-Authored-By: Claude …`、`Generated with Claude Code`、`Claude-Session: …`、🤖 等）。工具自动追加的 trailer 必须在推送前 `git commit --amend` 去掉（只改尚未推送的 commit）。
- 每次推送前自检，必须零输出：
  ```bash
  git log origin/main..HEAD --format='%an <%ae>%n%cn <%ce>%n%B' | grep -i -E 'claude|anthropic|co-authored|generated with'
  ```
- 不要 force-push `main`；功能分支 + PR。完整规则在仓库根目录 `CLAUDE.md`，不得删改其第 1 节。

### 0.3 云端环境事实（2026-10-13 实测）
| 项目 | 状态 | 处理 |
|------|------|------|
| Node 22 / pnpm 10 / npm 10 | 可用 | — |
| Playwright 1.56 + Chromium | 已预装在 `/opt/pw-browsers` | `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` |
| Playwright **WebKit** | **未预装**，下载被网络策略拦截（域名 `playwright.download.prss.microsoft.com`） | Marc 在云端环境设置里把该域名加入 Allowed domains 后，Opus 运行 `npx playwright install --with-deps webkit`（`--with-deps` 要装系统库，若 apt 也被拦再放行 `archive.ubuntu.com`、`security.ubuntu.com`）。装不上时 E2E 先用 Chromium 的 iPhone 视口跑，WebKit 作为可选 project，并如实标注「未在 WebKit 验证」 |
| Docker | 没有 daemon | 不用 Docker |
| PostgreSQL 16 服务端 | 二进制在 `/usr/lib/postgresql/16/bin`（`initdb`、`pg_ctl`、`postgres`） | `scripts/dev-db.sh` 在容器内起本地库供开发与 E2E |
| 外网 | npm registry 已放行；其他域名默认不通 | 真调 Google Places、连 Neon、Vercel CLI 前需 Marc 放行对应域名；放行前用 mock |
| Marc 能否看到 localhost | 不能 | 两种方式给 Marc 看效果：① Playwright 截图发给他；② Vercel 预览部署 URL，他用真 iPhone 打开 |

真机（Vercel 预览 URL + iPhone Safari）是唯一能验证这些行为的方式：`maps.apple.com` 链接是否唤起 Apple Maps、添加到主屏、定位权限弹窗、刘海安全区。Playwright WebKit 只能验证渲染与交互逻辑。

---

## 1. 产品定义

### 1.1 核心用户故事

| # | 故事 | 验收标准 | 阶段 |
|---|------|---------|------|
| US1 | **手动添加并匹配**：打开网页 → 「添加」→ 输入名称（可带城市、备注）→ 网页列出候选（名称、地址、分类、地图针）→ 选一个 → 确认 → 显示「已保存」 | 从打开到保存 ≤ 4 次点击；候选返回 ≤ 2 秒；手机 Safari 上单手可操作；连续添加多个地点不需要返回首页 | 1 |
| US2 | **浏览**：按城市 / 集合看列表和地图；按分类、状态（想去 / 去过）、标签筛选；详情页显示备注、理由、来源链接、地址 | 地图针按分类着色；去过的变灰 | 1 |
| US3 | **打开 / 导航**：详情页一键「在 Apple Maps 打开」「Apple Maps 导航」「Google Maps」 | 一次点击；可设默认导航 App | 1 |
| US4 | **导出**：集合 → KML / CSV / GPX 下载 → 导入 Google My Maps；文字清单分享 | 导出文件能被 My Maps 成功导入 | 1.5 |
| US5 | **手机体验**：可添加到主屏（PWA），离线能看已缓存列表 | iPhone Safari「添加到主屏幕」后全屏运行 | 1.5 |
| US6 | **附近**：到了当地打开 → 按距离排序 | 需要定位权限 | 1.5 |

### 1.2 非目标
- 接入 iOS 系统分享面板（iPhone 网页做不到，已放弃）。
- 自动从小红书 / Instagram 等抓取内容（Phase 2 只考虑「粘贴一段文字 → 抽取多个地点」）。
- 社交、评论、多人实时协作、按天排行程、原生 App。

---

## 2. 关键事实与硬约束

### 2.1 Apple Maps：没有写入 API（不变的事实）
- 没有任何公开 API 能把地点写进用户 Apple Maps 的「指南」或「已保存」。
- 网页能做的、且**不需要任何 Apple 账号**：
  - 「在 Apple Maps 打开」：`https://maps.apple.com/?q=<名称>&ll=<lat>,<lng>`。iPhone 上会直接唤起 Apple Maps 并定位到该地点，用户在地点卡片上**手动点「保存」**即可加入指南。这是把地点放进 Apple Maps 收藏的唯一合法路径，产品文案要如实说明。
  - 「Apple Maps 导航」：`https://maps.apple.com/?daddr=<名称, 地址>&dirflg=w|d|r`（步行 / 驾车 / 公交）。
- Apple 的 Place ID、MapKit JS、Maps Server API 都需要付费 Apple Developer Program（$99/年）。**Phase 1 不用**，靠「名称 + 坐标」就能让 Apple Maps 定位到正确的店（需真机核实几种店型）。将来若付费，加一个 `AppleMapsProvider` 即可。

### 2.2 Google Maps
- 同样没有写入「已保存列表」的 API。
- 深链免费、无需 key：查看 `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>&query_place_id=<id>`；导航 `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&destination_place_id=<id>&travelmode=walking|driving|transit`。装了 Google Maps App 会被唤起，没装开网页。
- 批量：导出 KML / CSV → 用户在 Google My Maps 网页导入（解压后 ≤ 5 MB、≤ 2000 行、首行标题）→ Google Maps App「你的地点 → 地图」显示为图层。

### 2.3 地点匹配的数据源（US1 的核心）

| 数据源 | POI 质量（网红餐厅、咖啡店、展览） | 费用 | 前置条件 | 结论 |
|--------|------|------|---------|------|
| **Google Places API (New)** Text Search | 最好，中英文都行 | Pro SKU 每月 5,000 次免费，之后约 $32 / 1,000 次 | Google Cloud 项目 + **绑定账单卡**（即使只用免费额度也必须绑） | **默认** |
| Apple Maps Server API | 好 | 每日免费额度大 | Apple Developer Program $99/年 | Phase 2 可选 |
| Nominatim / Photon（OpenStreetMap） | 弱：新店、小店常没有，中文名差 | 免费，无 key | 遵守 1 次/秒的礼貌限速 | **无 Google 账单时的后备** |
| Mapbox / HERE / Foursquare | 中等 | 有免费档 | 注册 + key | 备选，不默认 |
| 高德 / 百度 | 中国大陆唯一可用 | 免费档 | 国内实名注册 | 仅当集合里有中国大陆城市（见 C-7） |

注意：Google Maps 在**中国大陆**的 POI 数据很弱。如果你的收藏包含国内城市，需要 Phase 2 接高德或百度。

### 2.4 手机网页的限制
- iPhone 上的网页收不到系统分享面板的内容（Safari 不支持 Web Share Target），所以输入只能手动，这正是本版的前提。
- 定位需要 HTTPS 和用户授权；Vercel 默认 HTTPS。
- 网页可以用 `navigator.share` 把地点链接分享到 iMessage 等（iOS Safari 支持）。
- 添加到主屏后的 PWA 有独立的 cookie 存储：登录态要在主屏 App 里再登一次，正常现象。

### 2.5 Playwright WebKit ≠ iOS Safari
Playwright 的 WebKit 是桌面 WebKit 加 iPhone 视口与 UA 模拟，能验证布局、交互、JS 逻辑；**不能**验证 Apple Maps 唤起、添加到主屏、权限弹窗、安全区。那些必须用 Vercel 预览 URL 在真 iPhone 上看。

### 2.6 为什么放弃 v0.1 的原生 iOS 方案
Marc 决定：不走 Xcode、不付 Apple 开发者费、不经 App 审核，在云端开发、用 Playwright WebKit 模拟 iPhone；输入方式改为手动，因此原生分享扩展不再是必需。网页版的代价是没有系统分享接入、没有 Apple Place ID，收益是零安装、跨平台、随时可改。

---

## 3. 方案选型

### 3.1 技术栈

| 层 | 选择 | 理由 / 备注 |
|----|------|------------|
| 框架 | **Next.js（App Router，当前稳定版）+ TypeScript + React** | 前后端一体，Route Handlers 放服务端逻辑；Vercel 原生支持 |
| 样式 | Tailwind CSS | 手机优先，少写 CSS |
| 地图 | **MapLibre GL JS + OpenFreeMap 免费矢量底图**（样式 URL 形如 `https://tiles.openfreemap.org/styles/liberty`，需核实） | 无 key、无账单；不在浏览器里用 Google Maps JS，避免 key 外泄与计费 |
| 数据库 | **PostgreSQL**：生产用 Neon 免费档；开发 / E2E 用容器内本地 Postgres 16 | Drizzle ORM + `drizzle-kit` 迁移，迁移文件入库 |
| 地点匹配 | `GeocodingProvider` 抽象；默认 `GooglePlacesProvider`，后备 `NominatimProvider` | key 只在服务端；结果缓存到 `search_cache` 表 |
| 认证 | Phase 1：**单用户密码门**（`APP_PASSWORD` + 签名 cookie，`iron-session` 或 `jose`）；Phase 2：Auth.js + Google 登录 + 邮箱白名单 | Phase 1 零第三方配置，E2E 容易 |
| 托管 | **Vercel Hobby**（GitHub 连接后自动部署；每个 PR 有预览 URL） | 预览 URL 就是 Marc 的真机验证入口 |
| 测试 | Vitest（单元）；Playwright E2E：`iphone-webkit`（`devices['iPhone 15']`）+ `desktop-chromium` 两个 project | E2E 默认 mock `/api/search`，不消耗 Google 额度 |
| 工具 | pnpm、ESLint、Prettier、GitHub Actions | |

备选说明：Supabase（Postgres + Auth 一体）或 Firebase 也可行；本文选 Neon + Drizzle 是为了 SQL 可控、迁移入库、Phase 2 换认证不换数据层。

### 3.2 认证与多用户路径
- Phase 1：所有数据表带 `owner_id text not null default 'owner'`。密码门通过后 cookie 里只记 `owner`。
- Phase 2：接 Auth.js（Google 登录）+ `ALLOWED_EMAILS` 白名单，`owner_id` 改为用户邮箱或 uuid；数据迁移只需一条 `update ... set owner_id = …`。
- 任何时候服务端查询都必须带 `owner_id` 过滤，不靠前端。

### 3.3 `GeocodingProvider` 抽象
```ts
export interface GeocodingProvider {
  readonly id: 'google' | 'nominatim' | 'apple';
  search(q: SearchQuery): Promise<Candidate[]>;
}
export type SearchQuery = {
  text: string;                                   // 用户输入原文
  bias?: { lat: number; lng: number; radiusM: number }; // 集合城市中心
  language: 'zh-CN' | 'en';
  region?: string;                                // 'US' 等，可选
  limit: number;                                  // ≤ 5
};
export type Candidate = {
  provider: 'google' | 'nominatim' | 'apple';
  providerPlaceId: string;
  name: string;
  formattedAddress: string;
  lat: number; lng: number;
  primaryType?: string;        // 原始类型
  category: PlaceCategory;     // 映射后的本地分类
  mapsUri?: string;            // Google 自带链接
};
```
Google 调用形状（需核实字段掩码所属计费层级）：`POST https://places.googleapis.com/v1/places:searchText`，头 `X-Goog-Api-Key`、`X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.googleMapsUri`，体 `{ textQuery, languageCode, locationBias: { circle: { center: { latitude, longitude }, radius } }, pageSize: 5 }`。只请求 Pro 层字段，不要请求评分、营业时间（会升到 Enterprise 计费层）。

---

## 4. 系统架构图

```
 iPhone Safari / 桌面浏览器
 ┌──────────────────────────────────────────────┐
 │ Next.js 前端（PWA）                            │
 │  集合 · 列表 · 地图(MapLibre+OpenFreeMap) · 添加 │
 │  详情 · 导出 · 设置                             │
 │  外跳：maps.apple.com / google.com/maps 深链     │
 └───────────────┬──────────────────────────────┘
                 │ HTTPS（同源 /api/*）
 ┌───────────────▼──────────────────────────────┐
 │ Next.js 服务端（Vercel）                        │
 │  认证中间件（密码门 → Phase 2 Auth.js）          │
 │  /api/search ──▶ GeocodingProvider ──▶ Google Places API (New)
 │                      └─ search_cache 表（30 天） └─ Nominatim（后备）
 │  /api/collections · /api/places · /api/mentions ──▶ Drizzle ──▶ PostgreSQL (Neon)
 │  /api/export ──▶ KML / CSV / GPX 生成（纯函数）  │
 └──────────────────────────────────────────────┘
 开发 / E2E：容器内本地 Postgres 16 + Playwright（WebKit iPhone / Chromium）
 真机验证：Vercel 预览 URL + iPhone Safari
```

---

## 5. 领域模型（PostgreSQL / Drizzle）

```sql
-- 枚举
place_category: restaurant, cafe, bar, dessert, bakery, attraction, museum, park, viewpoint,
                shopping, market, neighborhood, hotel, activity, other
visit_status:   want_to_go, visited, skipped
source_kind:    xiaohongshu, instagram, tiktok, youtube, dianping, wechat, friend, web, other

collections (
  id uuid pk, owner_id text not null default 'owner',
  name text not null,                 -- "纽约 2026 春假"
  emoji text, color text,
  city_name text, center_lat double precision, center_lng double precision,
  bias_radius_m integer default 30000,
  sort_order int default 0, archived boolean default false,
  created_at timestamptz default now()
)

places (
  id uuid pk, owner_id text not null default 'owner',
  name text not null, name_alt text[] default '{}',
  lat double precision not null, lng double precision not null,
  formatted_address text, city text, country_code text,
  provider text,                      -- 'google' | 'nominatim' | 'manual'
  provider_place_id text,             -- Google place id 等
  matched boolean default true,       -- false = 用户手动放针
  category place_category default 'other',
  tags text[] default '{}',
  status visit_status default 'want_to_go',
  priority smallint default 1,        -- 0 随便 · 1 想去 · 2 必去
  note text,                          -- 个人备注
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (owner_id, provider, provider_place_id)  -- provider_place_id 为空时不参与（partial unique）
)

collection_places ( collection_id uuid, place_id uuid, added_at timestamptz, primary key (collection_id, place_id) )

mentions (                             -- 「为什么值得去」+ 来源，一个地点可多条
  id uuid pk, place_id uuid references places on delete cascade,
  why text, source_kind source_kind default 'other', source_url text, source_title text,
  created_at timestamptz default now()
)

search_cache ( key text pk, provider text, response jsonb, created_at timestamptz )  -- key = sha256(provider|normalized text|bias)
```

索引：`places(owner_id, status)`、`places(owner_id, category)`、`collection_places(place_id)`、`search_cache(created_at)` 用于清理。

---

## 6. 关键流程

### 6.1 US1 添加并匹配（核心流程）
```
「添加」页（/c/[collectionId]/add，输入框自动聚焦）
 1. 用户输入文本：如 "Katz's"、"纽约 Lilia 意面"、"205 E Houston St"；可选填：备注、理由、来源链接、标签、优先级
 2. 前端防抖 400 ms、≥ 2 个字符，或按回车 → POST /api/search { text, collectionId, language }
 3. 服务端：
    a. 归一化文本（去首尾空白、全角转半角、合并空格）
    b. 偏置：集合有城市中心 → 以其为圆心、bias_radius_m 为半径；否则用该用户最近一次保存的坐标；都没有则无偏置
    c. 查 search_cache；未命中 → GoogleProvider.search → 写缓存
    d. 排序：Provider 原序 × 名称相似度（中英文归一化后 token 相似）× 距离衰减
    e. 返回 ≤ 5 个候选 + 偏置信息
 4. 前端：候选卡片（名称、地址、分类标签、距城市中心距离）+ 小地图编号针；首个候选预选
 5. 用户点候选 → 「确认保存」→ POST /api/places { candidate, collectionId, note, why, sourceUrl, sourceKind, tags, priority }
 6. 服务端：按 (owner_id, provider, provider_place_id) 查重
    - 不存在 → 建 places + collection_places + mentions（若填了理由/来源）→ 201
    - 已存在 → 200 { existing: true, placeId } → 前端提示「已收藏过，已把新理由追加到它」（追加 mention，加入本集合）
 7. 前端 toast「已保存 ✓」，输入框清空并保持聚焦，方便连续添加；底部显示「刚添加的 N 个」
 没有合适候选 → 「都不是？手动放置」：地图上拖针或输入地址（Google Geocoding，Essentials 层）→ 保存时 matched=false、provider='manual'
```
失败处理：Google 429/5xx → 自动用 Nominatim 后备并在候选上标「后备数据源」；无网 → 提示稍后再试，不丢用户已填文字（本地暂存在 `sessionStorage`）。

### 6.2 US2 浏览
- `/`：集合卡片（城市、数量、封面 emoji）；`/c/[id]`：列表 / 地图切换；筛选分类、状态、标签；排序最近添加 / 优先级 / 距离（有定位时）。
- 地图：MapLibre，按分类着色的圆点针，去过的灰色，点针弹出卡片 → 进详情。≥ 100 个点时开聚合。

### 6.3 US3 打开 / 导航（`src/lib/maps-links/`，纯函数 + 单测）
| 动作 | 链接 |
|------|------|
| 在 Apple Maps 打开 | `https://maps.apple.com/?q=${enc(name)}&ll=${lat},${lng}` |
| Apple Maps 导航 | `https://maps.apple.com/?daddr=${enc(name + ', ' + formattedAddress)}&dirflg=w` （`d` 驾车、`r` 公交）；无地址时 `daddr=${lat},${lng}` |
| Google Maps 打开 | `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${googleId}`（无 id 省略该参数） |
| Google Maps 导航 | `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${googleId}&travelmode=walking` |
| 加入 Apple Maps 指南 | 同「在 Apple Maps 打开」，按钮下方一句说明：「打开后在地点卡片点『保存』」 |
| 分享 | `navigator.share({ title, text, url })`，不支持时复制链接 |

详情页主按钮按设置中的默认导航 App 显示，其余放次级菜单。Apple 的新式 `https://maps.apple.com/place?…` 与 `/directions?…` 链接（需核实）作为可选升级，先用上面的旧式参数，长期可用。

### 6.4 US4 导出（`src/lib/export/`，纯函数 + 单测）
- KML：`Document → Folder(集合) → Placemark{ name, description(理由 + 来源 + 备注), Point, ExtendedData{ category, status, priority } }`；导出前校验 My Maps 限制。
- CSV（My Maps 友好列）：`Name, Latitude, Longitude, Category, Status, Priority, Note, Why, Sources`。
- GPX：waypoints。
- 文字清单：每行 `名称 · 一句理由 · Apple Maps 链接`。
- 页面内给「导入 Google My Maps」三步说明。

### 6.5 US6 附近（Phase 1.5）
`navigator.geolocation.getCurrentPosition` → Haversine 距离 → 排序；半径筛选 1 / 3 / 10 km；地图定位到当前位置。

### 6.6 Phase 2：粘贴整段文字 → 抽取多个地点（可选）
服务端 Route Handler 调 Claude（模型 ID 集中常量，默认 `claude-opus-5-5`；结构化输出；按 `claude-api` skill 写），把一段小红书文案拆成 `[{ name, city, why, confidence }]`，每一条再走 6.1 的第 2–6 步。Phase 1 不做。

---

## 7. 仓库结构

```
/
├── CLAUDE.md                        # 项目规则（含 Git 署名硬规则）
├── README.md
├── docs/ARCHITECTURE.md  docs/DECISIONS.md
├── package.json  pnpm-lock.yaml  next.config.ts  tsconfig.json  tailwind.config.ts
├── .eslintrc / eslint.config.js  .prettierrc  .env.example  .gitignore
├── drizzle.config.ts
├── drizzle/                         # 迁移 SQL（入库）
├── playwright.config.ts             # projects: iphone-webkit, desktop-chromium
├── vitest.config.ts
├── scripts/
│   ├── dev-db.sh                    # 容器内启动/停止本地 Postgres 16（initdb → pg_ctl）
│   └── shot.ts                      # 用 iPhone 视口截图指定页面，给 Marc 看
├── public/                          # manifest.webmanifest、图标
├── src/
│   ├── app/
│   │   ├── (auth)/login/            # 密码门
│   │   ├── page.tsx                 # 集合列表
│   │   ├── c/[id]/page.tsx          # 列表 + 地图
│   │   ├── c/[id]/add/page.tsx      # 添加并匹配（US1）
│   │   ├── c/[id]/export/page.tsx
│   │   ├── p/[id]/page.tsx          # 地点详情
│   │   ├── nearby/page.tsx          # Phase 1.5
│   │   ├── settings/page.tsx
│   │   └── api/{search,places,collections,mentions,export}/route.ts
│   ├── components/                  # Map、CandidateList、PlaceCard、Filters、Toast …
│   ├── lib/
│   │   ├── geocoding/               # provider.ts、google.ts、nominatim.ts、cache.ts、rank.ts
│   │   ├── maps-links/              # apple.ts、google.ts（纯函数）
│   │   ├── export/                  # kml.ts、csv.ts、gpx.ts、text.ts
│   │   ├── matching/                # normalize.ts、similarity.ts、dedup.ts、category-map.ts
│   │   ├── db/                      # schema.ts、client.ts、queries/
│   │   ├── auth/                    # session.ts、middleware 辅助
│   │   └── i18n/                    # zh-CN / en 文案
│   └── middleware.ts                # 未登录 → /login
├── tests/
│   ├── unit/                        # vitest：maps-links、export、matching、geocoding(用 Google 响应 fixture)、db(本地 Postgres)
│   ├── e2e/                         # playwright：登录 → 建集合 → 添加(mock /api/search) → 确认 → 列表/地图 → 详情链接 href → 导出
│   └── fixtures/google/*.json       # 真实格式的 Google 响应样本（脱敏）
└── .github/workflows/ci.yml
```

依赖方向：`app → components → lib`；`lib/*` 之间只允许依赖 `lib/db` 与 `lib/matching`；`maps-links`、`export`、`matching` 必须是无 IO 的纯函数，单测覆盖。

---

## 8. 开发、测试与部署

### 8.1 命令（`package.json` scripts）
| 命令 | 作用 |
|------|------|
| `pnpm db:start` / `pnpm db:stop` | 容器内本地 Postgres（`scripts/dev-db.sh`），数据目录 `.pgdata/`（gitignore） |
| `pnpm db:migrate` | `drizzle-kit migrate` |
| `pnpm dev` | Next.js 开发服务器 |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` |
| `pnpm test` | Vitest 单元测试 |
| `pnpm e2e` | Playwright 两个 project；`pnpm e2e:webkit` 只跑 iPhone WebKit |
| `pnpm shot <path>` | 用 iPhone 15 视口截图页面到 `artifacts/`，发给 Marc |

### 8.2 测试策略
- **单元**：深链构造、KML/CSV/GPX、名称归一化与相似度、去重、分类映射、Google 响应解析（fixtures）。数据层测试连本地 Postgres。
- **E2E**：`page.route('**/api/search', …)` 返回 fixtures，不消耗 Google 额度、不需要 key；覆盖 US1–US3 全流程；断言详情页按钮 `href` 精确等于 6.3 的格式。
- **真调**：`RUN_LIVE=1 pnpm test:live` 才真的调 Google（需 key 与网络放行），手动触发。
- **真机**：每个 PR 的 Vercel 预览 URL，Marc 用 iPhone 验证 Apple Maps 唤起、PWA、定位。

### 8.3 CI（GitHub Actions，`ubuntu-latest`）
`pnpm install` → lint → typecheck → unit（`services: postgres:16`）→ `pnpm build` → `npx playwright install --with-deps webkit chromium` → e2e。CI 里 WebKit 可正常下载，不受云端会话的网络策略影响。

### 8.4 部署（Vercel）
1. Marc 在 Vercel 用 GitHub 登录，Import 本仓库（Hobby 免费）。
2. 环境变量：`DATABASE_URL`（Neon）、`GOOGLE_MAPS_API_KEY`（仅服务端）、`APP_PASSWORD`、`SESSION_SECRET`、`GEOCODING_PROVIDER=google|nominatim`。
3. `main` → 生产；PR → 预览 URL。
4. Neon：在 Vercel Marketplace 一键创建，或在 neon.tech 建项目后把连接串填进 `DATABASE_URL`；`pnpm db:migrate` 在部署前由 Opus 对生产库执行一次（需放行 Neon 域名），或在 Vercel build 命令里执行。

### 8.5 Marc 需要自己做的外部配置（Opus 做不了）
| 事项 | 步骤 | 何时 |
|------|------|------|
| 云端环境网络放行 | 云端环境设置 → Edit → Allowed domains 加：`playwright.download.prss.microsoft.com`（WebKit）、`places.googleapis.com`（真调）、你的 Neon 主机名（形如 `*.neon.tech`）、`archive.ubuntu.com` 与 `security.ubuntu.com`（WebKit 系统库，若需要） | Phase 0 |
| Google Cloud | 建项目 → 启用 **Places API (New)**（可选 Geocoding API）→ 绑定账单 → 建 API key，限制只能调这两个 API → 把 key 给 Opus 放进 Vercel 环境变量与本地 `.env.local`（不入库） | Phase 1 |
| Vercel + Neon | 见 8.4 | Phase 0 末 |
| GitHub 仓库改名 | Settings → General → Repository name | 开工前 |

---

## 9. 路线图与验收

### Phase 0 — 骨架
- [ ] Next.js + TS + Tailwind + ESLint/Prettier；`CLAUDE.md`、`README.md`、`.env.example`、`.gitignore`
- [ ] Drizzle schema（第 5 节）+ 首个迁移；`scripts/dev-db.sh` 在容器内起库并迁移成功
- [ ] 密码门登录 + 中间件
- [ ] `GeocodingProvider` 接口 + `GooglePlacesProvider`（用 fixtures 单测）+ `NominatimProvider`
- [ ] `maps-links`、`export` 纯函数 + 单测
- [ ] Playwright 配置（WebKit 装不上则先 Chromium）+ 一条登录 E2E；`pnpm shot` 可用
- [ ] CI 绿；Marc 完成 Vercel 连接，首个预览 URL 能打开登录页
- **DoD**：四条命令全绿；Marc 在 iPhone 上打开预览 URL 能登录。

### Phase 1 — MVP（US1 / US2 / US3）
- [ ] 集合：新建 / 编辑 / 归档，城市中心自动从城市名地理编码
- [ ] 添加并匹配全流程（6.1），含查重追加、手动放针、连续添加
- [ ] 列表 + 地图 + 筛选 + 排序
- [ ] 详情页：状态 / 优先级 / 备注 / 理由与来源 / 标签；Apple Maps 打开与导航、Google Maps；设置默认导航 App
- [ ] 中英文文案
- **DoD**：Marc 在 iPhone 上 60 秒内添加 5 家纽约餐厅且位置正确；详情页点「Apple Maps 导航」唤起 Apple Maps。

### Phase 1.5 — 补全（US4 / US5 / US6）
- [ ] KML / CSV / GPX / 文字清单导出 + My Maps 指引
- [ ] PWA：manifest、图标、Service Worker 缓存只读列表
- [ ] 附近
- [ ] 搜索缓存清理任务；输入历史

### Phase 2 — 需 Marc 再决策
- Auth.js + Google 登录 + 白名单，集合只读分享链接；粘贴整段文字 → LLM 抽取多地点；高德 / 百度 provider（国内城市）；Apple Maps Server API provider（若付费）；从 Google Takeout 导入已保存地点。

---

## 10. 待 Marc 决定的问题清单（每项都有默认值；不回答即按默认执行）

### A. 目标与范围
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| A-1 | 初期用户是谁？ | 决定要不要账号体系 | ① 只有我 ② 我 + 几个朋友 ③ 公开 | ①（密码门），朋友用时再上 Phase 2 登录 |
| A-2 | 什么时候想用上第一版？ | 决定 Phase 1 范围 | 自由回答 | 尽快出 Phase 1 |

### B. 外部服务（都要你自己注册，Opus 做不了）
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| B-3 | 愿意开 Google Cloud 并绑定账单卡以使用 Places API 吗？（个人用量在免费额度内，账单通常为 0） | 决定匹配质量 | ① 愿意 ② 不愿意，用免费 OpenStreetMap 数据（新店、小店常匹配不到） | ① |
| B-4 | 托管平台 | 部署与预览 URL | ① Vercel ② Cloudflare Pages ③ 其他 | ① |
| B-5 | 数据库 | 生产持久化 | ① Neon ② Supabase ③ 其他 | ① |
| B-6 | Phase 1 登录方式 | 零配置 vs 多人 | ① 单一密码 ② 直接 Google 登录 | ① |

### C. 添加与匹配体验
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| C-7 | 你的收藏主要在哪些国家 / 城市？是否包含中国大陆城市？ | Google 在中国大陆数据很弱，需另接高德/百度 | 自由回答 | 美国为主；不含中国大陆 |
| C-8 | 输入语言 | 影响搜索语言参数与候选显示 | 中文为主 / 英文为主 / 混合 | 混合，按浏览器语言 |
| C-9 | 没有合适候选时允许「手动放针」吗？ | 保证总能存下来 | 是 / 否 | 是 |
| C-10 | 同一地点重复添加时 | 查重策略 | ① 追加理由并提示 ② 直接拒绝 | ① |
| C-11 | 添加时除名称外还想顺手填什么？ | 表单字段 | 备注 / 理由 / 来源链接 / 标签 / 优先级（多选） | 全部可选，只有名称必填 |

### D. 地图跳转与导出
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| D-12 | 默认导航 App | 详情页主按钮 | Apple Maps / Google Maps | Apple Maps，设置里可改 |
| D-13 | 需要 Google Maps 按钮吗 | 免费，仅多一个按钮 | 要 / 不要 | 要 |
| D-14 | KML 导出到 Google My Maps 放哪个阶段 | 范围 | Phase 1 / 1.5 / 不要 | 1.5 |

### E. 手机体验与功能优先级
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| E-15 | PWA 添加到主屏 | 像 App 一样用 | Phase 1 / 1.5 / 不要 | 1.5 |
| E-16 | 附近功能 | 需要定位权限 | Phase 1 / 1.5 / 不要 | 1.5 |
| E-17 | Phase 2 的「粘贴整段文字自动抽取」要不要规划 | 需 Claude API 付费 | 要 / 先不要 | 先不要 |

### F. 外观与命名
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| F-18 | 界面语言；产品名称 | 文案与标题 | 中文 / 英文 / 双语；名称自由回答 | 中文为主、英文备用；名称 PlaceBook（占位） |

### G. Git / GitHub
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| G-19 | **commit 用的姓名与邮箱**（邮箱需绑定到 GitHub 账号，否则不关联头像） | 第 0.2 节硬规则需要具体值 | 自由回答 | **必填，无默认** |
| G-20 | 分支策略 | 协作与回滚 | ① 直推 main ② 功能分支 + PR 自己合 | ② |
| G-21 | 仓库公开 / 私有；许可证 | 开源与否 | 私有 / 公开 + MIT | 私有，不加 LICENSE |

---

## 11. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Google 账单意外 | 只请求 Pro 层字段；`search_cache` 30 天；在 Google Cloud 设每日配额上限（如 300 次/天）与预算告警；E2E 全 mock |
| 同名店多分店、中英文名不一致 | 城市偏置 + 候选排序 + 用户确认 + 「重新匹配」入口 |
| Apple Maps 链接定位到错误 POI | 用「名称 + 坐标」双条件；真机抽查餐厅 / 公园 / 商场三类；提供「Google Maps」作第二入口 |
| WebKit 在云端装不上 | E2E 先跑 Chromium iPhone 视口，CI 里 WebKit 正常；真机走 Vercel 预览 |
| 密码门被爆破 | 登录限速（每 IP 每分钟 5 次）、长随机密码、cookie `HttpOnly + Secure + SameSite=Lax` |
| 中国大陆城市匹配差 | C-7 决定是否 Phase 2 接高德 / 百度 |
| Neon 免费档自动休眠导致首次请求慢 | 可接受；或开启 Vercel cron 保活（可选） |

---

## 12. 附录

### A. 深链速查
见 6.3 表。实现为纯函数并单测，E2E 断言 `href`。

### B. Google Cloud 配置步骤（Marc 自己做）
1. console.cloud.google.com → 新建项目（如 `placebook`）。
2. 「API 和服务 → 库」启用 **Places API (New)**；可选启用 **Geocoding API**。
3. 「结算」绑定信用卡（免费额度内不扣费）。
4. 「凭据」→ 创建 API 密钥 → 「API 限制」只勾选上面两个 API；不要加 HTTP 引用来源限制（服务端调用）。
5. 「配额」把 Text Search 每日上限设为 300 左右；「预算和提醒」设 $1 告警。
6. 把 key 发给 Opus（只放 `.env.local` 和 Vercel 环境变量，不入库）。

### C. 给 Opus 的开场提示词（Marc 复制即用，在 Claude Code 云端新窗口里选本仓库后粘贴）
```
这个仓库是网页版「地点收藏夹」项目，目前只有文档。请严格按下面顺序做：

第一步：完整阅读 CLAUDE.md、docs/ARCHITECTURE.md、docs/DECISIONS.md。现在不要写任何代码。

第二步：把 docs/ARCHITECTURE.md 第 10 节的全部问题（编号、问题、选项、默认值）完整列出来给我，
一个都不要省，然后停下来等我回答。我回答后，把答案写进 docs/DECISIONS.md；
我留空的项按文档默认值执行，之后不要再追问。

第三步：按 CLAUDE.md 第 1 节设置 git 身份（用我在 G-19 给的姓名和邮箱），提交 DECISIONS.md。
所有 commit 只能是我的名字，绝不能出现 Claude / Anthropic / Co-Authored-By / Generated with
等任何字样，每次推送前按 CLAUDE.md 的自检命令检查。

第四步：按文档 0.3 节自检环境（WebKit、本地 Postgres、网络放行），缺什么一句话告诉我要放行哪个域名，
先做不依赖它的部分。然后从 Phase 0 开始按路线图推进：每完成一个 checklist 项就跑
lint / typecheck / test / e2e，通过后提交，并用 Playwright 的 iPhone 视口截图给我看页面。
需要我在 Google Cloud、Vercel、Neon 上操作的事，按文档 8.5 节给我一步一步的指引。
用中文和我沟通，如实区分已验证 / 未验证 / 被阻塞。现在开始第一步。
```

### D. 参考资料
- Apple 开发者论坛：Maps Guides 无公开 API — https://developer.apple.com/forums/thread/663915
- Apple 旧版 Map Links 参数（`q`、`ll`、`daddr`、`dirflg`）— https://developer.apple.com/library/iad/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
- Apple「Adopting unified Maps URLs」— https://developer.apple.com/documentation/mapkit/unified-map-urls
- Google Maps URLs（search / dir）— https://developers.google.com/maps/documentation/urls/get-started
- Google Places API (New) Text Search — https://developers.google.com/maps/documentation/places/web-service/text-search
- Google Maps Platform 定价与免费额度 — https://developers.google.com/maps/billing-and-pricing/pricing
- Google My Maps 导入限制 — https://support.google.com/mymaps/answer/3024836
- OpenFreeMap（免费底图）— https://openfreemap.org
- MapLibre GL JS — https://maplibre.org
- Playwright 设备模拟（WebKit / iPhone）— https://playwright.dev/docs/emulation
- Claude Code 云端环境网络设置 — https://code.claude.com/docs/en/cloud-environments#network-access
