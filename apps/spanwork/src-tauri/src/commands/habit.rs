//! 习惯规则与实例 IPC。

use tauri::State;

use crate::db::repos::{habit_occurrence as occurrence_repo, habit_rule as rule_repo};
use crate::dto::{
    HabitOccurrenceDto, HabitOccurrenceEnsureParams, HabitOccurrenceListParams,
    HabitOccurrenceUpdateParams, HabitRuleCreateParams, HabitRuleDto, HabitRuleUpdateParams,
    HabitStreakDto,
};
use crate::error::AppResult;
use crate::state::AppState;

fn ensure_occurrences_after_rule_change(conn: &rusqlite::Connection) -> AppResult<()> {
    let today = crate::domain::habit_schedule::format_date(crate::domain::habit_schedule::today_local_date());
    let to = {
        let d = crate::domain::habit_schedule::today_local_date() + chrono::Duration::days(90);
        crate::domain::habit_schedule::format_date(d)
    };
    occurrence_repo::ensure_range(conn, &today, &to)?;
    Ok(())
}

#[tauri::command]
pub fn habit_rule_list(state: State<'_, AppState>, project_id: String) -> AppResult<Vec<HabitRuleDto>> {
    state.with_db("habit_rule_list", |conn| rule_repo::list_by_project_id(conn, &project_id))
}

#[tauri::command]
pub fn habit_rule_get(state: State<'_, AppState>, rule_id: String) -> AppResult<HabitRuleDto> {
    state.with_db("habit_rule_get", |conn| rule_repo::get_by_id(conn, &rule_id))
}

#[tauri::command]
pub fn habit_rule_create(
    state: State<'_, AppState>,
    params: HabitRuleCreateParams,
) -> AppResult<HabitRuleDto> {
    state.with_db("habit_rule_create", |conn| {
        let project = crate::db::repos::project::get_by_id(conn, &params.project_id)?;
        let rule = rule_repo::create(conn, &params.project_id, Some(&params.input), &project.name)?;
        ensure_occurrences_after_rule_change(conn)?;
        Ok(rule)
    })
}

#[tauri::command]
pub fn habit_rule_update(
    state: State<'_, AppState>,
    params: HabitRuleUpdateParams,
) -> AppResult<HabitRuleDto> {
    state.with_db("habit_rule_update", |conn| {
        let rule = rule_repo::update(conn, &params.rule_id, &params.patch)?;
        ensure_occurrences_after_rule_change(conn)?;
        Ok(rule)
    })
}

#[tauri::command]
pub fn habit_rule_delete(state: State<'_, AppState>, rule_id: String) -> AppResult<()> {
    state.with_db("habit_rule_delete", |conn| rule_repo::delete(conn, &rule_id))
}

#[tauri::command]
pub fn habit_occurrence_list(
    state: State<'_, AppState>,
    params: HabitOccurrenceListParams,
) -> AppResult<Vec<HabitOccurrenceDto>> {
    state.with_db("habit_occurrence_list", |conn| occurrence_repo::list(conn, &params))
}

#[tauri::command]
pub fn habit_occurrence_ensure(
    state: State<'_, AppState>,
    params: HabitOccurrenceEnsureParams,
) -> AppResult<i64> {
    state.with_db("habit_occurrence_ensure", |conn| {
        occurrence_repo::ensure_range(conn, &params.from_date, &params.to_date)
    })
}

#[tauri::command]
pub fn habit_occurrence_update(
    state: State<'_, AppState>,
    params: HabitOccurrenceUpdateParams,
) -> AppResult<HabitOccurrenceDto> {
    state.with_db("habit_occurrence_update", |conn| {
        occurrence_repo::update(conn, &params.id, &params.patch)
    })
}

#[tauri::command]
pub fn habit_streak_get(state: State<'_, AppState>, rule_id: String) -> AppResult<HabitStreakDto> {
    state.with_db("habit_streak_get", |conn| {
        let current_streak = occurrence_repo::compute_streak(conn, &rule_id)?;
        Ok(HabitStreakDto {
            rule_id,
            current_streak,
        })
    })
}
