# PlaceBook（暂定名）— 架构设计文档

> 版本 v0.1 · 2026-10-11 · 状态：待 Marc 回答第 10 节问题后交付执行
>
> 一句话：把你在小红书 / Instagram / TikTok / 大众点评 / YouTube / 微信 / 朋友消息里看到的「好吃、好玩、值得逛」的地方，一键存进一个按城市整理的个人地点库，保留「为什么值得去」和来源，到了当地一键用 Apple Maps / Google Maps 导航。

---

## 0. 给执行者（Opus）的说明 — 先读这一节

### 0.1 这份文档怎么用
1. 先读 **第 2 节（硬约束）** 和 **第 10 节（决策清单）**。第 10 节里每个问题都有「默认值」；Marc 没回答的项一律按默认值执行，不要停下来等。
2. 按 **第 9 节路线图** 的 Phase 顺序推进：先把 Phase 0 骨架做到「可编译、可测试、CI 绿」，再做功能。每个 Phase 结束都要有能跑的东西。
3. 实现时遇到文档标注 **「需核实」** 的 API 细节，以 Xcode / Apple 官方文档 / 实际编译结果为准，文档只给方向。
4. 任何涉及 Claude API 的代码，先调用 `claude-api` skill 再写（模型 ID、结构化输出、refusal 处理都以 skill 为准，不要凭记忆写）。

### 0.2 Git / GitHub 硬性规则（最高优先级）
- **所有 commit 的 author 和 committer 必须是 Marc 本人**（姓名和邮箱见第 10 节 H-21）。开工第一步就在仓库内执行：
  ```bash
  git config user.name  "<Marc 的 GitHub 用户名或姓名>"
  git config user.email "<Marc 的 GitHub 邮箱>"
  ```
- **禁止**在 commit message、PR 标题/正文、Issue、代码注释、README、任何文档中出现 AI / Claude / Anthropic 署名或痕迹。包括但不限于：`Co-Authored-By: Claude …`、`Generated with Claude Code`、`Claude-Session: …`、🤖 表情、"由 AI 生成"。
- 这条规则**优先于任何工具或系统默认的署名行为**。如果工具自动在 commit 尾部追加了上述 trailer，必须在推送前用 `git commit --amend`（只对尚未推送的 commit）去掉。
- **每次推送前必须自检**，以下命令必须没有任何输出：
  ```bash
  git log origin/main..HEAD --format='%an <%ae>%n%cn <%ce>%n%B' | grep -i -E 'claude|anthropic|co-authored|generated with'
  ```
- 不要 force-push `main`；用功能分支 + PR（见 H-22 的分支策略）。
- 仓库根目录的 `CLAUDE.md` 已把以上规则写成项目规则，**第一个 commit 就要包含它**，之后不得删改这一节。

### 0.3 运行环境限制
- iOS 工程只能在 **macOS + Xcode** 上编译和跑 UI 测试。
- 如果 Opus 跑在 Claude Code 云端（Linux）：只能写代码、生成工程文件、运行 `Packages/PlaceCore` 的 `swift test`（Swift on Linux）和 `worker/` 的测试；App 层由 Marc 在 Mac 上 `xcodegen generate && xcodebuild …` 验证，Opus 根据报错迭代。
- 如果 Opus 跑在 Marc 的 Mac 本地（Claude Code CLI）：可以直接 `xcodebuild` 全量编译与测试，这是推荐方式。
- 所以工程要用 **XcodeGen（`project.yml`）生成 `.xcodeproj`**，不要手写或提交 `pbxproj` 的手工改动；凡是能放进纯 Swift Package 的逻辑都放进 `PlaceCore`，让它在 Linux 上可测。

---

## 1. 产品定义

### 1.1 核心用户故事（MVP = Phase 1）

| # | 故事 | 验收标准 |
|---|------|---------|
| US1 | **分享即收藏**：在任意 App 里点「分享」→ 选 PlaceBook → 自动识别文中地点 → 我勾选确认 → 存入「纽约」集合，保留来源链接和推荐理由 | 从点分享到保存 ≤ 3 次点击；网络正常时识别 ≤ 15 秒；离线时先存草稿、回 App 后继续 |
| US2 | **截图收藏**：截图 → 分享到 PlaceBook → OCR → 识别地点 → 确认 | 中英文混排截图识别率可用；OCR 在端侧完成 |
| US3 | **浏览**：按城市 / 集合看列表和地图；按分类、状态（想去/去过）、标签筛选；每个地点显示「为什么值得去」（来源摘录）、来源列表、距离 | 地图 pin 按分类着色；详情页能点开来源原文 |
| US4 | **导航**：地点详情 → 「Apple Maps 导航」「Google Maps 导航」「在 Apple Maps 中打开」 | 一次点击跳转；可设默认导航 App |
| US5 | **附近**：到了当地打开 App → 看「附近已收藏」 | 按距离排序；地图定位到当前位置 |
| US6 | **导出**：集合 → 导出 KML / CSV → 导入 Google My Maps（在 Google Maps 里以图层显示） | 导出文件能被 My Maps 成功导入 |

### 1.2 非目标（v1 不做）
公开社交、评论、多人实时协作、按天排行程、Android、Web 编辑端。（部分进入 Phase 2，见第 9 节。）

---

## 2. 关键事实与硬约束（决定架构）

