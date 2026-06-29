# 局域网 FLM 同步模块

本目录实现 Spanwork 设备间的 **Field-Level Merge（FLM）** 增量同步。业务 repo 只负责正常 SQL 读写；**outbound 变更日志由 SQLite trigger 自动写入**，inbound 合并由 registry 驱动的通用 FLM 处理。

详细产品/协议规划见仓库 `doc/design/DESIGN-v1.0-局域网同步-M3规划.md`（本地文档，不提交 git）。

联调排错见 `doc/sync/`（`VERSION_MISMATCH`、`CONNECT_FAILED`、诊断日志）。

团队通用术语（项目类型、FK、骨架、FLM 等）见 [`../../GLOSSARY.md`](../../GLOSSARY.md)。

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│  业务 repo（project / task / habit_* / …）                       │
│  INSERT / UPDATE / 软删（deleted_at）                            │
└────────────────────────────┬────────────────────────────────────┘
                             │ SQLite AFTER INSERT/UPDATE trigger
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  sync_field_changes（outbound 增量日志）                         │
│  suppress_field_log = 0 时记录；FLM apply 期间抑制               │
└────────────────────────────┬────────────────────────────────────┘
                             │ 同步会话 push / pull
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  对端 merge/flm.rs                                               │
│  1. ensure_rows_from_batch（registry 通用 skeleton INSERT）     │
│  2. apply_field_change（列级 LWW merge）                         │
└─────────────────────────────────────────────────────────────────┘
```

**单一配置源**：`registry.rs` 中的 `SYNC_TABLES`。baseline 扫描、trigger 生成、FLM skeleton、表依赖顺序均读取此配置。

---

## 模块文件

| 文件 | 职责 |
|------|------|
| `registry.rs` | 可同步表定义（列、FK 顺序、INTEGER 列、骨架默认值） |
| `triggers.rs` | 从 registry 生成并安装 outbound trigger |
| `merge/flm.rs` | Inbound 列级 merge + 通用 skeleton INSERT |
| `merge/baseline.rs` | 首次/空日志时全表扫描生成 synthetic changes |
| `session.rs` | 同步会话状态机、push/pull、cursor |
| `protocol.rs` / `pairing.rs` / `discovery.rs` / `listener.rs` | 传输与发现 |
| `../db/sync_log.rs` | `sync_field_changes` 读写、compaction、suppress 开关 |

Migration **012** 记录 schema 版本并在启动时调用 `triggers::install_sync_triggers`。

---

## 可同步表（当前 8 张）

按 FK 依赖顺序（`rank` 越小越先 skeleton 插入）：

| rank | 表名 | 说明 |
|------|------|------|
| 0 | `project_categories` | 项目分类 |
| 1 | `projects` | 项目 |
| 2 | `tasks` | 任务 |
| 3 | `habit_rules` | 习惯规则 |
| 4 | `milestones` | 里程碑 |
| 5 | `habit_occurrences` | 习惯打卡实例 |
| 6 | `milestone_links` | 里程碑关联 |
| 7 | `time_entries` | 时间记录（已完成） |

### 不参与同步的表

以下表**不要**加入 `SYNC_TABLES`：

- `device_config`、`active_timer` — 设备本地状态
- `sync_field_changes`、`sync_internal`、`sync_peer_cursor`、`sync_session_log` — 同步元数据
- `reports`、`siyuan_bindings`、`schema_migrations` — 本地/集成数据

---

## 业务开发约定

### 必须遵守

1. **禁止在 repo 里手动写 sync 日志**  
   不要调用已删除的 `sync_hooks`，也不要直接 `INSERT INTO sync_field_changes`。所有 outbound 日志由 trigger 产生。

2. **可同步表的写操作必须走标准 repo SQL**  
   对 `SYNC_TABLES` 中的表执行 `INSERT` / `UPDATE`（含软删 `deleted_at`）即可自动记日志。包括：
   - `reorder` 批量改 `sort_order`
   - `batch_complete` 批量改 `status`
   - `habit_occurrence::ensure_range` / `mark_missed` 自动生成的实例
   - 级联软删中对子表的 `UPDATE`

3. **新增/变更 schema 时必须更新 `registry.rs`**  
   这是唯一需要维护的同步配置。漏改会导致：增量日志缺列、对端 skeleton 缺默认值、或 trigger 未覆盖新列。

4. **FLM apply 期间保持 suppress**  
   `merge/flm.rs` 在 `apply_batch` 前后调用 `sync_log::set_suppress_log(true/false)`，避免 inbound 写库再次触发 outbound。新增 merge 路径时须同样抑制。

5. **软删用 `deleted_at`，不要物理 DELETE**  
   trigger 只在 UPDATE 时比较列变化；`deleted_at` 从 NULL 变为时间戳会作为普通列变更同步。

### 特殊规则

| 场景 | 行为 |
|------|------|
| `time_entries` baseline | 仅扫描 `deleted_at IS NULL AND end_at IS NOT NULL`（进行中的计时不 baseline） |
| `time_entries` inbound apply | 非 `deleted_at` 列在 `end_at` 为空时可能被跳过（见 `flm.rs` 注释） |
| `habit_occurrences` id | 使用 `deterministic_occurrence_id`，跨设备 id 一致 |
| 首次配对 / peer cursor = 0 且本地无 pending | 走 baseline 全量扫描（`SELECT *` 按 registry 列展开） |

---

## 使用方法：常见变更场景

### 场景 A：给已有可同步表加一列

1. 新增 migration SQL（`ALTER TABLE … ADD COLUMN`）。
2. 打开 `registry.rs`，在对应表的 `columns` 数组末尾加入列名（顺序与 schema 一致即可，建议跟在业务列后、`created_at` 前）。
3. 若该列为 `INTEGER`，同时加入 `integer_columns`。
4. 若 skeleton 插入时需要非 NULL 默认值，在 `SyncTableDef::default_value` 中补充。
5. 运行 `cargo test sync::`，重启应用（migration + 重装 trigger）。

**repo 无需改动**（除非新业务逻辑读写该列）；trigger 由 registry 自动生成。

### 场景 B：新增一张可同步表

1. migration 创建表，须包含标准字段：
   - `id TEXT PRIMARY KEY`
   - `created_at INTEGER NOT NULL`
   - `updated_at INTEGER NOT NULL`
   - `deleted_at INTEGER`（若需软删）
   - `origin_device_id TEXT NOT NULL`
2. 在 `registry.rs` 的 `SYNC_TABLES` 中追加 `SyncTableDef`：
   - `rank`：按 FK 依赖设定（被引用的表 rank 更小）
   - `columns`：除 `id` 外全部可同步列
   - `required_fk`：skeleton INSERT 前 batch 中必须出现的 FK 列
   - `integer_columns`：所有 INTEGER 列
3. 实现 repo CRUD（正常 SQL，不碰 sync 日志）。
4. 若 baseline 需特殊过滤（如 `time_entries`），在 `merge/baseline.rs` 增加分支。
5. 运行测试；启动时 migration 012+ 会调用 `install_sync_triggers` 为新表创建 trigger。

### 场景 C：列不应同步

- **不要**把该列写进 `registry.columns`。
- trigger 与 baseline 均只处理 registry 声明的列。

### 场景 D：调试 outbound 是否记日志

```sql
SELECT column_name, value, op, updated_at
FROM sync_field_changes
WHERE pk = '<实体 id>'
ORDER BY change_seq DESC;
```

或在 Rust 测试中参考 `sync/triggers.rs` 的 `trigger_logs_full_task_insert`。

---

## registry 字段说明

```rust
SyncTableDef {
    name: "tasks",           // 表名
    rank: 2,                 // FK 拓扑排序，见上表
    columns: &[...],         // 可同步列（不含 id）
    required_fk: &[...],     // skeleton 前置条件
    integer_columns: &[...], // trigger CAST 为 TEXT 存储
}
```

`skeleton_param()`：inbound batch 预插入行时，从列变更 map 取值；缺失时使用 `default_value()` 或 NULL。

---

## 测试要求

新增或修改 registry 后至少运行：

```bash
cd apps/spanwork/src-tauri
cargo test sync::
```

关键用例：

- `sync::registry::tests::every_sync_table_has_columns`
- `sync::triggers::tests::*` — outbound 全列 / 更新记日志
- `sync::merge::flm::tests::*` — inbound merge、skeleton、FK 顺序
- `sync::session::tests::*` — 端到端 TCP 同步

若新增表或改 FK 顺序，建议补充 FLM 集成测试（参考 `apply_baseline_project_with_category_without_fk_violation`）。

---

## 历史说明

M3 早期曾在各 repo 中手动调用 `db/sync_hooks.rs` 按列记日志，并与 `flm.rs` 内手写 skeleton 并存，容易漏列。

自 **schema v12** 起：

- 已删除 `sync_hooks.rs`
- outbound 统一为 SQLite trigger（`triggers.rs`）
- inbound skeleton 统一为 registry 驱动（`merge/flm.rs`）

旧数据库升级到 v12 后会在启动时自动安装 trigger；**升级前已产生的增量日志不会 retroactive 补列**，需在源设备触发一次 UPDATE 或重新 baseline 同步。
