---
title: CI 失败复盘
layout: default
nav_order: 4
permalink: /ci-failure-analysis/
---

本文记录近期 Spanwork CI 打包流程中几次失败的原因、表现和修复结果，方便后续维护 tag-driven release 与 iOS-only 测试流程。

## 背景

- 通用发布流程：`Release Beta` / `Release` 通过 `v*` tag 触发，会同时构建桌面端和 iOS。
- iOS 单独验证流程：`iOS Beta Package Test` 通过 `ios-test-v*-beta.*` tag 触发，只构建并上传 iOS/TestFlight，不触发 macOS/Windows。
- 长期 CI 测试分支：`cursor/ci-testbed-d2b6` 基于 `main`，普通 push 不触发任何 workflow；需要显式 tag 或手动 workflow 才测试 CI。

## 失败与修复记录

| 阶段 | Run / Tag | 失败表现 | 根因 | 修复 |
| --- | --- | --- | --- | --- |
| 桌面端打包 | PR desktop workflow 初始 run | `pnpm` 在 `actions/setup-node` 阶段报 `No such built-in module: node:sqlite` | CI 使用 Node 20，但仓库锁定 `pnpm@11.8.0`，需要 Node >= 22.13 | 将 CI Node 升级到 24，并同步 `package.json` 的 `engines.node` |
| 桌面端 artifact | 本地/CI 打包路径校验 | 上传路径找不到安装包 | Tauri workspace 的 bundle 输出在根目录 `target/release/bundle`，不是 `apps/spanwork/src-tauri/target` | workflow artifact 路径改为 `target/release/bundle/...` |
| beta release 启动 | `v0.1.0-beta.1` 早期 runs | workflow `startup_failure` | 可复用 workflow / `inputs` 上下文在 tag push 场景不适用 | 将 release workflow 内联，并避免 tag push 下直接依赖 `inputs` |
| iOS CocoaPods | `v0.1.0-beta.1` | `pod install` 报 `Unable to find a target named spanwork_macOS` | `tauri ios init` 生成的 Xcode project 只有 `spanwork_iOS`，但 Podfile 里有 `spanwork_macOS` target | 增加 `fix-tauri-ios-podfile.sh`，在不存在 macOS target 时移除 Podfile 中的 `spanwork_macOS` block |
| iOS 签名 | `v0.1.0-beta.2` / `ios-test-v0.1.0-beta.4` | Xcode 报 `No Accounts` / `requires a provisioning profile` | CI 只安装了证书和 mobileprovision，但 Tauri/Xcode project 没有拿到手动签名配置 | 将签名资产解析为环境变量，并新增 `fix-tauri-ios-signing.sh` 显式修补 Xcode project 的 team/profile/sign identity |
| CocoaPods 解析 project | `ios-test-v0.1.0-beta.5` | CocoaPods 报 `Dictionary missing value for key CODE_SIGN_IDENTITY` | 修补脚本写入了未加引号的 `CODE_SIGN_IDENTITY[sdk=iphoneos*]` key，pbxproj 语法对 CocoaPods 不兼容 | 移除 sdk-specific key，保留通用 `CODE_SIGN_IDENTITY`，并给 profile UUID 加引号 |
| Xcode Rust build phase | `ios-test-v0.1.0-beta.6` / `.7` | `pnpm install` 报 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` | Xcode 的 `Build Rust Code` phase 会再次调用 pnpm；workflow step 的 `CI=true` 没有穿透到该 shell phase | 在生成的 Xcode build phase 脚本开头写入 `export CI=true` 和 `export PNPM_CONFIG_CONFIRM_MODULES_PURGE=false` |

## 最终验证结果

- `ios-test-v0.1.0-beta.8` 只触发 `iOS Beta Package Test`，没有触发通用 `Release Beta` 的 macOS/Windows 打包。
- `ios-test-v0.1.0-beta.8` 成功完成 iOS build、上传 TestFlight，并产出 `spanwork-ios-test-*` artifact。
- 验证通过后，已将 iOS Podfile、签名、pnpm/Xcode build phase 修复回填到通用 `release-beta.yml` 和 `release.yml`。

## 后续 CI 测试建议

1. 快速测试 iOS：推送 `ios-test-vX.Y.Z-beta.N` tag，只跑 iOS-only workflow。
2. 测试通用 beta release：确认 iOS-only 通过后，再推送 `vX.Y.Z-beta.N` tag。
3. 同步长期 CI 测试分支：定期将 `cursor/ci-testbed-d2b6` 同步到最新 `main`；普通 push 不会触发 workflows。
4. 不要用 `v*` tag 做单平台调试，因为它会触发通用 release，带上 macOS/Windows 打包。
