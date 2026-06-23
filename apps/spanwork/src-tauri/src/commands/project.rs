//! 项目 CRUD 与排序 IPC，参数/返回值使用 dto 中的 Project 相关类型。
//! 业务逻辑委托 db/repos/project，经 AppState.with_db 访问数据库。

use tauri::State;

use crate::db::repos::project as project_repo;
use crate::dto::{
    CreateProjectInput, ProjectDetailDto, ProjectDto, ProjectListParams, ProjectReorderParams,
    ProjectUpdateParams,
};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub fn project_list(
    state: State<'_, AppState>,
    params: Option<ProjectListParams>,
) -> AppResult<Vec<ProjectDto>> {
    let params = params.unwrap_or_default();
    state.with_db("project_list", |conn| project_repo::list(conn, &params))
}

#[tauri::command]
pub fn project_get(state: State<'_, AppState>, id: String) -> AppResult<ProjectDetailDto> {
    state.with_db("project_get", |conn| project_repo::get_detail(conn, &id))
}

#[tauri::command]
pub fn project_create(
    state: State<'_, AppState>,
    input: CreateProjectInput,
) -> AppResult<ProjectDetailDto> {
    state.with_db("project_create", |conn| {
        let created = project_repo::create(conn, &input)?;
        project_repo::get_detail(conn, &created.id)
    })
}

#[tauri::command]
pub fn project_update(
    state: State<'_, AppState>,
    params: ProjectUpdateParams,
) -> AppResult<ProjectDetailDto> {
    state.with_db("project_update", |conn| {
        project_repo::update(conn, &params.id, &params.patch)
    })
}

#[tauri::command]
pub fn project_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.with_db("project_delete", |conn| project_repo::delete(conn, &id))
}

#[tauri::command]
pub fn project_reorder(
    state: State<'_, AppState>,
    params: ProjectReorderParams,
) -> AppResult<()> {
    state.with_db("project_reorder", |conn| {
        project_repo::reorder(conn, &params.ordered_ids)
    })
}
