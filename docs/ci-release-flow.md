# CI 提交与多端打包发布流程

本文说明 Spanwork 的 CI 分支策略、提交方式和打包触发规则。目标是：日常提交不误触发耗时打包；需要发布时，可以用明确的 tag 直接触发 iOS、macOS、Windows 等多端构建与发布。

## Workflow 概览

| Workflow | 触发方式 | 用途 |
| --- | --- | --- |
| `iOS Beta Package Test` | `ios-test-v*-beta.*` tag 或手动触发 | 只测试 iOS/TestFlight 打包上传，不构建 macOS/Windows |
| `Release Beta` | `v*-beta.*` tag 或手动触发 | beta 发布：构建 macOS、Windows、iOS，并上传 TestFlight 与 GitHub prerelease |
| `Release` | 非 beta 的 `v*` tag 或手动触发 | 正式发布：构建 macOS、Windows、iOS，上传 App Store Connect，并发布 GitHub Release |
| `Desktop Release (legacy)` | 手动触发 | 旧桌面端手动发布入口，优先使用 tag-driven release workflows |

## 分支策略

### `main`

- `main` 是正式集成分支。
- 普通 merge / push 到 `main` 不应自动触发全平台打包。
- 需要打包发布时，在 `main` 的目标提交上创建对应 release tag。

### `cursor/ci-testbed-d2b6`

- 这是长期 CI 测试分支。
- 定期从 `main` 同步即可。
- 普通 push 到该分支不触发 workflows。
- 如需测试 CI，使用专用 tag 或手动 workflow。

## 推荐发布流程

### 1. 普通代码合并

1. 功能分支提交 PR。
2. PR 合并到 `main`。
3. 不创建 release tag 时，不触发全平台打包。

### 2. 快速验证 iOS 打包

用于调试 iOS 打包、签名、图标、TestFlight 上传，不浪费 macOS/Windows runner。

```bash
git checkout main
git pull origin main
git tag -a ios-test-v0.1.0-beta.N -m "Spanwork iOS beta package test N"
git push origin ios-test-v0.1.0-beta.N
```

预期结果：

- 只触发 `iOS Beta Package Test`。
- 不触发 `Release Beta`。
- 不触发 macOS/Windows 打包。

### 3. beta 多端发布

确认 iOS-only 测试通过后，再创建 beta tag。

```bash
git checkout main
git pull origin main
git tag -a v0.1.0-beta.N -m "Spanwork v0.1.0 beta N"
git push origin v0.1.0-beta.N
```

预期结果：

- 触发 `Release Beta`。
- 构建 macOS、Windows、iOS。
- iOS 上传 TestFlight。
- GitHub Release 标记为 prerelease。
- 不触发正式 `Release` workflow。

### 4. 正式多端发布

```bash
git checkout main
git pull origin main
git tag -a v0.1.0 -m "Spanwork v0.1.0"
git push origin v0.1.0
```

预期结果：

- 触发 `Release`。
- 构建 macOS、Windows、iOS。
- iOS 上传 App Store Connect。
- GitHub Release 标记为 latest。

## 为什么之前会出现两个 workflow

之前 `Release` workflow 的触发规则是 `v*`，因此 `v0.1.0-beta.4` 同时匹配：

- `Release Beta`: `v*-beta.*`
- `Release`: `v*`

`Release` 内部 gate 会识别 beta tag 并跳过，所以它没有真的打包，但会产生一个额外的 workflow run。现在 `Release` 的 tag 规则排除了 `v*-beta.*`，beta tag 只会触发 `Release Beta`。

## iOS 打包关键步骤

iOS workflows 在 `tauri ios init` 后会执行这些修复步骤：

1. `pnpm icons:sync`：同步 iOS AppIcon asset catalog。
2. `fix-ios-icon-alpha.sh`：移除 AppIcon PNG alpha channel，避免 App Store Connect 拒绝上传。
3. `fix-tauri-ios-podfile.sh`：移除不存在的 `spanwork_macOS` Podfile target。
4. `fix-tauri-ios-signing.sh`：写入手动签名配置，并让 Xcode Rust build phase 继承 CI pnpm 环境。
5. `select-xcode.sh 26`：确保使用 Xcode 26 / iOS 26 SDK 构建并上传。

## 排障建议

- 只调 iOS：先用 `ios-test-*` tag。
- 只调桌面：优先使用手动 legacy desktop workflow，避免创建 `v*` tag。
- 全平台 beta：只在 iOS-only 通过后使用 `v*-beta.*` tag。
- 全平台正式版：使用非 beta 的 `v*` tag。
