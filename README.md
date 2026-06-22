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
- Rust stable
- Tauri 2 系统依赖（macOS: Xcode CLT）

## 开发

```bash
pnpm install
pnpm tauri:dev    # 桌面应用（会自动释放 1420 端口）
pnpm dev          # 仅浏览器预览
```

若提示 `Port 1420 is already in use`，先结束旧的 dev 进程：`pnpm dev:kill-port`

## M0 已实现

- Monorepo（pnpm workspace）
- Tauri 2 + React 19 + Vite + TanStack Router/Query
- SQLite 本地存储 + 初始迁移（全表 schema）
- 设备身份（`device_get` / `device_update_name` / `app_get_info`）
- 项目 API（`project_list` / `project_create` / `project_get`）
- 项目列表 UI

## 文档

见 [doc/README.md](./doc/README.md)