### 2.1 Apple Maps：没有写入 API，这是整个设计最重要的事实
- **做不到**：没有任何公开 API 能把地点写进用户 Apple Maps 的「指南 (Guides)」「地点库 (Library)」或「已保存」。Apple 支持文档只描述手动操作；Guides 是端到端加密的；开发者论坛自 iOS 14 起多次询问，无官方 API；WWDC24「Unlock the power of places in MapKit」只讲了引用地点和展示卡片，没有保存能力。
- **做得到**（全部进入设计）：
  1. **在 PlaceBook 自己的地图里**用 MapKit 显示所有收藏、标注、分类着色、你的备注 —— 「对这个地点有特殊说明」只能发生在这里。
  2. **一键在 Apple Maps 打开该地点**：`MKMapItem.openInMaps()`；打开后 Apple Maps 的地点卡片上有「保存」按钮，用户**手动点一下**即可加入指南。这是把地点进入 Apple Maps 收藏的唯一合法路径（两步：我们跳转 + 用户点保存）。
  3. **一键导航**：`openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: …])`，步行 / 驾车 / 公交。
  4. **Apple 原生地点卡片内嵌**（iOS 18+）：SwiftUI `.mapItemDetailSheet(item:)` 与 `.mapItemDetailSelectionAccessory()` 可以在我们 App 内直接展示 Apple 的地点卡片（营业时间、照片、评分、电话、路线按钮），**不花钱不要 key**。
  5. **稳定的 Place ID**（iOS 18+）：`MKMapItem.identifier`（`MKMapItem.Identifier`），Apple 承诺长期有效；可持久化，用 `MKMapItemRequest(mapItemIdentifier:)` 取回。注意：只能通过 `MKLocalSearch` 得到，Geocoder 不返回。
  6. **App Intents / Siri 快捷指令 / 小组件**：「导航去我收藏的 X」「附近已收藏」。
- **结论**：对用户要如实表述 —— 「PlaceBook 是你的地点笔记本；导航交给 Apple Maps / Google Maps；想让地点出现在 Apple Maps 指南里，点『在 Apple Maps 打开』再点『保存』」。

### 2.2 Google Maps：同样没有写入 API，但有半自动批量路径
- 没有写入「已保存列表」的 API。
- **深链**（无需 key、无需 Google 账号）：
  - 查看：`https://www.google.com/maps/search/?api=1&query=<名称或 lat,lng>&query_place_id=<place_id 可选>`
  - 导航：`https://www.google.com/maps/dir/?api=1&destination=<lat,lng 或名称>&destination_place_id=<可选>&travelmode=walking|driving|transit`
  - iOS 若装了 Google Maps 会被 universal link 接管；没装则开网页。可选 `comgooglemaps://` scheme（需 `LSApplicationQueriesSchemes` 声明）。
- **批量**：PlaceBook 导出 **KML/CSV** → 用户在 Google My Maps 网页导入（限制：解压后 ≤ 5 MB、≤ 2000 行，首行为标题）→ Google Maps App「你的地点 → 地图」显示为图层。
- **Google Places API (New)**：Text Search 属 Pro SKU，约 5,000 次/月免费，之后约 $32 / 1000 次；要营业时间/评分会升到 Enterprise SKU。需要 Google Cloud 账号和账单。**Phase 1 不用**，Phase 2 作为「富化」可选项。

### 2.3 输入来源的现实
| 来源 | 分享链接能抓到什么（服务端抓取） | 结论 |
|------|------|------|
| 小红书 `xhslink.com` 短链 | 跳转后网页通常有标题 + 正文前段（og 标签 / `__INITIAL_STATE__`），但不稳定，常变 | 尽力抓，失败就让用户截图 |
| Instagram 帖子 / Reel | 大多数情况要登录墙 | 以截图为主 |
| TikTok | oEmbed 只有标题（caption） | 标题够用则用，否则截图 |
| YouTube | oEmbed 标题 + 页面可取描述 | 可用 |
| 微信公众号文章 | HTML 可抓 | 可用 |
| 大众点评 / 美团 | 反爬严重 | 截图 |
| Google Maps / Apple Maps 分享链接 | 链接本身含名称/坐标/Place ID | **纯规则解析，不走 LLM** |
| 朋友发的文字 | 直接文本 | 直接走抽取 |

**结论**：截图 + 文字粘贴是**必须**支持的兜底路径，链接抓取是加分项。另外 **iOS Safari 不支持 Web Share Target**，纯 Web / PWA 无法接收系统分享 → 必须有原生 Share Extension，这直接否决了 Web-first 方案。

### 2.4 LLM 抽取
- Claude 官方 SDK 没有 Swift 版；iOS 直连只能裸 HTTP，而且 API key 要放进 App 二进制（不能分发给别人）。→ 推荐经由一个极小的 **Cloudflare Worker**（TypeScript SDK）。
- 端侧替代：iOS 26+ **Foundation Models framework**（`@Generable` 引导生成，离线免费），但上下文约 4K token、仅支持 Apple Intelligence 机型，质量低于 Claude。作为可选 `Extractor` 实现。

---

## 3. 方案选型

### 3.1 平台

| 方案 | 优点 | 缺点 | 适合 |
|------|------|------|------|
| **A. iOS 原生**（SwiftUI + SwiftData + CloudKit + MapKit） | Share Extension、Place ID、Apple 地点卡片、App Intents、小组件全是一等公民；零服务器同步（iCloud）；隐私好；一个人能维护 | 仅 Apple 生态；以后要 Android/Web 得补后端重写同步层 | 自用 + 朋友（Apple 用户） |
| B. 跨平台（Expo/React Native 或 Flutter）+ Supabase | 一套代码 iOS + Android；Web 复用后端 | iOS 分享扩展 / 地点卡片 / Place ID 需 native module，体验和维护成本高；从第一天就要维护后端和账号体系 | 一开始就确定要 Android |
| C. Web / PWA | 零安装 | iOS 收不到系统分享（致命） | 只能当 Phase 2 的只读浏览/导出端 |

**推荐 A**。同时把三样东西做成平台无关、可搬走：① 领域模型（JSON schema 固定）；② 抽取服务（独立 TypeScript Worker，任何客户端都能调）；③ 导出格式（KML/CSV/GPX 在纯 Swift Package 里）。这样 Phase 2 若要 Android/Web，加后端同步 + 新客户端即可，核心不重写。

