use rusqlite::{Connection, OptionalExtension};

use crate::dto::{
    CreateProjectInput, ProjectDetailDto, ProjectDto, ProjectListParams, ProjectType, ProjectStatus,
    UpdateProjectInput,
};
use crate::error::{new_id, now_ms, validate_project_name, AppError, AppResult};

pub fn list(conn: &Connection, params: &ProjectListParams) -> AppResult<Vec<ProjectDto>> {
    let status = params.status.as_deref().unwrap_or("active");
    let sort_by = params.sort_by.as_deref().unwrap_or("updated");
    let sort_order = params.sort_order.as_deref().unwrap_or("desc");

    let order_col = match sort_by {
        "created" => "created_at",
        "name" => "name COLLATE NOCASE",
        _ => "updated_at",
    };
    let order_dir = if sort_order == "asc" { "ASC" } else { "DESC" };

    let sql = if status == "all" {
        format!(
            "SELECT id, name, description, project_type, status, color, icon,
                    start_date, target_end_date, sort_order, created_at, updated_at
             FROM projects
             WHERE deleted_at IS NULL
             ORDER BY {order_col} {order_dir}"
        )
    } else {
        format!(
            "SELECT id, name, description, project_type, status, color, icon,
                    start_date, target_end_date, sort_order, created_at, updated_at
             FROM projects
             WHERE deleted_at IS NULL AND status = ?1
             ORDER BY {order_col} {order_dir}"
        )
    };

    let mut stmt = conn.prepare(&sql)?;
    let map_row = |row: &rusqlite::Row<'_>| map_project_row(row);

    let rows = if status == "all" {
        stmt.query_map([], map_row)?
    } else {
        stmt.query_map([status], map_row)?
    };

    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<ProjectDto> {
    conn.query_row(
        "SELECT id, name, description, project_type, status, color, icon,
                start_date, target_end_date, sort_order, created_at, updated_at
         FROM projects
         WHERE id = ?1 AND deleted_at IS NULL",
        [id],
        map_project_row,
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound {
        entity: "project",
        id: id.to_string(),
    })
}

pub fn get_detail(conn: &Connection, id: &str) -> AppResult<ProjectDetailDto> {
    let project = get_by_id(conn, id)?;
    let task_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE project_id = ?1 AND deleted_at IS NULL",
        [id],
        |row| row.get(0),
    )?;
    let total_time_seconds: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries
         WHERE project_id = ?1 AND deleted_at IS NULL",
        [id],
        |row| row.get(0),
    )?;
    let open_milestone_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks
         WHERE project_id = ?1 AND deleted_at IS NULL
           AND is_milestone = 1 AND status != 'done'",
        [id],
        |row| row.get(0),
    )?;

    Ok(ProjectDetailDto {
        project,
        task_count: Some(task_count),
        total_time_seconds: Some(total_time_seconds),
        open_milestone_count: Some(open_milestone_count),
    })
}

pub fn create(conn: &Connection, input: &CreateProjectInput) -> AppResult<ProjectDto> {
    validate_project_name(&input.name)?;

    let origin = crate::db::repos::device::origin_device_id(conn)?;
    let id = new_id();
    let now = now_ms();

    let project_type = match input.project_type {
        ProjectType::Task => "task",
        ProjectType::Habit => "habit",
    };

    let sort_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM projects WHERE deleted_at IS NULL",
        [],
        |row| row.get(0),
    )?;

    conn.execute(
        "INSERT INTO projects (
            id, name, description, project_type, status, color, icon,
            start_date, target_end_date, sort_order,
            created_at, updated_at, origin_device_id
         ) VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?11)",
        rusqlite::params![
            id,
            input.name.trim(),
            input.description,
            project_type,
            input.color,
            input.icon,
            input.start_date,
            input.target_end_date,
            sort_order,
            now,
            origin,
        ],
    )?;

    get_by_id(conn, &id)
}

pub fn update(conn: &Connection, id: &str, patch: &UpdateProjectInput) -> AppResult<ProjectDetailDto> {
    let existing = get_by_id(conn, id)?;

    if let Some(name) = &patch.name {
        validate_project_name(name)?;
    }

    let now = now_ms();
    let name = patch.name.as_deref().unwrap_or(&existing.name);
    let description = patch.description.as_ref().or(existing.description.as_ref());
    let status = patch.status.unwrap_or(existing.status);
    let color = patch.color.as_ref().or(existing.color.as_ref());
    let icon = patch.icon.as_ref().or(existing.icon.as_ref());
    let start_date = patch.start_date.as_ref().or(existing.start_date.as_ref());
    let target_end_date = patch
        .target_end_date
        .as_ref()
        .or(existing.target_end_date.as_ref());
    let sort_order = patch.sort_order.unwrap_or(existing.sort_order);

    conn.execute(
        "UPDATE projects SET
            name = ?1, description = ?2, status = ?3, color = ?4, icon = ?5,
            start_date = ?6, target_end_date = ?7, sort_order = ?8, updated_at = ?9
         WHERE id = ?10 AND deleted_at IS NULL",
        rusqlite::params![
            name.trim(),
            description,
            project_status_to_str(status),
            color,
            icon,
            start_date,
            target_end_date,
            sort_order,
            now,
            id,
        ],
    )?;

    get_detail(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
    let now = now_ms();
    let updated = conn.execute(
        "UPDATE projects SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, id],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound {
            entity: "project",
            id: id.to_string(),
        });
    }

    Ok(())
}

pub fn reorder(conn: &Connection, ordered_ids: &[String]) -> AppResult<()> {
    let now = now_ms();

    for (index, id) in ordered_ids.iter().enumerate() {
        let updated = conn.execute(
            "UPDATE projects SET sort_order = ?1, updated_at = ?2
             WHERE id = ?3 AND deleted_at IS NULL",
            rusqlite::params![index as i64, now, id],
        )?;
        if updated == 0 {
            return Err(AppError::NotFound {
                entity: "project",
                id: id.clone(),
            });
        }
    }

    Ok(())
}

fn map_project_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectDto> {
    let project_type_str: String = row.get(3)?;
    let status_str: String = row.get(4)?;

    Ok(ProjectDto {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        project_type: parse_project_type(&project_type_str),
        status: parse_project_status(&status_str),
        color: row.get(5)?,
        icon: row.get(6)?,
        start_date: row.get(7)?,
        target_end_date: row.get(8)?,
        sort_order: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn parse_project_type(value: &str) -> ProjectType {
    match value {
        "habit" => ProjectType::Habit,
        _ => ProjectType::Task,
    }
}

fn parse_project_status(value: &str) -> ProjectStatus {
    match value {
        "archived" => ProjectStatus::Archived,
        "completed" => ProjectStatus::Completed,
        _ => ProjectStatus::Active,
    }
}

fn project_status_to_str(status: ProjectStatus) -> &'static str {
    match status {
        ProjectStatus::Active => "active",
        ProjectStatus::Archived => "archived",
        ProjectStatus::Completed => "completed",
    }
}
