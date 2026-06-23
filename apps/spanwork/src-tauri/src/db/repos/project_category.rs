//! project_categories 表 CRUD 与排序，列表附带关联项目计数。
//! 删除分类时解除 projects.category_id，名称唯一性校验在 error 模块。

use rusqlite::{Connection, OptionalExtension};

use crate::dto::{
    CreateProjectCategoryInput, ProjectCategoryDto, ProjectCategoryReorderParams,
    UpdateProjectCategoryInput,
};
use crate::error::{new_id, now_ms, validate_category_name, AppError, AppResult};

pub fn list(conn: &Connection) -> AppResult<Vec<ProjectCategoryDto>> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.name, c.color, c.icon, c.sort_order, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM projects p
                 WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS project_count
         FROM project_categories c
         WHERE c.deleted_at IS NULL
         ORDER BY c.sort_order ASC, c.name COLLATE NOCASE ASC",
    )?;

    let rows = stmt.query_map([], map_category_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<ProjectCategoryDto> {
    conn.query_row(
        "SELECT c.id, c.name, c.color, c.icon, c.sort_order, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM projects p
                 WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS project_count
         FROM project_categories c
         WHERE c.id = ?1 AND c.deleted_at IS NULL",
        [id],
        map_category_row,
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound {
        entity: "project_category",
        id: id.to_string(),
    })
}

pub fn create(conn: &Connection, input: &CreateProjectCategoryInput) -> AppResult<ProjectCategoryDto> {
    validate_category_name(&input.name)?;
    ensure_unique_name(conn, &input.name, None)?;

    let origin = crate::db::repos::device::origin_device_id(conn)?;
    let id = new_id();
    let now = now_ms();

    let sort_order: i64 = input.sort_order.unwrap_or_else(|| {
        conn.query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM project_categories WHERE deleted_at IS NULL",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0)
    });

    conn.execute(
        "INSERT INTO project_categories (
            id, name, color, icon, sort_order, created_at, updated_at, origin_device_id
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)",
        rusqlite::params![
            id,
            input.name.trim(),
            input.color,
            input.icon,
            sort_order,
            now,
            origin,
        ],
    )?;

    get_by_id(conn, &id)
}

pub fn update(
    conn: &Connection,
    id: &str,
    patch: &UpdateProjectCategoryInput,
) -> AppResult<ProjectCategoryDto> {
    let existing = get_by_id(conn, id)?;

    if let Some(name) = &patch.name {
        validate_category_name(name)?;
        ensure_unique_name(conn, name, Some(id))?;
    }

    let now = now_ms();
    let name = patch.name.as_deref().unwrap_or(&existing.name);
    let color = patch.color.as_ref().or(existing.color.as_ref());
    let icon = patch.icon.as_ref().or(existing.icon.as_ref());
    let sort_order = patch.sort_order.unwrap_or(existing.sort_order);

    conn.execute(
        "UPDATE project_categories SET
            name = ?1, color = ?2, icon = ?3, sort_order = ?4, updated_at = ?5
         WHERE id = ?6 AND deleted_at IS NULL",
        rusqlite::params![name.trim(), color, icon, sort_order, now, id],
    )?;

    get_by_id(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
    get_by_id(conn, id)?;
    let now = now_ms();

    conn.execute(
        "UPDATE projects SET category_id = NULL, updated_at = ?1
         WHERE category_id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, id],
    )?;

    let updated = conn.execute(
        "UPDATE project_categories SET deleted_at = ?1, updated_at = ?1
         WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, id],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound {
            entity: "project_category",
            id: id.to_string(),
        });
    }

    Ok(())
}

pub fn reorder(conn: &Connection, params: &ProjectCategoryReorderParams) -> AppResult<()> {
    let now = now_ms();

    for (index, id) in params.ordered_ids.iter().enumerate() {
        let updated = conn.execute(
            "UPDATE project_categories SET sort_order = ?1, updated_at = ?2
             WHERE id = ?3 AND deleted_at IS NULL",
            rusqlite::params![index as i64, now, id],
        )?;
        if updated == 0 {
            return Err(AppError::NotFound {
                entity: "project_category",
                id: id.clone(),
            });
        }
    }

    Ok(())
}

fn ensure_unique_name(conn: &Connection, name: &str, exclude_id: Option<&str>) -> AppResult<()> {
    let trimmed = name.trim();
    let exists: Option<String> = if let Some(id) = exclude_id {
        conn.query_row(
            "SELECT id FROM project_categories
             WHERE name = ?1 AND deleted_at IS NULL AND id != ?2",
            rusqlite::params![trimmed, id],
            |row| row.get(0),
        )
        .optional()?
    } else {
        conn.query_row(
            "SELECT id FROM project_categories WHERE name = ?1 AND deleted_at IS NULL",
            [trimmed],
            |row| row.get(0),
        )
        .optional()?
    };

    if exists.is_some() {
        return Err(AppError::CategoryNameExists {
            name: trimmed.to_string(),
        });
    }

    Ok(())
}

fn map_category_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectCategoryDto> {
    Ok(ProjectCategoryDto {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        icon: row.get(3)?,
        sort_order: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        project_count: Some(row.get(7)?),
    })
}