### 3.2 数据与同步
**SwiftData + CloudKit（用户自己的 iCloud 私有数据库）**。零服务器、免费、iPhone/iPad/Mac 多设备同步。

注意事项（Opus 必须遵守）：
- SwiftData + CloudKit **不支持 `@Attribute(.unique)`**，所有属性必须有默认值或为可选，所有关系必须是可选的。去重靠业务逻辑而非数据库约束。
- CloudKit 生产环境 schema 只能加不能删/改类型，字段命名一次想清楚；开发期用 Development 环境随意改。
- 需要付费 **Apple Developer Program（$99/年）**：CloudKit、App Group、TestFlight 都要它。
- 共享集合（Phase 2）：SwiftData 对 `CKShare` 支持弱，到时评估 Core Data + `NSPersistentCloudKitContainer` 共享库，或改走 Supabase。

### 3.3 抽取服务：`PlaceExtractor` 协议 + 三种实现
```swift
protocol PlaceExtractor {
    func extract(_ input: ExtractionInput) async throws -> ExtractionResult
}
```
1. `RuleBasedExtractor`：Google Maps / Apple Maps 分享链接 → 直接解析出名称/坐标/Place ID，零成本、零延迟。
2. `ClaudeExtractor`（默认）：经 Worker 调 Claude，结构化输出。
3. `OnDeviceExtractor`：Foundation Models（`#available(iOS 26)` 且 `SystemLanguageModel.default.availability == .available`），离线 / 用户关闭云端时使用。

选择策略：链接可规则解析 → 1；否则有网且云端开启 → 2；否则设备支持 → 3；否则存为「待识别」草稿。

### 3.4 后端：唯一的服务端组件是一个 Cloudflare Worker
`worker/`（TypeScript，Hono 路由，`@anthropic-ai/sdk`，zod，vitest，wrangler）

| 端点 | 作用 |
|------|------|
| `POST /v1/extract` | 输入文本（+ 可选截图 base64、城市提示）→ 结构化地点列表。内部调 Claude `messages.parse` + `zodOutputFormat` |
| `POST /v1/unfurl` | 输入 URL → 服务端抓取（统一 UA、跟随短链跳转、oEmbed）→ `{finalUrl, title, text, author, siteName, imageUrls, kind, blocked}` |
| `GET /healthz` | 健康检查 |

- **鉴权**：Phase 1 用一个共享 Bearer token（App 端存 Keychain，Worker 端 `wrangler secret`）。Phase 2 换 Sign in with Apple → JWT + App Attest。
- **限流**：按 token 60 次/分钟（KV 或 Durable Object）。
- **缓存**：KV 按 `sha256(url)` 缓存 unfurl 结果 7 天；按 `sha256(text)` 缓存 extract 结果 30 天。
- **费用**：Workers 免费档 10 万请求/天足够；Claude 费用见 6.6。
- **隐私**：默认只上传 OCR 后的文本，不上传截图原图（见 D-12）。Worker 不落库任何用户内容（只有哈希缓存）。

---

## 4. 系统架构图

```
┌───────────────────────────── iPhone ─────────────────────────────┐
│  小红书 / Instagram / TikTok / 相册(截图) / Safari / 微信 …          │
│                      │ 系统分享面板                                 │
│                      ▼                                            │
│  ┌──────────── Share Extension ────────────┐                      │
│  │ 1. 读取 URL / 文本 / 图片                 │                      │
│  │ 2. 立刻落盘 InboxItem（保证不丢）          │                      │
│  │ 3. 链接规则解析 ─或─ Vision OCR ─或─ unfurl │                      │
│  │ 4. 调抽取 → 地理编码 → 去重 → Review UI    │                      │
│  └──────────────────┬──────────────────────┘                      │
│                     ▼                                             │
│       App Group 共享容器（同一个 SwiftData store）                   │
│                     ▲                                             │
│  ┌────────── 主 App (SwiftUI) ─────────────┐                      │
│  │ 集合 · 列表 · 地图 · 详情 · 附近 · 导出 · 设置 │                      │
│  │ Services: Geocoding(MKLocalSearch)      │                      │
│  │   MapsLauncher · ExtractionClient · OCR  │                      │
│  │   Unfurl · Exporter(KML/CSV/GPX) · Dedup │                      │
│  │ App Intents(Siri/快捷指令) · Widgets      │                      │
│  └───────┬───────────────────────┬─────────┘                      │
│          │ 深链 / MKMapItem        │                                │
│          ▼                       │                                │
│   Apple Maps / Google Maps        │                                │
└──────────────────────────────────┼────────────────────────────────┘
          │ CloudKit 私有库同步       │ HTTPS + Bearer
          ▼                        ▼
   用户自己的 iCloud         Cloudflare Worker (TypeScript)
                              ├─ POST /v1/extract ──▶ Claude API（结构化输出）
                              ├─ POST /v1/unfurl  ──▶ 目标网页 / oEmbed
                              └─ KV：缓存 + 限流
```

---

## 5. 领域模型

### 5.1 实体（SwiftData，`App/Persistence/Models/`）

