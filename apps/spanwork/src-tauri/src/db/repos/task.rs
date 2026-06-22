use rusqlite::{Connection, OptionalExtension};

use crate::domain::task_tree::{
    cascade_soft_delete, child_completion_stats, get_depth, is_descendant, validate_new_depth,
};
use crate::dto::{
    CreateTaskInput, TaskBatchCompleteParams, TaskBatchStatus, TaskDto, TaskListParams, TaskStatus,
    TaskUpdateParams, UpdateTaskInput,
};
use crate::error::{new_id, now_ms, validate_task_title, AppError, AppResult};

use super::{milestone as milestone_repo, project as project_repo, time_entry as time_entry_repo};

pub fn list(conn: &Connection, params: &TaskListParams) -> AppResult<Vec<TaskDto>> {
    project_repo::get_by_id(conn, &params.project_id)?;

    let mut sql = String::from(
        "SELECT id, project_id, parent_id, milestone_id, is_milestone, title, description, status, priority,
                due_date, tags, sort_order, created_at, updated_at
         FROM tasks
         WHERE project_id = ?1 AND deleted_at IS NULL",
    );
    let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(params.project_id.clone())];

    if let Some(milestone_id) = &params.milestone_id {
        sql.push_str(" AND milestone_id = ?");
        bind_values.push(Box::new(milestone_id.clone()));
    }

    if !params.include_subtasks {
        match &params.parent_id {
            None => sql.push_str(" AND parent_id IS NULL"),
            Some(None) => sql.push_str(" AND parent_id IS NULL"),
            Some(Some(parent_id)) => {
                sql.push_str(" AND parent_id = ?");
                bind_values.push(Box::new(parent_id.clone()));
            }
        }
    }

    sql.push_str(" ORDER BY sort_order ASC, created_at ASC");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(bind_values.iter()), map_task_row)?;
    let mut tasks: Vec<TaskDto> = rows.collect::<Result<Vec<_>, _>>()?;

    if params.include_subtasks {
        tasks = flatten_subtasks(conn, &params.project_id, params.milestone_id.as_deref())?;
    }

    for task in &mut tasks {
        enrich_task(conn, task)?;
    }

    Ok(tasks)
}

fn flatten_subtasks(
    conn: &Connection,
    project_id: &str,
    milestone_id: Option<&str>,
) -> AppResult<Vec<TaskDto>> {
    let mut sql = String::from(
        "SELECT id, project_id, parent_id, milestone_id, is_milestone, title, description, status, priority,
                due_date, tags, sort_order, created_at, updated_at
         FROM tasks
         WHERE project_id = ?1 AND deleted_at IS NULL",
    );
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(project_id.to_string())];

    if let Some(mid) = milestone_id {
        sql.push_str(" AND milestone_id = ?");
        params.push(Box::new(mid.to_string()));
    }

    sql.push_str(" ORDER BY sort_order ASC, created_at ASC");

    let mut stmt = conn.prepare(&sql)?;
    let all_tasks: Vec<TaskDto> = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), map_task_row)?
        .collect::<Result<Vec<_>, _>>()?;

    let mut by_parent: std::collections::HashMap<Option<String>, Vec<TaskDto>> =
        std::collections::HashMap::new();
    for task in all_tasks {
        by_parent.entry(task.parent_id.clone()).or_default().push(task);
    }

    let mut result = Vec::new();
    append_children(&mut result, &by_parent, None, 0);
    Ok(result)
}

fn append_children(
    result: &mut Vec<TaskDto>,
    by_parent: &std::collections::HashMap<Option<String>, Vec<TaskDto>>,
    parent_id: Option<String>,
    depth: i32,
) {
    if let Some(children) = by_parent.get(&parent_id) {
        for mut child in children.clone() {
            child.depth = Some(depth);
            result.push(child.clone());
            append_children(result, by_parent, Some(child.id), depth + 1);
        }
    }
}

pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<TaskDto> {
    let mut task = conn
        .query_row(
            "SELECT id, project_id, parent_id, milestone_id, is_milestone, title, description, status, priority,
                    due_date, tags, sort_order, created_at, updated_at
             FROM tasks
             WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            map_task_row,
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound {
            entity: "task",
            id: id.to_string(),
        })?;

    enrich_task(conn, &mut task)?;
    Ok(task)
}

