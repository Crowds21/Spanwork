//! 里程碑 CRUD 与关联设置 IPC（link_set 绑定任务/习惯）。
//! 委托 db/repos/milestone 操作 milestones 与 milestone_links 表。

use tauri::State;

use crate::db::repos::milestone as milestone_repo;
use crate::dto::{
    CreateMilestoneInput, MilestoneDto, MilestoneLinkSetParams, MilestoneListParams,
    MilestoneUpdateParams,
};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub fn milestone_list(
    state: State<'_, AppState>,
    params: MilestoneListParams,
) -> AppResult<Vec<MilestoneDto>> {
    state.with_db("milestone_list", |conn| milestone_repo::list(conn, &params.project_id))
}

#[tauri::command]
pub fn milestone_create(
    state: State<'_, AppState>,
    input: CreateMilestoneInput,
) -> AppResult<MilestoneDto> {
    state.with_db("milestone_create", |conn| milestone_repo::create(conn, &input))
}

#[tauri::command]
pub fn milestone_update(
    state: State<'_, AppState>,
    params: MilestoneUpdateParams,
) -> AppResult<MilestoneDto> {
    state.with_db("milestone_update", |conn| milestone_repo::update(conn, &params))
}

#[tauri::command]
pub fn milestone_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.with_db("milestone_delete", |conn| milestone_repo::delete(conn, &id))
}

#[tauri::command]
pub fn milestone_link_set(
    state: State<'_, AppState>,
    params: MilestoneLinkSetParams,
) -> AppResult<()> {
    state.with_db("milestone_link_set", |conn| milestone_repo::link_set(conn, &params))
}