```swift
@Model final class Place {
    var id: UUID = UUID()
    var name: String = ""
    var nameAlt: [String] = []            // 中英文别名，如 ["Katz's Delicatessen", "Katz's 熟食店"]
    var latitude: Double = 0
    var longitude: Double = 0
    var formattedAddress: String?
    var city: String = ""                 // 归属城市（用于分组与地理编码偏置）
    var region: String?                   // 州/省
    var countryCode: String?
    var applePlaceID: String?             // MKMapItem.Identifier.rawValue（主去重键）
    var googlePlaceID: String?            // Phase 2
    var categoryRaw: String = "other"     // PlaceCategory 枚举的 rawValue
    var tags: [String] = []
    var statusRaw: String = "wantToGo"    // VisitStatus：wantToGo / visited / skipped
    var priority: Int = 1                 // 0 随便 · 1 想去 · 2 必去
    var userNote: String?
    var createdAt: Date = Date()
    var updatedAt: Date = Date()
    var lastVerifiedAt: Date?             // 上次用 Place ID 刷新的时间
    var collections: [Collection]? = []   // 多对多（CloudKit 要求可选）
    @Relationship(deleteRule: .cascade, inverse: \Mention.place)
    var mentions: [Mention]? = []
}

@Model final class Mention {               // 「某个来源推荐了这个地点」= 特殊说明的载体
    var id: UUID = UUID()
    var quote: String?                     // 为什么值得去（抽取出来的理由，原文语言）
    var rawSnippet: String?                // 原文片段
    var confidence: Double = 0
    var createdAt: Date = Date()
    var source: Source?
    var place: Place?
}

@Model final class Source {
    var id: UUID = UUID()
    var kindRaw: String = "text"           // SourceKind
    var url: String?
    var title: String?
    var author: String?
    var siteName: String?
    var capturedAt: Date = Date()
    var rawText: String?                   // OCR 或抓取到的正文
    @Attribute(.externalStorage) var screenshot: Data?   // 可选保留截图
    var extractionStatusRaw: String = "pending"           // pending / done / failed
    @Relationship(deleteRule: .cascade, inverse: \Mention.source)
    var mentions: [Mention]? = []
}

@Model final class Collection {            // 一般 = 一个城市 / 一次旅行
    var id: UUID = UUID()
    var name: String = ""                  // "纽约 2026 春假"
    var emoji: String?
    var colorHex: String?
    var cityName: String?
    var centerLatitude: Double?
    var centerLongitude: Double?
    var sortOrder: Int = 0
    var isArchived: Bool = false
    var createdAt: Date = Date()
    var places: [Place]? = []
}

@Model final class InboxItem {             // Share Extension 落盘的待处理队列
    var id: UUID = UUID()
    var url: String?
    var text: String?
    var imageFileNames: [String] = []      // 存 App Group 容器文件
    var hintCity: String?
    var receivedAt: Date = Date()
    var statusRaw: String = "received"     // received / processing / needsReview / done / failed
    var errorMessage: String?
}
```

枚举（放在 `PlaceCore`，纯 Swift）：
- `PlaceCategory`: `restaurant, cafe, bar, dessert, bakery, attraction, museum, park, viewpoint, shopping, market, neighborhood, hotel, activity, other`
- `SourceKind`: `xiaohongshu, instagram, tiktok, youtube, dianping, wechat, googleMaps, appleMaps, web, screenshot, text, manual`
- `VisitStatus`: `wantToGo, visited, skipped`

### 5.2 抽取输出 JSON Schema（Worker 与 App 共用，固定不变的契约）
```json
{
  "detected_city": "New York",
  "source_title": "纽约必吃 10 家",
  "places": [
    {
      "name": "Katz's Delicatessen",
      "name_alt": ["Katz's 熟食店"],
      "category": "restaurant",
      "city": "New York",
      "address_hint": "205 E Houston St, Lower East Side",
      "why": "百年犹太熟食店，Pastrami 三明治是招牌",
      "confidence": 0.95
    }
  ]
}
```
规则：`category` 只能取 5.1 的枚举；`why` 用原文语言、≤ 60 字；`address_hint` 填街道 / 路口 / 街区 / 商场等有助于地理编码的线索；菜名、人名、品牌（无具体门店）不算地点；同一地点只出现一次。

---

## 6. 关键流程

### 6.1 US1 分享收藏（主流程）
```
用户在小红书点「分享」→ 选 PlaceBook
Share Extension：
 1. 从 NSItemProvider 读取：URL？文本？图片？（可同时多个）
 2. 立即写入 InboxItem(status=received)            ← 任何后续失败都不丢数据
 3. 若 URL 命中 RuleBasedExtractor（Google/Apple Maps 链接）→ 直接得到候选，跳到 6
 4. 若图片 → Vision OCR → text
    若社媒 URL → POST /v1/unfurl → text；抓取失败/被墙 → 提示「请截图或粘贴文字」
 5. POST /v1/extract(text, hintCity=当前集合城市) → 候选地点 []
 6. 每个候选 → MKLocalSearch（城市偏置）→ 坐标 / Place ID / 地址 → 与已有 Place 去重
 7. Review UI：候选列表（名称 · 分类 · 理由 · 匹配到的地址 · 置信度）+ 小地图；
    选集合（默认上次用的；检测到新城市则建议新建）；勾选；可改名重搜；可手动改匹配
 8. 保存：新建 Place，或把 Mention 合并进已有 Place；InboxItem.status=done
超时（≥ 20 秒）或离线：InboxItem.status=needsReview，提示「已保存，稍后在 App 内识别」；
主 App 进前台时扫描 Inbox 继续处理。
```

Share Extension 工程要点：
- `NSExtensionActivationRule`：支持 URL（≤1）、文本、图片（≤5）。
- 扩展内存上限约 120 MB、不能长时间后台：图片先缩放到长边 ≤ 1600 px 再 OCR；网络请求总超时 20 秒。
- 扩展与主 App 共用 **App Group 容器**里的同一个 SwiftData store（`ModelConfiguration(groupContainer:)`）。
- 扩展无法可靠地打开主 App，保存后只显示结果，不要尝试跳转。

### 6.2 US2 截图
与 6.1 相同，第 4 步用 Vision：`VNRecognizeTextRequest`，`recognitionLevel = .accurate`，`recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US", "ja-JP"]`，`usesLanguageCorrection = true`。全部端侧完成。OCR 文本 < 40 个字符时，询问用户是否把截图原图发给云端识别（见 D-12）。