pub fn create(conn: &Connection, input: &CreateTaskInput) -> AppResult<TaskDto> {
    validate_task_title(&input.title)?;
    project_repo::get_by_id(conn, &input.project_id)?;

    if let Some(parent_id) = &input.parent_id {
        let parent = get_by_id(conn, parent_id)?;
        if parent.project_id != input.project_id {
            return Err(AppError::Validation {
                field: "parentId".into(),
                reason: "parent must belong to the same project".into(),
            });
        }
        if !parent.is_milestone {
            return Err(AppError::Validation {
                field: "parentId".into(),
                reason: "only milestone tasks can have subtasks".into(),
            });
        }
        if input.is_milestone {
            return Err(AppError::Validation {
                field: "isMilestone".into(),
                reason: "subtasks cannot be marked as milestone".into(),
            });
        }
    }

    validate_new_depth(conn, input.parent_id.as_deref())?;

    if let Some(milestone_id) = &input.milestone_id {
        milestone_repo::get_by_id(conn, milestone_id)?;
    }

    let origin = crate::db::repos::device::origin_device_id(conn)?;
    let id = new_id();
    let now = now_ms();
    let priority = input.priority.unwrap_or(0).clamp(0, 3);
    let tags_json = tags_to_json(input.tags.as_deref().unwrap_or(&[]));

    let sort_order = match input.sort_order {
        Some(v) => v,
        None => {
            let parent_param = input.parent_id.as_deref();
            next_sort_order(conn, &input.project_id, parent_param)?
        }
    };

    conn.execute(
        "INSERT INTO tasks (
            id, project_id, parent_id, milestone_id, is_milestone, title, description, status, priority,
            due_date, tags, sort_order, created_at, updated_at, origin_device_id
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'todo', ?8, ?9, ?10, ?11, ?12, ?12, ?13)",
        rusqlite::params![
            id,
            input.project_id,
            input.parent_id,
            input.milestone_id,
            i64::from(input.is_milestone),
            input.title.trim(),
            input.description,
            priority,
            input.due_date,
            tags_json,
            sort_order,
            now,
            origin,
        ],
    )?;

    get_by_id(conn, &id)
}

pub fn update(conn: &Connection, params: &TaskUpdateParams) -> AppResult<TaskDto> {
    let existing = get_by_id(conn, &params.id)?;
    apply_update(conn, &existing, &params.patch)?;
    get_by_id(conn, &params.id)
}

fn apply_update(conn: &Connection, existing: &TaskDto, patch: &UpdateTaskInput) -> AppResult<()> {
    if let Some(title) = &patch.title {
        validate_task_title(title)?;
    }

    if let Some(parent_id) = &patch.parent_id {
        if parent_id == &existing.id {
            return Err(AppError::Validation {
                field: "parentId".into(),
                reason: "task cannot be its own parent".into(),
            });
        }
        if is_descendant(conn, &existing.id, parent_id)? {
            return Err(AppError::Validation {
                field: "parentId".into(),
                reason: "cannot set parent to a descendant".into(),
            });
        }
        let parent = get_by_id(conn, parent_id)?;
        if parent.project_id != existing.project_id {
            return Err(AppError::Validation {
                field: "parentId".into(),
                reason: "parent must belong to the same project".into(),
            });
        }
        validate_new_depth(conn, Some(parent_id))?;
    }

    if let Some(Some(milestone_id)) = &patch.milestone_id {
        milestone_repo::get_by_id(conn, milestone_id)?;
    }

    if let Some(is_milestone) = patch.is_milestone {
        if is_milestone && existing.parent_id.is_some() {
            return Err(AppError::Validation {
                field: "isMilestone".into(),
                reason: "subtasks cannot be marked as milestone".into(),
            });
        }
        if !is_milestone && existing.is_milestone {
            let (child_count, _) = child_completion_stats(conn, &existing.id)?;
            if child_count > 0 {
                return Err(AppError::Validation {
                    field: "isMilestone".into(),
                    reason: "milestone tasks with subtasks cannot be changed to regular tasks".into(),
                });
            }
        }
    }

    let now = now_ms();
    let title = patch.title.as_deref().unwrap_or(&existing.title);
    let description = patch.description.as_ref().or(existing.description.as_ref());
    let status = patch.status.unwrap_or(existing.status);
    let priority = patch.priority.unwrap_or(existing.priority).clamp(0, 3);
    let due_date = patch.due_date.as_ref().or(existing.due_date.as_ref());
    let tags = match &patch.tags {
        Some(t) => tags_to_json(t),
        None => tags_to_json(&existing.tags),
    };
    let parent_id = patch.parent_id.as_ref().or(existing.parent_id.as_ref());
    let milestone_id = match &patch.milestone_id {
        Some(v) => v.clone(),
        None => existing.milestone_id.clone(),
    };
    let sort_order = patch.sort_order.unwrap_or(existing.sort_order);
    let is_milestone = if existing.parent_id.is_some() {
        false
    } else {
        patch.is_milestone.unwrap_or(existing.is_milestone)
    };

    conn.execute(
        "UPDATE tasks SET
            title = ?1, description = ?2, status = ?3, priority = ?4, due_date = ?5,
            tags = ?6, parent_id = ?7, milestone_id = ?8, sort_order = ?9, is_milestone = ?10,
            updated_at = ?11
         WHERE id = ?12 AND deleted_at IS NULL",
        rusqlite::params![
            title.trim(),
            description,
            task_status_to_str(status),
            priority,
            due_date,
            tags,
            parent_id,
            milestone_id,
            sort_order,
            i64::from(is_milestone),
            now,
            existing.id,
        ],
    )?;

    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
    cascade_soft_delete(conn, id)
}

