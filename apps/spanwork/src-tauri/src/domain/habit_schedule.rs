//! 习惯周期规则引擎：按 frequency 生成 scheduled_date 列表（纯函数，无 IO）。

use chrono::{Datelike, NaiveDate, Weekday};

use crate::dto::{HabitFrequency, HabitRuleDto};
use crate::error::{AppError, AppResult};

pub fn parse_date(value: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| AppError::Validation {
        field: "date".into(),
        reason: format!("invalid date: {value}"),
    })
}

pub fn format_date(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

pub fn today_local_date() -> NaiveDate {
    chrono::Local::now().date_naive()
}

pub fn dates_for_rule(rule: &HabitRuleDto, from: NaiveDate, to: NaiveDate) -> AppResult<Vec<NaiveDate>> {
    if to < from {
        return Err(AppError::Validation {
            field: "toDate".into(),
            reason: "must be on or after fromDate".into(),
        });
    }

    let mut dates = Vec::new();
    let mut cursor = from;
    while cursor <= to {
        if matches_rule_on_date(rule, cursor)? {
            dates.push(cursor);
        }
        cursor = cursor
            .succ_opt()
            .ok_or_else(|| AppError::Internal("date overflow".into()))?;
    }
    Ok(dates)
}

fn matches_rule_on_date(rule: &HabitRuleDto, date: NaiveDate) -> AppResult<bool> {
    match rule.frequency {
        HabitFrequency::Daily => Ok(true),
        HabitFrequency::Weekly => {
            let days = rule
                .days_of_week
                .as_ref()
                .ok_or_else(|| AppError::Validation {
                    field: "daysOfWeek".into(),
                    reason: "required for weekly frequency".into(),
                })?;
            let weekday = iso_weekday(date.weekday());
            Ok(days.contains(&weekday))
        }
        HabitFrequency::Monthly => {
            let days = resolve_days_of_month(rule)?;
            let dom = date.day() as i32;
            Ok(days.iter().any(|d| {
                dom == effective_day_of_month(date.year(), date.month(), *d)
            }))
        }
        HabitFrequency::Yearly => {
            let dates = resolve_yearly_dates(rule)?;
            Ok(dates.iter().any(|md| {
                let Ok((month, day)) = parse_month_and_day(md) else {
                    return false;
                };
                date.month() == month && date.day() == day as u32
            }))
        }
    }
}

fn iso_weekday(weekday: Weekday) -> i32 {
    weekday.number_from_monday() as i32
}

pub fn effective_day_of_month(year: i32, month: u32, day_of_month: i32) -> i32 {
    let last = last_day_of_month(year, month);
    day_of_month.min(last)
}

fn last_day_of_month(year: i32, month: u32) -> i32 {
    NaiveDate::from_ymd_opt(year, month + 1, 1)
        .or_else(|| NaiveDate::from_ymd_opt(year + 1, 1, 1))
        .and_then(|d| d.pred_opt())
        .map(|d| d.day() as i32)
        .unwrap_or(28)
}

fn parse_month_and_day(value: &str) -> AppResult<(u32, i32)> {
    let parts: Vec<&str> = value.split('-').collect();
    if parts.len() != 2 {
        return Err(AppError::Validation {
            field: "monthAndDay".into(),
            reason: "expected MM-DD".into(),
        });
    }
    let month: u32 = parts[0]
        .parse()
        .map_err(|_| AppError::Validation {
            field: "monthAndDay".into(),
            reason: "invalid month".into(),
        })?;
    let day: i32 = parts[1]
        .parse()
        .map_err(|_| AppError::Validation {
            field: "monthAndDay".into(),
            reason: "invalid day".into(),
        })?;
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return Err(AppError::Validation {
            field: "monthAndDay".into(),
            reason: "month/day out of range".into(),
        });
    }
    Ok((month, day))
}

fn resolve_days_of_month(rule: &HabitRuleDto) -> AppResult<Vec<i32>> {
    if let Some(days) = rule.days_of_month.as_ref() {
        if days.is_empty() {
            return Err(AppError::Validation {
                field: "daysOfMonth".into(),
                reason: "must not be empty for monthly frequency".into(),
            });
        }
        return Ok(days.clone());
    }
    if let Some(dom) = rule.day_of_month {
        return Ok(vec![dom]);
    }
    Err(AppError::Validation {
        field: "daysOfMonth".into(),
        reason: "required for monthly frequency".into(),
    })
}

fn resolve_yearly_dates(rule: &HabitRuleDto) -> AppResult<Vec<String>> {
    if let Some(dates) = rule.yearly_dates.as_ref() {
        if dates.is_empty() {
            return Err(AppError::Validation {
                field: "yearlyDates".into(),
                reason: "must not be empty for yearly frequency".into(),
            });
        }
        return Ok(dates.clone());
    }
    if let Some(md) = rule.month_and_day.as_ref() {
        if !md.trim().is_empty() {
            return Ok(vec![md.clone()]);
        }
    }
    Err(AppError::Validation {
        field: "yearlyDates".into(),
        reason: "required for yearly frequency (MM-DD)".into(),
    })
}

pub fn encode_days_of_month(days: &[i32]) -> AppResult<String> {
    if days.is_empty() {
        return Err(AppError::Validation {
            field: "daysOfMonth".into(),
            reason: "must not be empty".into(),
        });
    }
    for d in days {
        if !(1..=31).contains(d) {
            return Err(AppError::Validation {
                field: "daysOfMonth".into(),
                reason: "day must be 1-31".into(),
            });
        }
    }
    Ok(serde_json::to_string(days).map_err(|e| AppError::Internal(e.to_string()))?)
}

