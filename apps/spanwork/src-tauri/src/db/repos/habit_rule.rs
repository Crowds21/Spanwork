//! habit_rules 表读写：每 habit 项目可有多条习惯任务（周期规则）。

use rusqlite::{Connection, OptionalExtension};

use crate::domain::habit_fogg::{
    decode_celebration_messages, encode_celebration_messages, normalize_optional_text,
    validate_anchor_time, validate_duration_seconds,
};
use crate::domain::habit_schedule::{
    decode_days_of_month, decode_days_of_week, decode_yearly_dates, encode_days_of_month,
    encode_days_of_week, encode_yearly_dates,
};
use crate::dto::{
    CreateHabitRuleInput, HabitFrequency, HabitRuleDto, UpdateHabitRuleInput,
};
use crate::error::{new_id, now_ms, AppError, AppResult};

const RULE_SELECT: &str = "SELECT id, project_id, title, sort_order, frequency, days_of_week,
        day_of_month, month_and_day, days_of_month, yearly_dates, why, celebration_messages,
        target_duration_seconds, minimum_duration_seconds, ability_tips, anchor_time, anchor_habit,
        behavior_design_enabled, celebration_on_complete, created_at, updated_at
 FROM habit_rules";

pub fn get_by_id(conn: &Connection, rule_id: &str) -> AppResult<HabitRuleDto> {
    conn.query_row(
        &format!("{RULE_SELECT} WHERE id = ?1 AND deleted_at IS NULL"),
        [rule_id],
        map_habit_rule_row,
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound {
        entity: "habit_rule",
        id: rule_id.to_string(),
    })
}