pub fn reorder(
    conn: &Connection,
    project_id: &str,
    parent_id: Option<&str>,
    ordered_ids: &[String],
) -> AppResult<()> {
    project_repo::get_by_id(conn, project_id)?;
    let now = now_ms();

    for (index, id) in ordered_ids.iter().enumerate() {
        let updated = conn.execute(
            "UPDATE tasks SET sort_order = ?1, updated_at = ?2
             WHERE id = ?3 AND project_id = ?4 AND deleted_at IS NULL
               AND ((?5 IS NULL AND parent_id IS NULL) OR parent_id = ?5)",
            rusqlite::params![index as i64, now, id, project_id, parent_id],
        )?;
        if updated == 0 {
            return Err(AppError::NotFound {
                entity: "task",
                id: id.clone(),
            });
        }
    }

    Ok(())
}

pub fn batch_complete(conn: &Connection, params: &TaskBatchCompleteParams) -> AppResult<i64> {
    if params.ids.is_empty() {
        return Ok(0);
    }

    let status = match params.status {
        TaskBatchStatus::Done => "done",
        TaskBatchStatus::Todo => "todo",
    };
    let now = now_ms();
    let mut updated = 0i64;

    for id in &params.ids {
        let count = conn.execute(
            "UPDATE tasks SET status = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL",
            rusqlite::params![status, now, id],
        )?;
        updated += count as i64;
    }

    Ok(updated)
}

pub fn recent_tasks(conn: &Connection, limit: i64) -> AppResult<Vec<TaskDto>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, parent_id, milestone_id, is_milestone, title, description, status, priority,
                due_date, tags, sort_order, created_at, updated_at
         FROM tasks
         WHERE deleted_at IS NULL
         ORDER BY updated_at DESC
         LIMIT ?1",
    )?;
    let mut tasks: Vec<TaskDto> = stmt
        .query_map([limit], map_task_row)?
        .collect::<Result<Vec<_>, _>>()?;

    for task in &mut tasks {
        enrich_task(conn, task)?;
    }

    Ok(tasks)
}

fn enrich_task(conn: &Connection, task: &mut TaskDto) -> AppResult<()> {
    task.depth = Some(get_depth(conn, &task.id)?);
    if task.parent_id.is_some() {
        task.is_milestone = false;
    }
    let (child_count, completed_child_count) = child_completion_stats(conn, &task.id)?;
    task.child_count = Some(child_count);
    task.completed_child_count = Some(completed_child_count);
    task.total_time_seconds = Some(time_entry_repo::sum_for_target(
        conn,
        crate::dto::TimeTargetType::Task,
        &task.id,
    )?);
    Ok(())
}

fn next_sort_order(conn: &Connection, project_id: &str, parent_id: Option<&str>) -> AppResult<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks
         WHERE project_id = ?1 AND deleted_at IS NULL
           AND ((?2 IS NULL AND parent_id IS NULL) OR parent_id = ?2)",
        rusqlite::params![project_id, parent_id],
        |row| row.get(0),
    )
    .map_err(Into::into)
}

fn map_task_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TaskDto> {
    let status_str: String = row.get(7)?;
    let tags_str: Option<String> = row.get(10)?;
    let is_milestone: i64 = row.get(4)?;

    Ok(TaskDto {
        id: row.get(0)?,
        project_id: row.get(1)?,
        parent_id: row.get(2)?,
        milestone_id: row.get(3)?,
        is_milestone: is_milestone != 0,
        title: row.get(5)?,
        description: row.get(6)?,
        status: parse_task_status(&status_str),
        priority: row.get(8)?,
        due_date: row.get(9)?,
        tags: parse_tags(tags_str),
        sort_order: row.get(11)?,
        depth: None,
        child_count: None,
        completed_child_count: None,
        total_time_seconds: None,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

pub fn parse_task_status(value: &str) -> TaskStatus {
    match value {
        "in_progress" => TaskStatus::InProgress,
        "done" => TaskStatus::Done,
        "cancelled" => TaskStatus::Cancelled,
        _ => TaskStatus::Todo,
    }
}

pub fn task_status_to_str(status: TaskStatus) -> &'static str {
    match status {
        TaskStatus::Todo => "todo",
        TaskStatus::InProgress => "in_progress",
        TaskStatus::Done => "done",
        TaskStatus::Cancelled => "cancelled",
    }
}

pub fn parse_tags(value: Option<String>) -> Vec<String> {
    value
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .unwrap_or_default()
}

pub fn tags_to_json(tags: &[String]) -> String {
    serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string())
}