pub fn decode_days_of_month(raw: Option<&str>) -> AppResult<Option<Vec<i32>>> {
    match raw {
        None => Ok(None),
        Some(s) if s.trim().is_empty() => Ok(None),
        Some(s) => {
            let days: Vec<i32> = serde_json::from_str(s).map_err(|_| AppError::Validation {
                field: "daysOfMonth".into(),
                reason: "invalid JSON array".into(),
            })?;
            Ok(Some(days))
        }
    }
}

pub fn encode_yearly_dates(dates: &[String]) -> AppResult<String> {
    if dates.is_empty() {
        return Err(AppError::Validation {
            field: "yearlyDates".into(),
            reason: "must not be empty".into(),
        });
    }
    for md in dates {
        parse_month_and_day(md)?;
    }
    Ok(serde_json::to_string(dates).map_err(|e| AppError::Internal(e.to_string()))?)
}

pub fn decode_yearly_dates(raw: Option<&str>) -> AppResult<Option<Vec<String>>> {
    match raw {
        None => Ok(None),
        Some(s) if s.trim().is_empty() => Ok(None),
        Some(s) => {
            let dates: Vec<String> = serde_json::from_str(s).map_err(|_| AppError::Validation {
                field: "yearlyDates".into(),
                reason: "invalid JSON array".into(),
            })?;
            Ok(Some(dates))
        }
    }
}

pub fn encode_days_of_week(days: &[i32]) -> AppResult<String> {
    if days.is_empty() {
        return Err(AppError::Validation {
            field: "daysOfWeek".into(),
            reason: "must not be empty".into(),
        });
    }
    for d in days {
        if !(1..=7).contains(d) {
            return Err(AppError::Validation {
                field: "daysOfWeek".into(),
                reason: "weekday must be 1-7 (Mon-Sun)".into(),
            });
        }
    }
    Ok(serde_json::to_string(days).map_err(|e| AppError::Internal(e.to_string()))?)
}

pub fn decode_days_of_week(raw: Option<&str>) -> AppResult<Option<Vec<i32>>> {
    match raw {
        None => Ok(None),
        Some(s) if s.trim().is_empty() => Ok(None),
        Some(s) => {
            let days: Vec<i32> = serde_json::from_str(s)
                .map_err(|_| AppError::Validation {
                    field: "daysOfWeek".into(),
                    reason: "invalid JSON array".into(),
                })?;
            Ok(Some(days))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::HabitRuleDto;

    fn rule(
        frequency: HabitFrequency,
        days_of_week: Option<Vec<i32>>,
        days_of_month: Option<Vec<i32>>,
        yearly_dates: Option<Vec<String>>,
    ) -> HabitRuleDto {
        HabitRuleDto {
            id: "r1".into(),
            project_id: "p1".into(),
            title: "Test Habit".into(),
            sort_order: 0,
            frequency,
            days_of_week,
            day_of_month: days_of_month.as_ref().and_then(|d| d.first().copied()),
            days_of_month,
            month_and_day: yearly_dates.as_ref().and_then(|d| d.first().cloned()),
            yearly_dates,
            why: None,
            celebration_messages: None,
            target_duration_seconds: None,
            minimum_duration_seconds: None,
            ability_tips: None,
            anchor_time: None,
            anchor_habit: None,
            behavior_design_enabled: false,
            celebration_on_complete: false,
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn daily_includes_every_day_in_range() {
        let r = rule(HabitFrequency::Daily, None, None, None);
        let from = parse_date("2026-06-28").unwrap();
        let to = parse_date("2026-07-02").unwrap();
        let dates = dates_for_rule(&r, from, to).unwrap();
        assert_eq!(dates.len(), 5);
    }

    #[test]
    fn weekly_filters_by_iso_weekday() {
        let r = rule(HabitFrequency::Weekly, Some(vec![1, 3, 5]), None, None);
        let from = parse_date("2026-06-22").unwrap();
        let to = parse_date("2026-06-28").unwrap();
        let dates = dates_for_rule(&r, from, to).unwrap();
        assert_eq!(
            dates.iter().map(|d| format_date(*d)).collect::<Vec<_>>(),
            vec!["2026-06-22", "2026-06-24", "2026-06-26"]
        );
    }

    #[test]
    fn monthly_clamps_to_last_day() {
        assert_eq!(effective_day_of_month(2026, 2, 31), 28);
        assert_eq!(effective_day_of_month(2024, 2, 31), 29);
        let r = rule(HabitFrequency::Monthly, None, Some(vec![31]), None);
        let dates = dates_for_rule(
            &r,
            parse_date("2026-01-01").unwrap(),
            parse_date("2026-03-31").unwrap(),
        )
        .unwrap();
        assert!(dates.contains(&parse_date("2026-01-31").unwrap()));
        assert!(dates.contains(&parse_date("2026-02-28").unwrap()));
        assert!(dates.contains(&parse_date("2026-03-31").unwrap()));
    }

    #[test]
    fn yearly_leap_day() {
        let r = rule(HabitFrequency::Yearly, None, None, Some(vec!["02-29".into()]));
        let dates_2024 = dates_for_rule(
            &r,
            parse_date("2024-01-01").unwrap(),
            parse_date("2024-12-31").unwrap(),
        )
        .unwrap();
        assert_eq!(dates_2024.len(), 1);
        assert_eq!(format_date(dates_2024[0]), "2024-02-29");

        let dates_2025 = dates_for_rule(
            &r,
            parse_date("2025-01-01").unwrap(),
            parse_date("2025-12-31").unwrap(),
        )
        .unwrap();
        assert!(dates_2025.is_empty());
    }
}
