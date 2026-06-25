//! 可同步表的单一注册表：列清单、FK 顺序、骨架默认值。
//!
//! 增删列或新增可同步表时**必须**更新本文件，详见 [`README.md`](README.md)。

#[derive(Debug, Clone, Copy)]
pub struct SyncTableDef {
    pub name: &'static str,
    /// FK 依赖顺序（越小越先插入 skeleton）。
    pub rank: u8,
    /// 可同步列（不含 `id`），顺序与 schema 一致。
    pub columns: &'static [&'static str],
    /// skeleton INSERT 前 batch 中必须出现的 FK 列。
    pub required_fk: &'static [&'static str],
    /// INTEGER 列 — trigger 中 CAST 为 TEXT 写入 sync_field_changes。
    pub integer_columns: &'static [&'static str],
}

impl SyncTableDef {
    pub fn is_integer_column(&self, column: &str) -> bool {
        self.integer_columns.contains(&column)
    }

    pub fn default_value(&self, column: &str) -> Option<&'static str> {
        Some(match (self.name, column) {
            (_, "sort_order" | "priority") => "0",
            (_, "is_milestone" | "behavior_design_enabled" | "celebration_on_complete") => "0",
            ("projects", "project_type") => "aim",
            ("projects", "status") => "active",
            ("tasks", "status") => "todo",
            ("habit_rules", "frequency") => "daily",
            ("habit_occurrences", "status") => "pending",
            ("milestones", "status") => "not_started",
            ("time_entries", "duration_seconds") => "0",
            ("time_entries", "source") => "manual",
            ("tasks" | "projects" | "habit_rules" | "habit_occurrences" | "milestones"
            | "milestone_links" | "project_categories" | "time_entries", "title") => "",
            _ => return None,
        })
    }
}

