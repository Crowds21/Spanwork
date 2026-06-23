//! 项目生命周期：删除时级联软删子资源，并在删除前结束属于该项目的活跃计时器。

use rusqlite::Connection;

use crate::error::{AppError, AppResult, now_ms};

/// 软删项目及其全部子资源（单事务）。若该项目上有活跃计时器，先 stop 写入 time_entry 再一并软删。
pub fn cascade_soft_delete(conn: &Connection, project_id: &str) -> AppResult<()> {
    crate::db::repos::project::get_by_id(conn, project_id)?;

    let now = now_ms();
    let tx = conn.unchecked_transaction()?;

    crate::timer::stop_if_active_for_project(&tx, project_id)?;
    soft_delete_children(&tx, project_id, now)?;

    let updated = tx.execute(
        "UPDATE projects SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, project_id],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound {
            entity: "project",
            id: project_id.to_string(),
        });
    }

    tx.commit()?;
    Ok(())
}

fn soft_delete_children(conn: &Connection, project_id: &str, now: i64) -> AppResult<()> {
    conn.execute(
        "UPDATE milestone_links SET deleted_at = ?1, updated_at = ?1
         WHERE deleted_at IS NULL AND milestone_id IN (
           SELECT id FROM milestones WHERE project_id = ?2
         )",
        rusqlite::params![now, project_id],
    )?;

    conn.execute(
        "UPDATE milestones SET deleted_at = ?1, updated_at = ?1
         WHERE project_id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, project_id],
    )?;

    conn.execute(
        "UPDATE time_entries SET deleted_at = ?1, updated_at = ?1
         WHERE project_id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, project_id],
    )?;

    conn.execute(
        "UPDATE tasks SET deleted_at = ?1, updated_at = ?1
         WHERE project_id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, project_id],
    )?;

    conn.execute(
        "UPDATE habit_occurrences SET deleted_at = ?1, updated_at = ?1
         WHERE project_id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, project_id],
    )?;

    conn.execute(
        "UPDATE habit_rules SET deleted_at = ?1, updated_at = ?1
         WHERE project_id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, project_id],
    )?;

    Ok(())
}