pub fn list_by_project_id(conn: &Connection, project_id: &str) -> AppResult<Vec<HabitRuleDto>> {
    let mut stmt = conn.prepare(&format!(
        "{RULE_SELECT} WHERE project_id = ?1 AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC"
    ))?;
    let rows = stmt.query_map([project_id], map_habit_rule_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn create_for_project(
    conn: &Connection,
    project_id: &str,
    input: Option<&CreateHabitRuleInput>,
) -> AppResult<HabitRuleDto> {
    let project = crate::db::repos::project::get_by_id(conn, project_id)?;
    let default_title = project.name.clone();
    create(conn, project_id, input, &default_title)
}

pub fn create(
    conn: &Connection,
    project_id: &str,
    input: Option<&CreateHabitRuleInput>,
    default_title: &str,
) -> AppResult<HabitRuleDto> {
    crate::db::repos::project::get_by_id(conn, project_id)?;

    let title = input
        .and_then(|i| i.title.as_ref())
        .map(|t| t.trim())
        .filter(|t| !t.is_empty())
        .unwrap_or(default_title)
        .to_string();

    if title.len() > 128 {
        return Err(AppError::Validation {
            field: "title".into(),
            reason: "must be at most 128 characters".into(),
        });
    }

    let frequency = input
        .and_then(|i| i.frequency)
        .unwrap_or(HabitFrequency::Daily);
    let days_of_week = input.and_then(|i| i.days_of_week.clone());
    let days_of_month = resolve_days_of_month_input(input);
    let yearly_dates = resolve_yearly_dates_input(input);
    let sort_order = input.and_then(|i| i.sort_order).unwrap_or_else(|| next_sort_order(conn, project_id));

    let schedule = encode_schedule_fields(
        frequency,
        &days_of_week,
        &days_of_month,
        &yearly_dates,
    )?;

    let origin = crate::db::repos::device::origin_device_id(conn)?;
    let id = new_id();
    let now = now_ms();
    let fogg = parse_fogg_from_create(input)?;
    let behavior_design_enabled = input
        .and_then(|i| i.behavior_design_enabled)
        .unwrap_or(false);
    let celebration_on_complete = if behavior_design_enabled {
        input
            .and_then(|i| i.celebration_on_complete)
            .unwrap_or(false)
    } else {
        false
    };

    conn.execute(
        "INSERT INTO habit_rules (
            id, project_id, title, sort_order, frequency, days_of_week, day_of_month, month_and_day,
            days_of_month, yearly_dates, why, celebration_messages, target_duration_seconds,
            minimum_duration_seconds, ability_tips, anchor_time, anchor_habit, behavior_design_enabled,
            celebration_on_complete, created_at, updated_at, origin_device_id
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?20, ?21)",
        rusqlite::params![
            id,
            project_id,
            title,
            sort_order,
            frequency_to_str(frequency),
            schedule.days_of_week,
            schedule.day_of_month,
            schedule.month_and_day,
            schedule.days_of_month,
            schedule.yearly_dates,
            fogg.why,
            fogg.celebration_messages,
            fogg.target_duration_seconds,
            fogg.minimum_duration_seconds,
            fogg.ability_tips,
            fogg.anchor_time,
            fogg.anchor_habit,
            i32::from(behavior_design_enabled),
            i32::from(celebration_on_complete),
            now,
            origin,
        ],
    )?;

    get_by_id(conn, &id)
}

pub fn update(conn: &Connection, rule_id: &str, patch: &UpdateHabitRuleInput) -> AppResult<HabitRuleDto> {
    let existing = get_by_id(conn, rule_id)?;
    let title = patch
        .title
        .as_ref()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| existing.title.clone());

    if title.len() > 128 {
        return Err(AppError::Validation {
            field: "title".into(),
            reason: "must be at most 128 characters".into(),
        });
    }

    let frequency = patch.frequency.unwrap_or(existing.frequency);
    let days_of_week = patch
        .days_of_week
        .clone()
        .or(existing.days_of_week.clone());
    let days_of_month = patch
        .days_of_month
        .clone()
        .or(existing.days_of_month.clone());
    let yearly_dates = patch
        .yearly_dates
        .clone()
        .or(existing.yearly_dates.clone());
    let sort_order = patch.sort_order.unwrap_or(existing.sort_order);

    let schedule = encode_schedule_fields(
        frequency,
        &days_of_week,
        &days_of_month,
        &yearly_dates,
    )?;
    let fogg = merge_fogg_from_update(patch, &existing)?;
    let behavior_design_enabled = patch
        .behavior_design_enabled
        .unwrap_or(existing.behavior_design_enabled);
    let celebration_on_complete = if behavior_design_enabled {
        patch
            .celebration_on_complete
            .unwrap_or(existing.celebration_on_complete)
    } else {
        false
    };
    let now = now_ms();

    conn.execute(
        "UPDATE habit_rules SET
            title = ?1, sort_order = ?2, frequency = ?3, days_of_week = ?4,
            day_of_month = ?5, month_and_day = ?6, days_of_month = ?7, yearly_dates = ?8,
            why = ?9, celebration_messages = ?10, target_duration_seconds = ?11,
            minimum_duration_seconds = ?12, ability_tips = ?13, anchor_time = ?14, anchor_habit = ?15,
            behavior_design_enabled = ?16, celebration_on_complete = ?17, updated_at = ?18
         WHERE id = ?19 AND deleted_at IS NULL",
        rusqlite::params![
            title,
            sort_order,
            frequency_to_str(frequency),
            schedule.days_of_week,
            schedule.day_of_month,
            schedule.month_and_day,
            schedule.days_of_month,
            schedule.yearly_dates,
            fogg.why,
            fogg.celebration_messages,
            fogg.target_duration_seconds,
            fogg.minimum_duration_seconds,
            fogg.ability_tips,
            fogg.anchor_time,
            fogg.anchor_habit,
            i32::from(behavior_design_enabled),
            i32::from(celebration_on_complete),
            now,
            rule_id,
        ],
    )?;

    get_by_id(conn, rule_id)
}

pub fn delete(conn: &Connection, rule_id: &str) -> AppResult<()> {
    let _ = get_by_id(conn, rule_id)?;
    let now = now_ms();
    conn.execute(
        "UPDATE habit_rules SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, rule_id],
    )?;
    conn.execute(
        "UPDATE habit_occurrences SET deleted_at = ?1, updated_at = ?1
         WHERE rule_id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, rule_id],
    )?;
    Ok(())
}

fn next_sort_order(conn: &Connection, project_id: &str) -> i64 {
    conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM habit_rules
         WHERE project_id = ?1 AND deleted_at IS NULL",
        [project_id],
        |row| row.get(0),
    )
    .unwrap_or(0)
}

fn resolve_days_of_month_input(input: Option<&CreateHabitRuleInput>) -> Option<Vec<i32>> {
    input.and_then(|i| {
        i.days_of_month
            .clone()
            .or_else(|| i.day_of_month.map(|d| vec![d]))
    })
}

