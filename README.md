# Spanwork（跨度）

个人长期项目管理 — Tauri 2 + React monorepo。

## 结构

```
├── apps/spanwork/       # Tauri 桌面/移动应用（React + Rust）
├── packages/
│   └── shared-types/    # 前后端共享 TypeScript 类型
└── doc/                 # 设计文档
```

## 环境要求

- Node.js 20+
- pnpm 9+
- Rust stable（见根目录 `rust-toolchain.toml`）
- Tauri 2 系统依赖（macOS: Xcode CLT）

## 开发

```bash
pnpm install
pnpm tauri:dev    # 桌面应用（会自动释放 1420 端口）
pnpm dev          # 仅浏览器预览（无 Tauri IPC）
```

若提示 `Port 1420 is already in use`，先结束旧的 dev 进程：`pnpm dev:kill-port`

> **注意**：Tauri 桌面窗口需在本地终端启动 `pnpm tauri:dev`，Cursor 沙箱环境无法正常弹出 GUI 窗口。

## 已实现

### M0

- Monorepo（pnpm workspace）
- Tauri 2 + React 19 + Vite + TanStack Router/Query
- SQLite 本地存储 + 初始迁移
- 设备身份、项目 CRUD、项目列表 UI

### M1（进行中）

- 任务 CRUD、2 级子任务树（`is_milestone` 里程碑任务才可展开子任务）
- 项目详情页、产品 Milestone CRUD
- 全局计时器（start / stop / cancel）+ 顶部浮层计时栏
- 时间记录手动补录、今日 Dashboard
- 底部状态栏统一错误提示（`AppStatusLine`）
- 弹窗创建任务（`TaskCreateDialog`）

## 文档

见 [doc/README.md](./doc/README.md)