### 6.3 地理编码与去重（`App/Services/Geocoding`）
```swift
let request = MKLocalSearch.Request()
request.naturalLanguageQuery = "\(place.name) \(place.addressHint ?? place.city)"
request.region = cityRegion                 // 集合城市的包围盒
request.regionPriority = .required          // iOS 18+
request.resultTypes = [.pointOfInterest, .address]
```
- 候选打分 = 名称相似度（中英文归一化、去标点、token 集合相似）× 与城市中心距离衰减 × 分类匹配。
- 最高分 ≥ 0.85 且领先第二名 ≥ 0.15 → 自动接受；否则 Review UI 让用户在前 3 个里选。
- 保存 `MKMapItem.identifier?.rawValue` 到 `applePlaceID`，以及坐标、地址、电话、网址、`pointOfInterestCategory`、时区。
- **去重**：`applePlaceID` 相同 → 同一地点；否则坐标距离 ≤ 50 m 且名称相似度 ≥ 0.8 → 视为同一地点。合并时只追加 Mention，这正是产品价值（「3 篇帖子都推荐了这里」）。
- 营业时间 / 照片 / 评分：**不自己存**，用 Apple 地点卡片（`.mapItemDetailSheet`）展示，零成本。

> 需核实：WWDC25 引入了 `MKGeocodingRequest` / `MKReverseGeocodingRequest` 和 `MKMapItem(location:address:)`，并把 `CLGeocoder` / `MKPlacemark` 系初始化器标记弃用。最低 iOS 18 时旧 API 仍可用，以 Xcode 警告为准，用 `#available(iOS 26, *)` 分支。

### 6.4 US4 打开 / 导航（`App/Services/MapsLauncher`）
```swift
enum NavigationApp { case appleMaps, googleMaps }
enum TravelMode { case walking, driving, transit }

// Apple Maps（优先原生，不依赖 URL 格式）
let item: MKMapItem = try await resolveMapItem(place)   // 有 applePlaceID 用 MKMapItemRequest，否则用坐标构造
item.name = place.name
item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeWalking])
// 仅「打开查看」（之后用户可点 Apple Maps 里的「保存」加入指南）：
item.openInMaps()

// Google Maps（universal link，装了 App 就跳 App）
var c = URLComponents(string: "https://www.google.com/maps/dir/")!
c.queryItems = [
  .init(name: "api", value: "1"),
  .init(name: "destination", value: "\(lat),\(lng)"),
  .init(name: "travelmode", value: "walking"),
]
// 有 googlePlaceID 时追加 destination_place_id
```
Apple Maps URL 备用形式（分享到 iMessage 等场景）：旧式 `https://maps.apple.com/?q=<名称>&ll=<lat>,<lng>` 长期可用；新式 `https://maps.apple.com/place?place-id=<id>`（iOS 18.x+，文档「Adopting unified Maps URLs」，**需核实**参数名）。

### 6.5 US6 导出（`PlaceCore/Export`）
- **KML**：`Document → Folder(每个集合) → Placemark{name, description(理由 + 来源链接 + 备注), Point, ExtendedData{category, status}}`。导出前校验 My Maps 限制（≤ 5 MB、≤ 2000 行）。
- **CSV**（My Maps 友好列）：`Name, Latitude, Longitude, Category, Status, Note, Why, Sources`。
- **GPX**：waypoints，给其他地图 App。
- **文字清单**：每行 `名称 · 一句理由 · Apple Maps 链接`，方便发给朋友。
- App 内提供「导入到 Google My Maps 的三步说明」。

### 6.6 LLM 抽取细节（Worker）
- **模型**：默认 `claude-opus-5-5`（对中文社媒文本的歧义、谐音、缩写处理最稳）。可选 `claude-haiku-5-5`（约便宜 30 倍），见 D-10。模型 ID 用字符串常量集中管理，不要散落。
- **调用方式**（示意，实际以 `claude-api` skill 为准）：
  ```ts
  import Anthropic from "@anthropic-ai/sdk";
  import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

  const res = await client.messages.parse({
    model: MODEL_ID,
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [ /* 可选 image block */ { type: "text", text: userText } ] }],
    output_config: { format: zodOutputFormat(ExtractionSchema), effort: "medium" },
  });
  if (res.stop_reason === "refusal") { /* 返回空结果和友好提示 */ }
  const parsed = res.parsed_output; // null → 422
  ```
  按 skill 指引启用 server-side refusal fallback；不要用 `tool_choice: any/tool` 强制工具（Opus 5.5 已不支持）；不要写 `budget_tokens`。
- **提示词要点**（`worker/src/prompts/extract.md`）：只抽「可以导航前往的具体地点」；菜名/人名/无门店的品牌不算；同名连锁保留文中提到的具体分店线索；`why` 用原文语言、简短、来自原文；给出整体城市；输出严格遵守 schema。附 3–5 个 few-shot（小红书多店清单、Instagram 单店、含英文店名的中文帖、Google Maps 链接伴随文字、无地点的噪声文本）。
- **图片输入**：截图 base64（长边缩放到 ≤ 1568 px、JPEG 质量 0.8）作为 image block；仅在 OCR 文本过短或用户选择时上传。
- **成本估算**（每次收藏：输入 2–4K token，输出 0.5–1K token）：

  | 模型 | 单次 | 每月 150 次 |
  |------|------|-----------|
  | Opus 5.5（$4 / $20 每 M token） | ≈ $0.02–0.04 | ≈ $3–6 |
  | Haiku 5.5（$0.10 / $0.50 每 M token） | ≈ $0.001 | ≈ $0.15 |

- **回归评测集**：`worker/eval/cases/*.json`，30–50 条真实帖子文本（脱敏）→ 期望地点列表。vitest 默认 mock；设置 `RUN_LIVE_EVAL=1` 才真调 API。改提示词必须跑一遍。