fn resolve_yearly_dates_input(input: Option<&CreateHabitRuleInput>) -> Option<Vec<String>> {
    input.and_then(|i| {
        i.yearly_dates.clone().or_else(|| {
            i.month_and_day
                .as_ref()
                .filter(|s| !s.trim().is_empty())
                .map(|s| vec![s.clone()])
        })
    })
}

struct ScheduleColumns {
    days_of_week: Option<String>,
    day_of_month: Option<i32>,
    month_and_day: Option<String>,
    days_of_month: Option<String>,
    yearly_dates: Option<String>,
}

fn encode_schedule_fields(
    frequency: HabitFrequency,
    days_of_week: &Option<Vec<i32>>,
    days_of_month: &Option<Vec<i32>>,
    yearly_dates: &Option<Vec<String>>,
) -> AppResult<ScheduleColumns> {
    match frequency {
        HabitFrequency::Daily => Ok(ScheduleColumns {
            days_of_week: None,
            day_of_month: None,
            month_and_day: None,
            days_of_month: None,
            yearly_dates: None,
        }),
        HabitFrequency::Weekly => {
            let days = days_of_week.as_ref().ok_or_else(|| AppError::Validation {
                field: "daysOfWeek".into(),
                reason: "required for weekly frequency".into(),
            })?;
            Ok(ScheduleColumns {
                days_of_week: Some(encode_days_of_week(days)?),
                day_of_month: None,
                month_and_day: None,
                days_of_month: None,
                yearly_dates: None,
            })
        }
        HabitFrequency::Monthly => {
            let days = days_of_month.as_ref().ok_or_else(|| AppError::Validation {
                field: "daysOfMonth".into(),
                reason: "required for monthly frequency".into(),
            })?;
            Ok(ScheduleColumns {
                days_of_week: None,
                day_of_month: days.first().copied(),
                month_and_day: None,
                days_of_month: Some(encode_days_of_month(days)?),
                yearly_dates: None,
            })
        }
        HabitFrequency::Yearly => {
            let dates = yearly_dates.as_ref().ok_or_else(|| AppError::Validation {
                field: "yearlyDates".into(),
                reason: "required for yearly frequency".into(),
            })?;
            Ok(ScheduleColumns {
                days_of_week: None,
                day_of_month: None,
                month_and_day: dates.first().cloned(),
                days_of_month: None,
                yearly_dates: Some(encode_yearly_dates(dates)?),
            })
        }
    }
}