pub const SYNC_TABLES: &[SyncTableDef] = &[
    SyncTableDef {
        name: "project_categories",
        rank: 0,
        columns: &[
            "name",
            "color",
            "icon",
            "sort_order",
            "created_at",
            "updated_at",
            "deleted_at",
            "origin_device_id",
        ],
        required_fk: &[],
        integer_columns: &["sort_order", "created_at", "updated_at", "deleted_at"],
    },
    SyncTableDef {
        name: "projects",
        rank: 1,
        columns: &[
            "name",
            "description",
            "project_type",
            "status",
            "color",
            "icon",
            "start_date",
            "target_end_date",
            "sort_order",
            "category_id",
            "created_at",
            "updated_at",
            "deleted_at",
            "origin_device_id",
        ],
        required_fk: &[],
        integer_columns: &["sort_order", "created_at", "updated_at", "deleted_at"],
    },
    SyncTableDef {
        name: "tasks",
        rank: 2,
        columns: &[
            "project_id",
            "parent_id",
            "milestone_id",
            "title",
            "description",
            "status",
            "priority",
            "due_date",
            "tags",
            "sort_order",
            "is_milestone",
            "start_date",
            "behavior_design_enabled",
            "celebration_on_complete",
            "created_at",
            "updated_at",
            "deleted_at",
            "origin_device_id",
        ],
        required_fk: &["project_id"],
        integer_columns: &[
            "priority",
            "sort_order",
            "is_milestone",
            "behavior_design_enabled",
            "celebration_on_complete",
            "created_at",
            "updated_at",
            "deleted_at",
        ],
    },
    SyncTableDef {
        name: "habit_rules",
        rank: 3,
        columns: &[
            "project_id",
            "title",
            "sort_order",
            "frequency",
            "days_of_week",
            "day_of_month",
            "month_and_day",
            "days_of_month",
            "yearly_dates",
            "why",
            "celebration_messages",
            "target_duration_seconds",
            "minimum_duration_seconds",
            "ability_tips",
            "anchor_time",
            "anchor_habit",
            "behavior_design_enabled",
            "celebration_on_complete",
            "created_at",
            "updated_at",
            "deleted_at",
            "origin_device_id",
        ],
        required_fk: &["project_id"],
        integer_columns: &[
            "sort_order",
            "day_of_month",
            "target_duration_seconds",
            "minimum_duration_seconds",
            "behavior_design_enabled",
            "celebration_on_complete",
            "created_at",
            "updated_at",
            "deleted_at",
        ],
    },
    SyncTableDef {
        name: "milestones",
        rank: 4,
        columns: &[
            "project_id",
            "title",
            "description",
            "target_date",
            "status",
            "sort_order",
            "completed_at",
            "created_at",
            "updated_at",
            "deleted_at",
            "origin_device_id",
        ],
        required_fk: &["project_id"],
        integer_columns: &[
            "sort_order",
            "completed_at",
            "created_at",
            "updated_at",
            "deleted_at",
        ],
    },
    SyncTableDef {
        name: "habit_occurrences",
        rank: 5,
        columns: &[
            "project_id",
            "rule_id",
            "scheduled_date",
            "status",
            "rescheduled_from",
            "completed_at",
            "note",
            "created_at",
            "updated_at",
            "deleted_at",
            "origin_device_id",
        ],
        required_fk: &["project_id", "rule_id", "scheduled_date"],
        integer_columns: &["completed_at", "created_at", "updated_at", "deleted_at"],
    },
    SyncTableDef {
        name: "milestone_links",
        rank: 6,
        columns: &[
            "milestone_id",
            "link_type",
            "link_id",
            "created_at",
            "updated_at",
            "deleted_at",
            "origin_device_id",
        ],
        required_fk: &["milestone_id", "link_type", "link_id"],
        integer_columns: &["created_at", "updated_at", "deleted_at"],
    },
    SyncTableDef {
        name: "time_entries",
        rank: 7,
        columns: &[
            "project_id",
            "target_type",
            "target_id",
            "start_at",
            "end_at",
            "duration_seconds",
            "note",
            "source",
            "created_at",
            "updated_at",
            "deleted_at",
            "origin_device_id",
        ],
        required_fk: &["project_id", "target_type", "target_id", "start_at"],
        integer_columns: &[
            "start_at",
            "end_at",
            "duration_seconds",
            "created_at",
            "updated_at",
            "deleted_at",
        ],
    },
];

pub fn table_def(name: &str) -> Option<&'static SyncTableDef> {
    SYNC_TABLES.iter().find(|t| t.name == name)
}

pub fn table_rank(name: &str) -> u8 {
    table_def(name).map(|t| t.rank).unwrap_or(99)
}

pub fn is_syncable_table(name: &str) -> bool {
    table_def(name).is_some()
}

pub fn syncable_table_names() -> impl Iterator<Item = &'static str> {
    SYNC_TABLES.iter().map(|t| t.name)
}

/// skeleton INSERT 用：从 batch 列 map 取值，缺省走 registry 默认值。
pub fn skeleton_param(
    def: &SyncTableDef,
    cols: &std::collections::HashMap<String, Option<String>>,
    column: &str,
    updated_at: i64,
    device_id: &str,
) -> Option<String> {
    if column == "created_at" || column == "updated_at" {
        return Some(updated_at.to_string());
    }
    if column == "origin_device_id" {
        return Some(device_id.to_string());
    }
    if let Some(v) = cols.get(column).and_then(|v| v.as_ref()) {
        if !v.is_empty() {
            return Some(v.clone());
        }
    }
    def.default_value(column).map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_sync_table_has_columns() {
        for def in SYNC_TABLES {
            assert!(!def.columns.is_empty(), "{}", def.name);
            assert!(def.columns.contains(&"created_at"), "{}", def.name);
            assert!(def.columns.contains(&"updated_at"), "{}", def.name);
            assert!(def.columns.contains(&"origin_device_id"), "{}", def.name);
        }
    }
}
