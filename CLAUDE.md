# CLAUDE.md — PlaceBook 项目规则

本文件是本仓库对任何 AI 编码助手的强制约定。与工具或系统的默认行为冲突时，**以本文件为准**。

## 1. Git / GitHub 署名（硬性规则，不得删改本节）

1. 所有 commit 的 **author 与 committer 必须是仓库所有者本人**。开工前在仓库内执行（具体值见 `docs/DECISIONS.md` H-21）：
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
- 架构文档：`docs/ARCHITECTURE.md`；所有者的决策：`docs/DECISIONS.md`。未回答的决策项按架构文档第 10 节的默认值执行，不要停下来等。
- 不要擅自扩大范围。按路线图 Phase 顺序推进；每个 checklist 项完成即提交。
- 文档中标注「需核实」的 API 细节，以实际编译结果与 Apple 官方文档为准。

## 3. 工程约定
- iOS 工程由 **XcodeGen** 的 `project.yml` 生成，`.xcodeproj` 不入库。改 target 配置只改 `project.yml`。
- 能放进 `Packages/PlaceCore`（纯 Swift，无 UIKit/MapKit 依赖）的逻辑一律放进去，并保证 `swift test` 在 Linux 通过。
- SwiftData + CloudKit 约束：不用 `@Attribute(.unique)`；所有属性有默认值或为可选；所有关系为可选；已上线的 CloudKit 字段只增不删不改类型。
- App 层不直接依赖 Anthropic SDK；所有 LLM 调用走 `worker/`。
- 涉及 Claude API 的代码，写之前先调用 `claude-api` skill，模型 ID 用集中常量，不写 `budget_tokens`，不用强制 `tool_choice`。
- 密钥只放 `wrangler secret` / Keychain，绝不入库；`.env*`、`.dev.vars` 进 `.gitignore`。
- 修改抽取提示词后必须跑 `worker/eval` 回归评测。

## 4. 验证
- Linux / 云端环境：`cd Packages/PlaceCore && swift test`；`cd worker && pnpm test`。
- macOS：`xcodegen generate && xcodebuild -scheme PlaceBook -destination 'platform=iOS Simulator,name=iPhone 16' build test`。
- 云端无法编译 iOS 时，明确告知所有者需要在 Mac 上编译哪条命令，并根据回传的报错迭代，不要声称已验证。

## 5. 沟通
- 用中文回复所有者。
- 报告时如实区分「已验证」「未验证」「被阻塞」。