pub fn list_active(conn: &Connection) -> AppResult<Vec<HabitRuleDto>> {
    let mut stmt = conn.prepare(
        "SELECT hr.id, hr.project_id, hr.title, hr.sort_order, hr.frequency, hr.days_of_week,
                hr.day_of_month, hr.month_and_day, hr.days_of_month, hr.yearly_dates, hr.why,
                hr.celebration_messages, hr.target_duration_seconds, hr.minimum_duration_seconds,
                hr.ability_tips, hr.anchor_time, hr.anchor_habit, hr.behavior_design_enabled,
                hr.celebration_on_complete, hr.created_at, hr.updated_at
         FROM habit_rules hr
         INNER JOIN projects p ON p.id = hr.project_id AND p.deleted_at IS NULL
         WHERE hr.deleted_at IS NULL AND p.project_type = 'habit' AND p.status = 'active'
         ORDER BY p.sort_order ASC, hr.sort_order ASC, hr.created_at ASC",
    )?;
    let rows = stmt.query_map([], map_habit_rule_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

struct FoggColumns {
    why: Option<String>,
    celebration_messages: Option<String>,
    target_duration_seconds: Option<i64>,
    minimum_duration_seconds: Option<i64>,
    ability_tips: Option<String>,
    anchor_time: Option<String>,
    anchor_habit: Option<String>,
}

fn parse_fogg_from_create(input: Option<&CreateHabitRuleInput>) -> AppResult<FoggColumns> {
    Ok(FoggColumns {
        why: normalize_optional_text(input.and_then(|i| i.why.as_deref()), 512, "why")?,
        celebration_messages: encode_celebration_messages(
            input.and_then(|i| i.celebration_messages.as_deref()),
        )?,
        target_duration_seconds: validate_duration_seconds(
            input.and_then(|i| i.target_duration_seconds),
            "targetDurationSeconds",
        )?,
        minimum_duration_seconds: validate_duration_seconds(
            input.and_then(|i| i.minimum_duration_seconds),
            "minimumDurationSeconds",
        )?,
        ability_tips: normalize_optional_text(
            input.and_then(|i| i.ability_tips.as_deref()),
            512,
            "abilityTips",
        )?,
        anchor_time: validate_anchor_time(input.and_then(|i| i.anchor_time.as_deref()))?,
        anchor_habit: normalize_optional_text(
            input.and_then(|i| i.anchor_habit.as_deref()),
            128,
            "anchorHabit",
        )?,
    })
}

fn merge_fogg_from_update(
    patch: &UpdateHabitRuleInput,
    existing: &HabitRuleDto,
) -> AppResult<FoggColumns> {
    let why = if patch.why.is_some() {
        normalize_optional_text(patch.why.as_deref(), 512, "why")?
    } else {
        existing.why.clone()
    };
    let celebration_messages = if patch.celebration_messages.is_some() {
        encode_celebration_messages(patch.celebration_messages.as_deref())?
    } else {
        encode_celebration_messages(existing.celebration_messages.as_deref())?
    };
    let target_duration_seconds = if patch.target_duration_seconds.is_some() {
        validate_duration_seconds(patch.target_duration_seconds, "targetDurationSeconds")?
    } else {
        existing.target_duration_seconds
    };
    let minimum_duration_seconds = if patch.minimum_duration_seconds.is_some() {
        validate_duration_seconds(patch.minimum_duration_seconds, "minimumDurationSeconds")?
    } else {
        existing.minimum_duration_seconds
    };
    let ability_tips = if patch.ability_tips.is_some() {
        normalize_optional_text(patch.ability_tips.as_deref(), 512, "abilityTips")?
    } else {
        existing.ability_tips.clone()
    };
    let anchor_time = if patch.anchor_time.is_some() {
        validate_anchor_time(patch.anchor_time.as_deref())?
    } else {
        existing.anchor_time.clone()
    };
    let anchor_habit = if patch.anchor_habit.is_some() {
        normalize_optional_text(patch.anchor_habit.as_deref(), 128, "anchorHabit")?
    } else {
        existing.anchor_habit.clone()
    };
    Ok(FoggColumns {
        why,
        celebration_messages,
        target_duration_seconds,
        minimum_duration_seconds,
        ability_tips,
        anchor_time,
        anchor_habit,
    })
}

fn map_habit_rule_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<HabitRuleDto> {
    let frequency_str: String = row.get(4)?;
    let days_raw: Option<String> = row.get(5)?;
    let days_of_month_raw: Option<String> = row.get(8)?;
    let yearly_dates_raw: Option<String> = row.get(9)?;
    let celebration_raw: Option<String> = row.get(11)?;

    Ok(HabitRuleDto {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        sort_order: row.get(3)?,
        frequency: parse_frequency(&frequency_str),
        days_of_week: decode_days_of_week(days_raw.as_deref()).map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                e.to_string(),
            )))
        })?,
        day_of_month: row.get(6)?,
        days_of_month: decode_days_of_month(days_of_month_raw.as_deref()).map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                e.to_string(),
            )))
        })?,
        month_and_day: row.get(7)?,
        yearly_dates: decode_yearly_dates(yearly_dates_raw.as_deref()).map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                e.to_string(),
            )))
        })?,
        why: row.get(10)?,
        celebration_messages: decode_celebration_messages(celebration_raw.as_deref()).map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                e.to_string(),
            )))
        })?,
        target_duration_seconds: row.get(12)?,
        minimum_duration_seconds: row.get(13)?,
        ability_tips: row.get(14)?,
        anchor_time: row.get(15)?,
        anchor_habit: row.get(16)?,
        behavior_design_enabled: row.get::<_, i32>(17)? != 0,
        celebration_on_complete: row.get::<_, i32>(18)? != 0,
        created_at: row.get(19)?,
        updated_at: row.get(20)?,
    })
}

pub fn format_display_title(project_name: &str, rule_title: &str) -> String {
    format!("{project_name} · {rule_title}")
}

pub fn frequency_to_str(value: HabitFrequency) -> &'static str {
    match value {
        HabitFrequency::Daily => "daily",
        HabitFrequency::Weekly => "weekly",
        HabitFrequency::Monthly => "monthly",
        HabitFrequency::Yearly => "yearly",
    }
}

pub fn parse_frequency(value: &str) -> HabitFrequency {
    match value {
        "weekly" => HabitFrequency::Weekly,
        "monthly" => HabitFrequency::Monthly,
        "yearly" => HabitFrequency::Yearly,
        _ => HabitFrequency::Daily,
    }
}
