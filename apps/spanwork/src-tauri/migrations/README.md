# SQLite migrations 目录

本目录分为两部分：**全量 schema 快照**（阅读用）与 **版本化迁移脚本**（运行用）。

```text
migrations/
├── README.md           # 本说明
├── schema/
│   └── current.sql     # 当前 SCHEMA_VERSION 的完整表结构（只读参考）
└── versions/
    ├── 001_initial.sql
    ├── …
    └── 014_*.sql       # 按序执行的增量迁移
```

## schema/ — 全量脚本

| 文件 | 说明 |
|------|------|
| `current.sql` | migration 001–014 应用后的**最终 DDL**；按功能域分段注释 |

- **不参与** App 启动时的 `run_migrations`。
- 新人理解表结构时优先读此文件，再配合 `GLOSSARY.md` §6 与 `src/sync/registry.rs`。
- FLM 同步 **trigger** 由 `src/sync/triggers.rs` 在运行时安装，不在 `current.sql` 中。

新增 migration 后，请同步更新 `current.sql`（保持与 `migrate.rs` 中 `SCHEMA_VERSION` 一致）。

## versions/ — 迁移脚本

| 版本 | 功能域 | 备注 |
|------|--------|------|
| 001 | 核心骨架 | 初始建表 |
| 002–003 | 任务树 | `is_milestone` + 数据修复 |
| 004 | 项目分类 | `project_categories`、`category_id` |
| 005 | 计时器 | `active_timer` 暂停字段 |
| 006–009 | 习惯 | 多规则、Fogg、行为设计、多日期 schedule |
| 010 | 任务行为设计 | `tasks` 扩展字段 |
| 011–012 | 同步 FLM | 变更日志表；012 占位，trigger 在 Rust |
| 013–014 | 项目类型 | `task` → `aim`；013 整表重建需关 FK |

执行逻辑：`src/db/migrate.rs` 读取 `schema_migrations`，从当前版本顺序 apply 至 `SCHEMA_VERSION`。

## 相关代码

- 迁移 runner：`src/db/migrate.rs`
- 同步可同步表：`src/sync/registry.rs`
- 术语：`../../GLOSSARY.md`