---

## 7. 仓库结构与模块边界

```
/
├── CLAUDE.md                     # 项目规则（含 Git 署名硬规则），首个 commit 就要有
├── README.md
├── docs/
│   ├── ARCHITECTURE.md           # 本文档
│   └── DECISIONS.md              # Marc 的决策回答（第 10 节的填空版）
├── project.yml                   # XcodeGen 工程定义 → 生成 PlaceBook.xcodeproj（.xcodeproj 不入库）
├── .swiftlint.yml  .swiftformat
├── App/                          # iOS 主 App（SwiftUI，iOS 18+）
│   ├── App/                      # 入口、依赖注入、环境
│   ├── Features/
│   │   ├── Collections/          # 集合列表 / 新建 / 归档
│   │   ├── Places/               # 列表 + 筛选
│   │   ├── Map/                  # 地图（MapKit SwiftUI Map、分类着色、选择卡片）
│   │   ├── PlaceDetail/          # 详情：理由、来源、备注、状态、导航按钮、Apple 地点卡片
│   │   ├── Capture/              # Inbox 处理与 Review UI（与扩展共用视图）
│   │   ├── Nearby/
│   │   ├── Export/
│   │   └── Settings/
│   ├── Services/
│   │   ├── Geocoding/            # MKLocalSearch 封装、候选打分
│   │   ├── MapsLauncher/         # Apple/Google 跳转
│   │   ├── Extraction/           # PlaceExtractor 协议 + Rule/Claude/OnDevice 三实现
│   │   ├── OCR/                  # Vision
│   │   ├── Unfurl/               # 调 Worker
│   │   └── Dedup/
│   ├── Persistence/              # SwiftData 模型、ModelContainer(App Group + CloudKit)、迁移
│   └── Resources/                # Assets、Localizable.xcstrings（zh-Hans / en）
├── ShareExtension/               # 分享扩展（薄：读取 → 落盘 → 复用 Capture 视图）
├── Intents/                      # App Intents：导航到收藏、附近收藏、从文字保存
├── Widgets/                      # Phase 1.5
├── Packages/
│   └── PlaceCore/                # 纯 Swift Package，Linux 可 `swift test`
│       ├── Sources/PlaceCore/
│       │   ├── Models/           # 枚举、DTO、ExtractionResult（与 Worker schema 一致）
│       │   ├── LinkParsing/      # Google/Apple Maps 分享链接解析、短链识别、来源 kind 判定
│       │   ├── Matching/         # 名称归一化、相似度、候选打分、去重判定
│       │   ├── Export/           # KML / CSV / GPX 生成与限制校验
│       │   └── Text/             # OCR 文本清洗、长度/语言检测
│       └── Tests/PlaceCoreTests/
├── worker/                       # Cloudflare Worker（TypeScript）
│   ├── src/
│   │   ├── index.ts              # Hono 路由、鉴权、限流
│   │   ├── extract.ts            # Claude 调用 + zod schema
│   │   ├── unfurl/               # 通用抓取 + 各站点适配（xiaohongshu.ts, youtube.ts, tiktok.ts, wechat.ts…）
│   │   ├── prompts/extract.md
│   │   └── schema.ts             # 与 PlaceCore/Models 对应的 JSON schema（唯一事实来源之一）
│   ├── eval/                     # 回归评测集
│   ├── test/                     # vitest
│   └── wrangler.toml
└── .github/workflows/ci.yml      # ubuntu: swift test (PlaceCore) + pnpm test (worker)；macOS job 可选/手动
```

依赖方向：`App → PlaceCore`；`ShareExtension → PlaceCore + App 的 Capture 视图（通过共享 framework target 或直接编译同一批源文件）`；`worker` 独立。App 层不直接 import Anthropic SDK。

---

## 8. 技术栈与版本

| 层 | 选择 | 备注 |
|----|------|------|
| 最低系统 | iOS 18.0 | Place ID、`.mapItemDetailSheet`、`regionPriority` 都是 iOS 18 起；端侧模型用 `#available(iOS 26)` |
| 语言/UI | Swift 6（严格并发可先 minimal）、SwiftUI | |
| 数据 | SwiftData + CloudKit 私有库，App Group 共享容器 | 约束见 3.2 |
| 地图 | MapKit（SwiftUI `Map`、`MKLocalSearch`、`MKMapItemRequest`） | 不引入 Google Maps SDK |
| OCR | Vision | 端侧 |
| 端侧 LLM | Foundation Models（可选） | iOS 26+ |
| 工程 | XcodeGen、SwiftLint、SwiftFormat | |
| 后端 | Cloudflare Workers、Hono、`@anthropic-ai/sdk`、zod、vitest、wrangler、pnpm | |
| CI | GitHub Actions：ubuntu 跑 `swift test` + `pnpm test`；`macos-15` 跑 `xcodebuild` 作为手动/可选 job（macOS 分钟贵） | |

---

## 9. 分阶段路线图与验收

### Phase 0 — 骨架（目标：1 周内）
- [ ] `CLAUDE.md`、`README.md`、`docs/`、`.gitignore`（排除 `.xcodeproj`、`DerivedData`、`.wrangler`、`node_modules`）
- [ ] `project.yml` 能生成工程；App / ShareExtension / Intents 三个 target 空壳可编译
- [ ] `PlaceCore` 包：枚举、DTO、链接解析（Google/Apple Maps）、KML 导出，单测通过（Linux）
- [ ] SwiftData 模型 + App Group + CloudKit 容器配置；能在模拟器创建一条 Place
- [ ] Worker：`/healthz`、`/v1/extract`（mock 与真调两种测试）、`/v1/unfurl`（通用 og 抓取）
- [ ] CI 绿
- **DoD**：Marc 在 Mac 上 `xcodegen generate && xcodebuild build` 成功；`swift test`、`pnpm test` 通过。

