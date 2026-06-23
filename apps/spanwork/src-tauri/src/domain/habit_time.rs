//! 习惯实例记时与计时器启动资格（与任务型项目规则对齐：记时不等于打卡完成）。

use rusqlite::Connection;

use crate::db::repos::habit_occurrence;
use crate::dto::HabitOccurrenceStatus;
use crate::error::{AppError, AppResult};

pub fn validate_timer_stop_target(conn: &Connection, occurrence_id: &str) -> AppResult<()> {
    let occ = habit_occurrence::get_by_id(conn, occurrence_id)?;
    if occ.status == HabitOccurrenceStatus::Skipped {
        return Err(AppError::TimeTargetNotTrackable {
            task_id: occurrence_id.to_string(),
        });
    }
    Ok(())
}

pub fn validate_manual_time_entry_target(conn: &Connection, occurrence_id: &str) -> AppResult<()> {
    let occ = habit_occurrence::get_by_id(conn, occurrence_id)?;
    if occ.status == HabitOccurrenceStatus::Skipped {
        return Err(AppError::TimeTargetNotTrackable {
            task_id: occurrence_id.to_string(),
        });
    }
    if occ.total_time_seconds.unwrap_or(0) > 0 {
        return Err(AppError::TimeTargetNotTrackable {
            task_id: occurrence_id.to_string(),
        });
    }
    Ok(())
}

pub fn validate_timer_start_target(conn: &Connection, occurrence_id: &str) -> AppResult<()> {
    let occ = habit_occurrence::get_by_id(conn, occurrence_id)?;
    if matches!(
        occ.status,
        HabitOccurrenceStatus::Done | HabitOccurrenceStatus::Skipped
    ) {
        return Err(AppError::TimerTargetNotStartable {
            task_id: occurrence_id.to_string(),
        });
    }
    Ok(())
}
