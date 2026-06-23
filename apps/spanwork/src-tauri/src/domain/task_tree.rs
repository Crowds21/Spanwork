//! 任务树深度校验（MAX_TASK_DEPTH = 1）与级联软删除。
//! 递归计算 depth、检测循环引用，create/update/delete 时由 task repo 调用。

use rusqlite::{Connection, OptionalExtension};

use crate::error::{AppError, AppResult, now_ms};

pub const MAX_TASK_DEPTH: i32 = 1;

pub fn get_depth(conn: &Connection, task_id: &str) -> AppResult<i32> {
    let parent_id: Option<String> = conn
        .query_row(
            "SELECT parent_id FROM tasks WHERE id = ?1 AND deleted_at IS NULL",
            [task_id],
            |row| row.get(0),
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound {
            entity: "task",
            id: task_id.to_string(),
        })?;

    match parent_id {
        None => Ok(0),
        Some(pid) => {
            let parent_depth = get_depth(conn, &pid)?;
            Ok(parent_depth + 1)
        }
    }
}

pub fn validate_new_depth(conn: &Connection, parent_id: Option<&str>) -> AppResult<i32> {
    let depth = match parent_id {
        None => 0,
        Some(pid) => {
            let parent_depth = get_depth(conn, pid)?;
            parent_depth + 1
        }
    };

    if depth > MAX_TASK_DEPTH {
        return Err(AppError::Validation {
            field: "parentId".into(),
            reason: format!("max nesting depth is {MAX_TASK_DEPTH}"),
        });
    }

    Ok(depth)
}

pub fn is_descendant(conn: &Connection, ancestor_id: &str, candidate_id: &str) -> AppResult<bool> {
    if ancestor_id == candidate_id {
        return Ok(true);
    }

    let mut current = candidate_id.to_string();
    loop {
        let parent_id: Option<String> = conn
            .query_row(
                "SELECT parent_id FROM tasks WHERE id = ?1 AND deleted_at IS NULL",
                [&current],
                |row| row.get(0),
            )
            .optional()?
            .ok_or_else(|| AppError::NotFound {
                entity: "task",
                id: candidate_id.to_string(),
            })?;

        match parent_id {
            None => return Ok(false),
            Some(pid) if pid == ancestor_id => return Ok(true),
            Some(pid) => current = pid,
        }
    }
}

pub fn cascade_soft_delete(conn: &Connection, task_id: &str) -> AppResult<()> {
    let now = now_ms();
    soft_delete_recursive(conn, task_id, now)?;
    Ok(())
}

fn soft_delete_recursive(conn: &Connection, task_id: &str, now: i64) -> AppResult<()> {
    let child_ids: Vec<String> = conn
        .prepare(
            "SELECT id FROM tasks WHERE parent_id = ?1 AND deleted_at IS NULL",
        )?
        .query_map([task_id], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    for child_id in child_ids {
        soft_delete_recursive(conn, &child_id, now)?;
    }

    let updated = conn.execute(
        "UPDATE tasks SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, task_id],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound {
            entity: "task",
            id: task_id.to_string(),
        });
    }

    Ok(())
}

pub fn child_completion_stats(conn: &Connection, task_id: &str) -> AppResult<(i64, i64)> {
    let child_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE parent_id = ?1 AND deleted_at IS NULL",
        [task_id],
        |row| row.get(0),
    )?;

    let completed_child_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE parent_id = ?1 AND deleted_at IS NULL AND status = 'done'",
        [task_id],
        |row| row.get(0),
    )?;

    Ok((child_count, completed_child_count))
}