### Phase 1 — MVP（US1 / US3 / US4 + 手动添加）
- [ ] Share Extension：接收 URL/文本 → 落盘 → 规则解析或 unfurl+extract → 地理编码 → Review UI → 保存
- [ ] 集合 / 列表 / 地图 / 详情（含 Apple 地点卡片、来源与理由、状态与优先级、备注）
- [ ] 导航与打开（Apple Maps 原生、Google Maps 深链、默认导航 App 设置）
- [ ] 手动添加地点（搜索 MKLocalSearch）与粘贴文字识别
- [ ] iCloud 同步可用；Inbox 失败重试
- **DoD**：从小红书分享一篇「纽约 10 家店」的帖子，≤ 3 次点击保存 ≥ 8 家且位置正确；详情页一键跳 Apple Maps 导航。

### Phase 1.5 — 补全（US2 / US5 / US6）
- [ ] 截图 OCR 路径；OCR 过短时的上传询问
- [ ] 附近（定位、距离、半径筛选）
- [ ] KML / CSV / GPX / 文字清单导出 + My Maps 导入指引
- [ ] App Intents：「导航去我收藏的 X」「附近有什么我收藏的」「把剪贴板文字存到 PlaceBook」
- [ ] 小组件：附近已收藏（锁屏 / 主屏）
- [ ] 端侧 `OnDeviceExtractor`（iOS 26+ 设备）
- [ ] TestFlight 内测给朋友

### Phase 2 — 多人与扩展（需 Marc 再决策）
- 共享集合（CloudKit Sharing 或 Supabase）、Web 只读页、Google Places 富化（营业时间/评分，需 Google Cloud 账单）、从 Google Takeout CSV 导入已保存地点、Android（若需要则按 3.1 方案 B 评估）。

---

## 10. 待 Marc 决定的问题清单（每项都有默认值；不回答即按默认执行）

回答方式：直接在聊天里按编号回答，或把答案填进 `docs/DECISIONS.md`。

### A. 目标与范围
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| A-1 | 初期用户是谁？ | 决定要不要后端账号体系、Android | ① 只有我 ② 我 + 朋友（都是 iPhone）③ 公开上架 ④ 需要 Android | ② |
| A-2 | 什么时候想用上第一版？ | 决定 Phase 1 范围 | 自由回答 | 尽快出 Phase 1，其他后置 |

### B. 平台与开发环境
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| B-3 | 你有 Mac + Xcode 吗？是否愿意付 Apple Developer Program（$99/年）？ | 没有 Mac 无法编译；没有付费账号就没有 CloudKit / App Group / TestFlight | 有/没有；愿意/不愿意 | 有 Mac，愿意付 |
| B-4 | Opus 跑在哪？ | 决定谁来编译验证 | ① Claude Code 云端（Linux，只能跑 PlaceCore/worker 测试）② 我 Mac 本地的 Claude Code（可全量编译） | ② 推荐；若 ① 则你负责在 Mac 上编译并把报错贴回 |
| B-5 | 最低 iOS 版本 | iOS 18 有 Place ID 和地点卡片；iOS 26 才有端侧模型和新 MapKit API | iOS 18 / iOS 26 | iOS 18，端侧功能 `#available(iOS 26)` |

### C. 输入来源
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| C-6 | 你最常从哪些 App 看到地点？按频率排序 | 决定 unfurl 适配器开发顺序 | 小红书 / Instagram / TikTok / YouTube / 大众点评 / 微信 / Google Maps 分享 / 朋友发的文字 / 其他 | 小红书 → Instagram → Google Maps 链接 → 微信 → YouTube |
| C-7 | 接受「截图 → OCR」作为主路径之一？ | 很多 App 链接抓不到内容，截图是兜底 | 是/否 | 是 |
| C-8 | 一篇帖子有多个地点时，默认全选还是让你逐个勾？ | Review UI 交互 | ① 全部预选 ② 只预选高置信度 ③ 全不选 | ② |

### D. LLM 与后端
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| D-9 | 接受使用 Claude API 付费（约每次收藏 $0.02–0.04）吗？是否已有 Anthropic API key？ | 没有则只能端侧模型（iOS 26 + 新机型）或纯规则 | 是/否；有/没有 | 是；没有则去 console.anthropic.com 创建 |
| D-10 | 抽取用哪个模型？ | 质量 vs 成本 | ① Opus 5.5（质量优先）② Haiku 5.5（约便宜 30 倍）③ 先 Opus，评测集跑通后再比较 | ① |
| D-11 | 接受注册 Cloudflare 账号并部署一个 Worker（免费档）作为唯一后端？ | 不想要后端就只能把 key 放进 App，仅限自用、不能给别人 | ① Worker ② 零后端（key 放 Keychain，自用） | ① |
| D-12 | 截图是否允许上传给云端模型？ | 隐私与成本 | ① 只传 OCR 文本 ② OCR 太短时询问 ③ 总是传原图 | ② |

### E. 地图
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| E-13 | Phase 1 只做 Apple Maps 原生 + Google Maps 深链（都不需要 key）；Google Places 富化（营业时间/评分，要 Google Cloud 账单）放 Phase 2，可以吗？ | 控制范围与成本 | 可以/不可以 | 可以 |
| E-14 | 「加入 Apple Maps 指南」只能做成「一键打开 → 你手动点保存」，接受吗？ | 没有 API，这是事实约束 | 接受（唯一选项）/ 有其他想法 | 接受 |
| E-15 | 需要 KML 导出 → Google My Maps 吗？ | 让地点以图层出现在 Google Maps 里 | Phase 1 / Phase 1.5 / 不需要 | Phase 1.5 |
| E-16 | 默认导航 App | 详情页主按钮 | Apple Maps / Google Maps / 每次问 | Apple Maps，设置里可改 |

