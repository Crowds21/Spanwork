//! milestones 表 CRUD 与 milestone_links 关联管理。
//! link_set 全量替换里程碑绑定的任务/习惯，列表返回 linked_count。

use rusqlite::{Connection, OptionalExtension};

use crate::dto::{
    CreateMilestoneInput, MilestoneDto, MilestoneLinkSetParams, MilestoneLinkType, MilestoneStatus,
    MilestoneUpdateParams, UpdateMilestoneInput,
};
use crate::error::{new_id, now_ms, validate_milestone_title, AppError, AppResult};

pub fn list(conn: &Connection, project_id: &str) -> AppResult<Vec<MilestoneDto>> {
    crate::db::repos::project::get_by_id(conn, project_id)?;

    let mut stmt = conn.prepare(
        "SELECT id, project_id, title, description, target_date, status, sort_order,
                completed_at, created_at, updated_at
         FROM milestones
         WHERE project_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order ASC, created_at ASC",
    )?;

    let rows = stmt.query_map([project_id], map_milestone_row)?;
    let mut milestones: Vec<MilestoneDto> = rows.collect::<Result<Vec<_>, _>>()?;

    for milestone in &mut milestones {
        milestone.linked_count = Some(linked_count(conn, &milestone.id)?);
    }

    Ok(milestones)
}

pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<MilestoneDto> {
    let mut milestone = conn
        .query_row(
            "SELECT id, project_id, title, description, target_date, status, sort_order,
                    completed_at, created_at, updated_at
             FROM milestones
             WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            map_milestone_row,
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound {
            entity: "milestone",
            id: id.to_string(),
        })?;

    milestone.linked_count = Some(linked_count(conn, id)?);
    Ok(milestone)
}

pub fn create(conn: &Connection, input: &CreateMilestoneInput) -> AppResult<MilestoneDto> {
    validate_milestone_title(&input.title)?;
    crate::db::repos::project::get_by_id(conn, &input.project_id)?;

    let origin = crate::db::repos::device::origin_device_id(conn)?;
    let id = new_id();
    let now = now_ms();
    let status = input.status.unwrap_or(MilestoneStatus::NotStarted);
    let sort_order = match input.sort_order {
        Some(v) => v,
        None => conn.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM milestones
             WHERE project_id = ?1 AND deleted_at IS NULL",
            [&input.project_id],
            |row| row.get(0),
        )?,
    };

    conn.execute(
        "INSERT INTO milestones (
            id, project_id, title, description, target_date, status, sort_order,
            created_at, updated_at, origin_device_id
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9)",
        rusqlite::params![
            id,
            input.project_id,
            input.title.trim(),
            input.description,
            input.target_date,
            milestone_status_to_str(status),
            sort_order,
            now,
            origin,
        ],
    )?;

    get_by_id(conn, &id)
}

pub fn update(conn: &Connection, params: &MilestoneUpdateParams) -> AppResult<MilestoneDto> {
    let existing = get_by_id(conn, &params.id)?;
    apply_update(conn, &existing, &params.patch)?;
    get_by_id(conn, &params.id)
}

fn apply_update(
    conn: &Connection,
    existing: &MilestoneDto,
    patch: &UpdateMilestoneInput,
) -> AppResult<()> {
    if let Some(title) = &patch.title {
        validate_milestone_title(title)?;
    }

    let now = now_ms();
    let title = patch.title.as_deref().unwrap_or(&existing.title);
    let description = patch.description.as_ref().or(existing.description.as_ref());
    let target_date = patch.target_date.as_ref().or(existing.target_date.as_ref());
    let status = patch.status.unwrap_or(existing.status);
    let sort_order = patch.sort_order.unwrap_or(existing.sort_order);
    let completed_at = patch.completed_at.or(existing.completed_at);

    conn.execute(
        "UPDATE milestones SET
            title = ?1, description = ?2, target_date = ?3, status = ?4,
            sort_order = ?5, completed_at = ?6, updated_at = ?7
         WHERE id = ?8 AND deleted_at IS NULL",
        rusqlite::params![
            title.trim(),
            description,
            target_date,
            milestone_status_to_str(status),
            sort_order,
            completed_at,
            now,
            existing.id,
        ],
    )?;

    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
    let now = now_ms();
    let updated = conn.execute(
        "UPDATE milestones SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, id],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound {
            entity: "milestone",
            id: id.to_string(),
        });
    }

    conn.execute(
        "UPDATE milestone_links SET deleted_at = ?1, updated_at = ?1
         WHERE milestone_id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, id],
    )?;

    Ok(())
}

pub fn link_set(conn: &Connection, params: &MilestoneLinkSetParams) -> AppResult<()> {
    get_by_id(conn, &params.milestone_id)?;
    let origin = crate::db::repos::device::origin_device_id(conn)?;
    let now = now_ms();

    conn.execute(
        "UPDATE milestone_links SET deleted_at = ?1, updated_at = ?1
         WHERE milestone_id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, params.milestone_id],
    )?;

    for link in &params.links {
        let id = new_id();
        let link_type = match link.link_type {
            MilestoneLinkType::Task => "task",
            MilestoneLinkType::HabitOccurrence => "habit_occurrence",
        };

        conn.execute(
            "INSERT INTO milestone_links (
                id, milestone_id, link_type, link_id, created_at, updated_at, origin_device_id
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6)",
            rusqlite::params![id, params.milestone_id, link_type, link.link_id, now, origin],
        )?;
    }

    Ok(())
}

fn linked_count(conn: &Connection, milestone_id: &str) -> AppResult<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM milestone_links
         WHERE milestone_id = ?1 AND deleted_at IS NULL",
        [milestone_id],
        |row| row.get(0),
    )
    .map_err(Into::into)
}

fn map_milestone_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<MilestoneDto> {
    let status_str: String = row.get(5)?;

    Ok(MilestoneDto {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        target_date: row.get(4)?,
        status: parse_milestone_status(&status_str),
        sort_order: row.get(6)?,
        completed_at: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        linked_count: None,
    })
}

pub fn parse_milestone_status(value: &str) -> MilestoneStatus {
    match value {
        "in_progress" => MilestoneStatus::InProgress,
        "done" => MilestoneStatus::Done,
        _ => MilestoneStatus::NotStarted,
    }
}

pub fn milestone_status_to_str(status: MilestoneStatus) -> &'static str {
    match status {
        MilestoneStatus::NotStarted => "not_started",
        MilestoneStatus::InProgress => "in_progress",
        MilestoneStatus::Done => "done",
    }
}
