//! 项目分类 CRUD 与排序 IPC。
//! 委托 db/repos/project_category，删除分类时会解除关联项目的 category_id。

use tauri::State;

use crate::db::repos::project_category as category_repo;
use crate::dto::{
    CreateProjectCategoryInput, ProjectCategoryDto, ProjectCategoryReorderParams,
    ProjectCategoryUpdateParams,
};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub fn project_category_list(state: State<'_, AppState>) -> AppResult<Vec<ProjectCategoryDto>> {
    state.with_db("project_category_list", category_repo::list)
}

#[tauri::command]
pub fn project_category_create(
    state: State<'_, AppState>,
    input: CreateProjectCategoryInput,
) -> AppResult<ProjectCategoryDto> {
    state.with_db("project_category_create", |conn| category_repo::create(conn, &input))
}

#[tauri::command]
pub fn project_category_update(
    state: State<'_, AppState>,
    params: ProjectCategoryUpdateParams,
) -> AppResult<ProjectCategoryDto> {
    state.with_db("project_category_update", |conn| {
        category_repo::update(conn, &params.id, &params.patch)
    })
}

#[tauri::command]
pub fn project_category_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.with_db("project_category_delete", |conn| category_repo::delete(conn, &id))
}

#[tauri::command]
pub fn project_category_reorder(
    state: State<'_, AppState>,
    params: ProjectCategoryReorderParams,
) -> AppResult<()> {
    state.with_db("project_category_reorder", |conn| category_repo::reorder(conn, &params))
}
