//! projects 表 CRUD、列表筛选与详情聚合（任务数、总时长、未完成里程碑数）。
//! LEFT JOIN project_categories 返回分类信息，软删除通过 deleted_at 实现。

use rusqlite::{Connection, OptionalExtension};

use crate::dto::{CreateProjectInput, ProjectDetailDto, ProjectDto, ProjectListParams, ProjectType, ProjectStatus, UpdateProjectInput};
use crate::error::{new_id, now_ms, validate_project_name, AppError, AppResult};

const PROJECT_SELECT: &str = "SELECT p.id, p.name, p.description, p.project_type, p.status, p.color, p.icon,
        p.start_date, p.target_end_date, p.sort_order, p.category_id,
        c.name, c.color, p.created_at, p.updated_at
 FROM projects p
 LEFT JOIN project_categories c ON c.id = p.category_id AND c.deleted_at IS NULL";

pub fn list(conn: &Connection, params: &ProjectListParams) -> AppResult<Vec<ProjectDto>> {
    let status = params.status.as_deref().unwrap_or("active");
    let sort_by = params.sort_by.as_deref().unwrap_or("updated");
    let sort_order = params.sort_order.as_deref().unwrap_or("desc");

    let order_col = match sort_by {
        "created" => "p.created_at",
        "name" => "p.name COLLATE NOCASE",
        _ => "p.updated_at",
    };
    let order_dir = if sort_order == "asc" { "ASC" } else { "DESC" };

    let mut sql = format!(
        "{PROJECT_SELECT}
         WHERE p.deleted_at IS NULL"
    );
    let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if status != "all" {
        sql.push_str(" AND p.status = ?");
        bind_values.push(Box::new(status.to_string()));
    }

    if let Some(category_id) = &params.category_id {
        if category_id == "uncategorized" {
            sql.push_str(" AND p.category_id IS NULL");
        } else {
            sql.push_str(" AND p.category_id = ?");
            bind_values.push(Box::new(category_id.clone()));
        }
    }

    sql.push_str(&format!(" ORDER BY {order_col} {order_dir}"));

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(bind_values.iter()), map_project_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<ProjectDto> {
    conn.query_row(
        &format!("{PROJECT_SELECT} WHERE p.id = ?1 AND p.deleted_at IS NULL"),
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

    if let Some(category_id) = &input.category_id {
        crate::db::repos::project_category::get_by_id(conn, category_id)?;
    }

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
            start_date, target_end_date, sort_order, category_id,
            created_at, updated_at, origin_device_id
         ) VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, ?12)",
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
            input.category_id,
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

    if let Some(Some(category_id)) = &patch.category_id {
        crate::db::repos::project_category::get_by_id(conn, category_id)?;
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

    let category_id = match &patch.category_id {
        None => existing.category_id.clone(),
        Some(inner) => inner.clone(),
    };

    conn.execute(
        "UPDATE projects SET
            name = ?1, description = ?2, status = ?3, color = ?4, icon = ?5,
            start_date = ?6, target_end_date = ?7, sort_order = ?8, category_id = ?9,
            updated_at = ?10
         WHERE id = ?11 AND deleted_at IS NULL",
        rusqlite::params![
            name.trim(),
            description,
            project_status_to_str(status),
            color,
            icon,
            start_date,
            target_end_date,
            sort_order,
            category_id,
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
        category_id: row.get(10)?,
        category_name: row.get(11)?,
        category_color: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
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
