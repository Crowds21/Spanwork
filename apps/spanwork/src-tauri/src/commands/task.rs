//! 任务 CRUD、批量完成与排序 IPC。
//! 委托 db/repos/task，内含任务树深度校验与记时汇总等域规则。

use tauri::State;

use crate::db::repos::task as task_repo;
use crate::dto::{
    CreateTaskInput, TaskBatchCompleteParams, TaskBatchCompleteResult, TaskDto, TaskListParams,
    TaskReorderParams, TaskUpdateParams,
};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub fn task_list(
    state: State<'_, AppState>,
    params: TaskListParams,
) -> AppResult<Vec<TaskDto>> {
    state.with_db("task_list", |conn| task_repo::list(conn, &params))
}

#[tauri::command]
pub fn task_get(state: State<'_, AppState>, id: String) -> AppResult<TaskDto> {
    state.with_db("task_get", |conn| task_repo::get_by_id(conn, &id))
}

#[tauri::command]
pub fn task_create(state: State<'_, AppState>, input: CreateTaskInput) -> AppResult<TaskDto> {
    state.with_db("task_create", |conn| task_repo::create(conn, &input))
}

#[tauri::command]
pub fn task_update(state: State<'_, AppState>, params: TaskUpdateParams) -> AppResult<TaskDto> {
    state.with_db("task_update", |conn| task_repo::update(conn, &params))
}

#[tauri::command]
pub fn task_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.with_db("task_delete", |conn| task_repo::delete(conn, &id))
}

#[tauri::command]
pub fn task_reorder(state: State<'_, AppState>, params: TaskReorderParams) -> AppResult<()> {
    state.with_db("task_reorder", |conn| {
        task_repo::reorder(
            conn,
            &params.project_id,
            params.parent_id.as_deref(),
            &params.ordered_ids,
        )
    })
}

#[tauri::command]
pub fn task_batch_complete(
    state: State<'_, AppState>,
    params: TaskBatchCompleteParams,
) -> AppResult<TaskBatchCompleteResult> {
    state.with_db("task_batch_complete", |conn| {
        let updated = task_repo::batch_complete(conn, &params)?;
        Ok(TaskBatchCompleteResult { updated })
    })
}