### F. 数据与体验
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| F-17 | 需要 iCloud 多设备同步吗？ | 决定是否开 CloudKit | 是/否 | 是 |
| F-18 | 界面语言 | 本地化范围 | 中文 / 英文 / 跟随系统（中英双语） | 跟随系统，首发 zh-Hans + en |
| F-19 | App 名称与 Bundle ID（反向域名，如 `com.yourname.placebook`）；是否保留截图原图 | 工程配置；存储占用 | 自由回答 | 名称 PlaceBook（占位）；Bundle ID 用 `com.placeholder.placebook` 占位等你改；默认保留截图 |

### G. 功能优先级
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| G-20 | 下列功能哪些必须进 Phase 1（多选）：状态(想去/去过) · 优先级 · 个人备注 · 按集合分组 · 地图分类着色 · 附近 · 营业时间(用 Apple 卡片) · 照片 · 按天行程 · 好友共享 · Siri · 小组件 | 控制 MVP 范围 | 多选 | 前 7 项进 Phase 1；附近、Siri、小组件 Phase 1.5；行程、共享 Phase 2 |

### H. Git / GitHub
| # | 问题 | 为什么重要 | 选项 | 默认 |
|---|------|-----------|------|------|
| H-21 | commit 用的姓名与邮箱（需与 GitHub 账号匹配，否则头像不会关联） | 第 0.2 节硬规则需要具体值 | 自由回答 | 必填，无默认 |
| H-22 | 分支策略 | 协作与回滚 | ① 直推 main ② 功能分支 + PR 自己合 | ② |
| H-23 | 仓库公开/私有；许可证 | 开源与否 | 私有 / 公开 + MIT | 私有，不加 LICENSE |

---

## 11. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 小红书等站点抓取随时失效 | 适配器独立文件、有 mock 测试；失败时清晰引导用户截图；截图路径永远可用 |
| 同名店多分店、中英文名不一致导致地理编码错 | 城市偏置 + `address_hint` + 候选打分 + 低置信度交给用户选；保存后可「重新匹配」 |
| Share Extension 内存 / 时间限制导致崩溃 | 图片缩放、20 秒超时、先落盘再处理、失败回主 App 续做 |
| API key 泄露 | key 只在 Worker；App 端只有可轮换的 Bearer token |
| SwiftData + CloudKit 的限制（无 unique、关系必须可选、schema 只增不改） | 3.2 的约束写进 `CLAUDE.md`；开发期用 Development 环境 |
| Foundation Models 仅部分机型可用、上下文 4K | 仅作为可选实现；长文分块；不可用时静默回退云端或草稿 |
| Apple 审核 / 隐私标签 | 提供隐私政策页；App Privacy 填「用户内容（文本/截图）用于 App 功能，不用于追踪」 |
| Opus 跑在 Linux 无法编译 iOS | PlaceCore 承担尽量多逻辑并在 Linux 测；App 层由 Marc 编译回传报错 |

---

## 12. 附录

### A. 深链速查
| 目的 | Apple Maps | Google Maps |
|------|-----------|-------------|
| 查看地点 | `MKMapItem.openInMaps()`；URL `https://maps.apple.com/?q=<name>&ll=<lat>,<lng>`；新式 `https://maps.apple.com/place?place-id=<id>`（需核实） | `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>&query_place_id=<id>` |
| 导航 | `openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: Driving/Walking/Transit])`；URL `?daddr=<lat>,<lng>&dirflg=d/w/r` | `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving/walking/transit` |
| 解析分享链接 | `maps.apple.com/?…ll=…&q=…`、`maps.apple.com/place?place-id=…`、短链 `maps.apple/p/…`（跟随跳转） | `maps.app.goo.gl/…` → 跟随跳转 → `/maps/place/<name>/@<lat>,<lng>,…` |

### B. 给 Opus 的开场提示词（Marc 复制即用）
```
请先完整阅读 docs/ARCHITECTURE.md 和 docs/DECISIONS.md（我的回答；没回答的按文档默认值）。
严格遵守 CLAUDE.md，尤其是 Git 署名规则：所有 commit 只能用我的姓名和邮箱，
不得出现任何 Claude / Anthropic / Co-Authored-By / Generated with 等字样，推送前按 CLAUDE.md 自检。
从 Phase 0 开始，按路线图推进；每完成一个 checklist 项就提交一次；写 Claude API 相关代码前先调用 claude-api skill。
遇到文档标注「需核实」的 API，以实际编译结果和官方文档为准。开始吧。
```

### C. 参考资料
- Apple 开发者论坛：iOS 14 Maps Guides API（无官方 API）— https://developer.apple.com/forums/thread/663915
- Apple 支持：在 Apple Maps 中使用指南（仅手动）— https://support.apple.com/guide/maps/mps23f9c5bb1/mac
- WWDC24 10097「Unlock the power of places in MapKit」（Place ID、`MKMapItemRequest`、地点卡片）— https://developer.apple.com/videos/play/wwdc2024/10097/
- WWDC25 204「Go further with MapKit」（Place ID 持久性、新地理编码 API）— https://developer.apple.com/videos/play/wwdc2025/204
- Apple「Adopting unified Maps URLs」— https://developer.apple.com/documentation/mapkit/unified-map-urls
- Apple 旧版 Map Links 参数 — https://developer.apple.com/library/iad/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
- `MKMapItem.identifier` iOS 18 讨论 — https://developer.apple.com/forums/thread/769699
- Google Maps URLs（search / dir）— https://developers.google.com/maps/documentation/urls/get-started
- Google My Maps 导入限制 — https://support.google.com/mymaps/answer/3024836
- Google Maps Platform 定价 — https://developers.google.com/maps/billing-and-pricing/pricing
- Foundation Models 概览（第三方整理）— https://www.atelier-socle.com/en/articles/foundation-models-api-guide
