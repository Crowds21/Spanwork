//! 任务记时与计时器启动资格判定（里程碑容器、已完成任务等边界规则）。
//! 空根里程碑可计时，有子任务的根里程碑仅作容器；Done 状态禁止启动计时器。

use rusqlite::{Connection, OptionalExtension};

use crate::dto::{TaskStatus, TimeTargetType};
use crate::error::{AppError, AppResult};

/// Root milestones with subtasks are containers only; empty root milestones are executable.
pub fn is_time_trackable(is_milestone: bool, parent_id: Option<&str>, child_count: i64) -> bool {
    !(is_milestone && parent_id.is_none() && child_count > 0)
}

pub fn is_timer_startable(
    is_milestone: bool,
    parent_id: Option<&str>,
    status: TaskStatus,
    child_count: i64,
) -> bool {
    is_time_trackable(is_milestone, parent_id, child_count) && status != TaskStatus::Done
}

fn count_direct_children(conn: &Connection, task_id: &str) -> AppResult<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE parent_id = ?1 AND deleted_at IS NULL",
        [task_id],
        |row| row.get(0),
    )
    .map_err(Into::into)
}

fn parse_task_status(value: &str) -> TaskStatus {
    match value {
        "in_progress" => TaskStatus::InProgress,
        "done" => TaskStatus::Done,
        "cancelled" => TaskStatus::Cancelled,
        _ => TaskStatus::Todo,
    }
}

fn load_task_time_row(
    conn: &Connection,
    task_id: &str,
) -> AppResult<(bool, Option<String>, TaskStatus)> {
    conn.query_row(
        "SELECT is_milestone, parent_id, status FROM tasks WHERE id = ?1 AND deleted_at IS NULL",
        [task_id],
        |row| {
            let status_str: String = row.get(2)?;
            Ok((
                row.get::<_, i64>(0)? != 0,
                row.get(1)?,
                parse_task_status(&status_str),
            ))
        },
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound {
        entity: "task",
        id: task_id.to_string(),
    })
}

pub fn validate_manual_time_entry_target(conn: &Connection, task_id: &str) -> AppResult<()> {
    let (is_milestone, parent_id, _) = load_task_time_row(conn, task_id)?;
    let child_count = count_direct_children(conn, task_id)?;

    if !is_time_trackable(is_milestone, parent_id.as_deref(), child_count) {
        return Err(AppError::TimeTargetNotTrackable {
            task_id: task_id.to_string(),
        });
    }

    Ok(())
}

pub fn validate_timer_start_target(conn: &Connection, task_id: &str) -> AppResult<()> {
    let (is_milestone, parent_id, status) = load_task_time_row(conn, task_id)?;
    let child_count = count_direct_children(conn, task_id)?;

    if !is_time_trackable(is_milestone, parent_id.as_deref(), child_count) {
        return Err(AppError::TimeTargetNotTrackable {
            task_id: task_id.to_string(),
        });
    }

    if !is_timer_startable(is_milestone, parent_id.as_deref(), status, child_count) {
        return Err(AppError::TimerTargetNotStartable {
            task_id: task_id.to_string(),
        });
    }

    Ok(())
}

pub fn validate_manual_time_target(
    conn: &Connection,
    target_type: TimeTargetType,
    target_id: &str,
) -> AppResult<()> {
    if target_type == TimeTargetType::Task {
        validate_manual_time_entry_target(conn, target_id)?;
    }
    Ok(())
}

pub fn validate_timer_start_time_target(
    conn: &Connection,
    target_type: TimeTargetType,
    target_id: &str,
) -> AppResult<()> {
    if target_type == TimeTargetType::Task {
        validate_timer_start_target(conn, target_id)?;
    }
    Ok(())
}

pub fn sum_child_time_seconds(conn: &Connection, parent_id: &str) -> AppResult<i64> {
    conn.query_row(
        "SELECT COALESCE(SUM(te.duration_seconds), 0)
         FROM tasks t
         INNER JOIN time_entries te
            ON te.target_id = t.id
           AND te.target_type = 'task'
           AND te.deleted_at IS NULL
         WHERE t.parent_id = ?1 AND t.deleted_at IS NULL",
        [parent_id],
        |row| row.get(0),
    )
    .map_err(Into::into)
}
