# Spanwork — 架构设计文档（ARCH v1.0）

| 项目 | 说明 |
|------|------|
| 应用 | Spanwork（跨度） |
| 文档版本 | v1.0 |
| 创建日期 | 2026-06-22 |
| 关联文档 | [PRD v1.1](./PRD-v1.0-需求文档.md) · [数据库](./SCHEMA-v1.0-数据库设计.md) · [Tauri Commands](./API-v1.0-Tauri-Commands.md) · [同步协议](./SYNC-v1.0-局域网同步协议.md) |

---

## 1. 架构目标

| 目标 | 设计对策 |
|------|----------|
| 离线优先 | 所有业务读写走本地 SQLite；UI 不直接访问网络 |
| 单用户多设备 | 局域网无主同步；cr-sqlite changeset 合并 |
| AI 友好 | 前端薄、Rust 承载领域逻辑；Command 边界清晰、DTO 稳定 |
| 个人可维护 | 单仓库 monorepo；模块按领域划分；V1.1 能力预留接口 |
| 四端一致 | 同一 React 构建产物 + 响应式布局 |

---

## 2. 系统分层

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation — React 19 + Vite + TypeScript               │
│  TanStack Router · Zustand · TanStack Query · shadcn/ui      │
├─────────────────────────────────────────────────────────────┤
│  IPC Adapter — src/lib/tauri/*.ts                            │
│  类型安全的 invoke 封装 · 错误映射 · 事件订阅                  │
├─────────────────────────────────────────────────────────────┤
│  Application — Tauri Commands (src-tauri/src/commands/)      │
│  参数校验 · DTO 转换 · 调用 Service                          │
├─────────────────────────────────────────────────────────────┤
│  Domain — src-tauri/src/domain/                              │
│  习惯实例生成 · 任务树规则 · 计时器策略 · 冲突策略            │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure                                              │
│  db/ · sync/ · timer/ · export/ · siyuan/ (stub)             │
├─────────────────────────────────────────────────────────────┤
│  SQLite (rusqlite + cr-sqlite) + 系统 Keychain/Keystore      │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 职责边界

| 层 | 负责 | 不负责 |
|----|------|--------|
| **React** | 路由、表单、列表 UI、计时器展示、同步进度 UI | SQL、合并逻辑、文件 IO |
| **Tauri Commands** | 鉴权边界、序列化、调用 Service | 复杂业务规则（下沉 domain） |
| **Domain** | 纯 Rust 业务规则与单元测试 | HTTP、mDNS、SQLite 细节 |
| **db/sync** | 持久化、changeset、mDNS、TCP | UI 状态 |

### 2.2 数据流示例：创建任务

```
User → TaskCreateDialog → invoke('task_create', dto)
  → commands::task::create
  → domain::task::validate
  → db::repos::task::insert (触发 cr-sqlite changes)
  → TaskDto → React Query invalidate → 列表刷新
```

### 2.3 数据流示例：局域网同步

```
User → SyncPage → invoke('sync_start_session', { peer_id })
  → sync::session::run
  → mdns 已发现 peer / 或 manual endpoint
  → TCP 握手 + 配对码校验
  → 交换 meta → push/pull changesets → merge
  → emit('sync://progress') → UI 进度条
  → SyncResultDto
```

---

## 3. 仓库结构

```
self-management/
├── doc/                          # 设计文档
├── src/                          # React 前端
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx             # 今日
│   │   ├── projects/
│   │   ├── settings/
│   │   └── sync/
│   ├── pages/
│   ├── components/
│   │   ├── ui/                   # shadcn
│   │   ├── layout/
│   │   ├── project/
│   │   ├── task/
│   │   ├── habit/
│   │   ├── timer/
│   │   └── sync/
│   ├── hooks/
│   ├── stores/
│   │   ├── timer-store.ts
│   │   └── ui-store.ts
│   ├── lib/
│   │   ├── tauri/                # invoke 封装
│   │   ├── types/                # 与 Rust DTO 对齐
│   │   └── utils/
│   └── queries/                  # TanStack Query keys + fetchers
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   └── src/
│       ├── lib.rs                # 注册 commands + 初始化
│       ├── main.rs
│       ├── state.rs              # AppState (DbPool, TimerState, SyncState)
│       ├── error.rs              # AppError → 前端可读码
│       ├── dto/                  # 共享序列化类型
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── project.rs
│       │   ├── task.rs
│       │   ├── habit.rs
│       │   ├── milestone.rs
│       │   ├── time_entry.rs
│       │   ├── timer.rs
│       │   ├── sync.rs
│       │   ├── device.rs
│       │   └── export.rs
│       ├── domain/
│       │   ├── mod.rs
│       │   ├── habit_schedule.rs # 周期规则 → 实例生成
│       │   ├── task_tree.rs
│       │   └── time.rs
│       ├── db/
│       │   ├── mod.rs
│       │   ├── pool.rs
│       │   ├── migrate.rs
│       │   └── repos/
│       ├── sync/
│       │   ├── mod.rs
│       │   ├── discovery.rs
│       │   ├── protocol.rs
│       │   ├── session.rs
│       │   └── merge.rs
│       ├── timer/
│       │   └── mod.rs
│       └── export/
│           └── mod.rs
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 4. Rust 核心模块

### 4.1 AppState

```rust
pub struct AppState {
    pub db: DbPool,                    // Arc<Mutex<Connection>> 或 r2d2
    pub device: DeviceIdentity,        // device_id, device_name, platform
    pub timer: Arc<Mutex<TimerState>>, // 内存 + 可选持久化 checkpoint
    pub sync: Arc<SyncCoordinator>,    // 发现服务、会话锁
}
```

- 应用启动：`migrate` → 加载/创建设备身份 → 注册 mDNS（仅 sync 页面激活时可懒启动）
- 单进程内 `sync` 会话互斥：同一时刻只允许一个同步会话

### 4.2 错误模型

```rust
#[derive(Debug, Serialize)]
pub struct ErrorBody {
    pub code: String,      // e.g. "TASK_NOT_FOUND"
    pub message: String,
}

pub enum AppError {
    NotFound { entity: &'static str, id: String },
    Validation { field: String, reason: String },
    Conflict { entity: String, detail: String },
    Sync(SyncError),
    Db(rusqlite::Error),
    Internal(String),
}
```

前端约定：`invoke` 失败时解析 `ErrorBody.code` 做 i18n 或 toast。

### 4.3 Domain 模块要点

#### habit_schedule

- 输入：`HabitRule` + 日期范围
- 输出：应生成的 `HabitOccurrence` 列表
- 规则：`daily | weekly | monthly | yearly`
- 启动时 / 打开习惯项目时：**补齐**未来 90 天 + 回溯修正 `pending → missed`

#### task_tree

- 删除父任务：级联软删除子任务（或禁止删除有子项的父任务 — V1 选**级联软删除**）
- 完成度：计算子任务完成比例，供 UI 提示（不强制改父状态）

#### timer

- 全局唯一 `ActiveTimer`：`target_type + target_id + started_at`
- `stop` 时写入 `time_entries`，`source = timer`
- **不同步**活跃计时器；各设备独立

### 4.4 模块依赖图

```
commands ──→ domain ──→ (pure)
    │
    └──→ db/repos
    └──→ sync/session ──→ db + protocol
    └──→ timer ──→ db
    └──→ export ──→ db
```

`domain` 不依赖 `db`，通过 trait 或传入 struct 测试。

---

## 5. 前端架构

### 5.1 技术栈（已确认）

| 类别 | 选型 |
|------|------|
| 框架 | React 19 + Vite 6 |
| 语言 | TypeScript 5.x strict |
| 路由 | TanStack Router |
| 服务端状态 | TanStack Query v5 |
| 客户端状态 | Zustand（计时器 tick、侧边栏） |
| UI | shadcn/ui + Tailwind CSS 4 |
| 表单 | React Hook Form + Zod |
| 日期 | date-fns |
| Tauri | `@tauri-apps/api` v2 |

### 5.2 路由表（V1）

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | TodayPage | 计时器 + 今日习惯 + 最近任务 |
| `/projects` | ProjectListPage | 项目列表 |
| `/projects/:id` | ProjectDetailPage | 概览 / 任务 or 习惯 / 时间 |
| `/projects/:id/tasks/:taskId` | TaskDetailPage | 可选，或抽屉 |
| `/settings` | SettingsPage | 设备、导出 |
| `/settings/sync` | SyncPage | 发现、配对、同步 |

桌面 ≥1024px：`ProjectDetailPage` 使用主从布局（左列表右详情）。

### 5.3 状态分工

| 状态 | 存储 | 原因 |
|------|------|------|
| 项目/任务/习惯列表 | TanStack Query | 服务端=Rust DB，自动缓存失效 |
| 活跃计时器 tick | Zustand + `setInterval` | 高频 UI 更新，不必每次 invoke |
| 计时器权威状态 | Rust `timer_*` commands | 停止时持久化 |
| 同步进度 | Tauri Event + React state | 流式推送 |
| 主题/侧边栏 | Zustand + localStorage | 纯 UI |

### 5.4 IPC 封装约定

```typescript
// src/lib/tauri/task.ts
export async function createTask(input: CreateTaskInput): Promise<TaskDto> {
  return invoke('task_create', { input });
}
```

- 所有 DTO 定义在 `src/lib/types/`，与 Rust `dto/` 字段名一致（serde camelCase）
- Query key 规范：`['tasks', projectId]`、`['habit-occurrences', projectId, dateRange]`

### 5.5 Tauri 事件

| 事件名 | 载荷 | 用途 |
|--------|------|------|
| `sync://discovered` | `PeerInfo[]` | 发现新设备 |
| `sync://progress` | `{ phase, percent, message }` | 同步进度 |
| `sync://completed` | `SyncResultDto` | 同步结束 |
| `timer://ticked` | `{ elapsed_seconds }` | 可选，Rust 侧 1s 推送 |

V1 计时器展示以前端 `startedAt` + 本地 tick 为主，Rust 存 authoritative start time。

---

## 6. 跨平台与部署

### 6.1 平台差异封装

| 能力 | 实现位置 | 说明 |
|------|----------|------|
| 数据库路径 | `db/pool.rs` | Tauri `app_data_dir` |
| 通知 | `tauri-plugin-notification` | Milestone 完成（P1） |
| 密钥存储 | `tauri-plugin-stronghold` 或 OS keychain | V1.1 思源 Token |
| 前台服务（Android 计时） | V1 不实现；文档说明限制 | V2 |

### 6.2 构建矩阵

| 平台 | 命令 | 产物 |
|------|------|------|
| macOS | `tauri build` | `.app` / `.dmg` |
| Windows | `tauri build` | `.msi` / `.exe` |
| Android | `tauri android build` | `.apk` / `.aab` |
| iOS | `tauri ios build` | Xcode archive |

### 6.3 开发环境

- Node 20+、Rust stable、Tauri CLI 2.x
- 移动端：`TAURI_DEV_HOST` 指向局域网 IP

---

## 7. 安全设计

| 项 | V1 策略 |
|----|---------|
| 同步鉴权 | 6 位配对码，会话级，5 分钟有效 |
| 传输 | 局域网 TCP；V1 不强制 TLS（同 Wi‑Fi 信任模型） |
| 数据 at rest | SQLite 明文；V2 可选 SQLCipher |
| 导出 | 用户主动触发；写至用户选择路径 |
| 命令暴露 | Tauri capabilities 最小权限 |

---

## 8. V1.1 扩展点（预留）

| 模块 | 预留方式 |
|------|----------|
| 报告 | `reports` 表 + `commands/report.rs` stub |
| 思源 | `siyuan/` 模块 + `SiyuanBinding` 表 + settings 页占位 |
| 自动同步 | `SyncCoordinator` 增加 scheduler trait |
| 冲突 UI | `sync_conflicts` 表 + `/settings/sync/conflicts` 路由 |

---

## 9. 测试策略

| 层级 | 工具 | 覆盖 |
|------|------|------|
| Domain | `cargo test` | 习惯规则、日期边界、LWW |
| DB repos | `cargo test` + 内存 SQLite | CRUD、软删除 |
| Sync protocol | 集成测试，双 socket | 握手、changeset 往返 |
| Commands | 少量 smoke test | — |
| 前端 | Vitest + Testing Library | 表单 Zod、纯函数 |
| E2E | 选手动 | 核心流程 |

---

## 10. 里程碑与实现顺序

与 PRD 对齐，架构落地顺序：

1. **M0**：仓库脚手架 + `AppState` + migration v1 + `project_*` / `task_*` commands
2. **M1**：计时器 + `time_entry_*` + Today 页
3. **M2**：`habit_*` + `habit_schedule` domain
4. **M3**：`sync/*` 全链路 + Sync 页（见同步协议文档）
5. **M4**：export + 四端打包配置
6. **M5**：冲突 inbox 简版、性能与 UX

---

## 11. 文档索引

| 文档 | 内容 |
|------|------|
| [SCHEMA-v1.0-数据库设计.md](./SCHEMA-v1.0-数据库设计.md) | 表结构、索引、迁移、cr-sqlite |
| [API-v1.0-Tauri-Commands.md](./API-v1.0-Tauri-Commands.md) | 全部 Command 与 DTO |
| [SYNC-v1.0-局域网同步协议.md](./SYNC-v1.0-局域网同步协议.md) | mDNS、TCP 消息、合并流程 |

---

## 12. 修订记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-06-22 | 初稿：分层、目录、模块、前端、测试 |
