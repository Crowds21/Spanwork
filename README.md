# Spanwork（跨度）

个人长期项目管理 — Tauri 2 + React monorepo。

## 结构

```
├── apps/spanwork/       # Tauri 桌面/移动应用（React + Rust）
│   └── GLOSSARY.md      # 团队术语表（类型、缩写、同步词汇）
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

### M1（进行中 → 收尾）

- 任务 CRUD、2 级子任务树（`is_milestone` 里程碑任务才可展开子任务；创建/详情页可切换）
- 项目详情页、任务详情弹窗（ID、编辑、分页时间记录）
- 全局计时器（start / stop / cancel）+ 双模式顶栏（展开浮层 / 全宽收缩条）
- 时间记录：计时停止写入起止时间；补录支持开始/结束时间
- 今日 Dashboard、底部状态栏（`AppStatusLine`）
- 弹窗创建任务（`TaskCreateDialog`）、任务行图标按钮 + Tooltip
- Rust workspace 化（根目录 `Cargo.toml` + `Cargo.lock`）；schema migration v3

**M1 遗留**：`task_reorder` 拖拽 UI；时间记录单条编辑/删除 UI

## 文档

见 [doc/README.md](./doc/README.md)
