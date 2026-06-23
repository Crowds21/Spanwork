//! 时间块展示模式判定：区间块 vs 点状标记。

use crate::dto::{TimeBlockDisplayMode, TimeEntryDto, TimeEntrySource};

pub fn resolve_display_mode(entry: &TimeEntryDto) -> TimeBlockDisplayMode {
    if entry.source == TimeEntrySource::Timer {
        return TimeBlockDisplayMode::Interval;
    }
    if entry.end_at.is_some() {
        TimeBlockDisplayMode::Interval
    } else {
        TimeBlockDisplayMode::Marker
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::{TimeEntryDto, TimeEntrySource, TimeTargetType};

    fn sample_entry(end_at: Option<i64>, source: TimeEntrySource) -> TimeEntryDto {
        TimeEntryDto {
            id: "e1".into(),
            project_id: "p1".into(),
            target_type: TimeTargetType::HabitOccurrence,
            target_id: "o1".into(),
            start_at: 1_000,
            end_at,
            duration_seconds: 60,
            note: None,
            source,
            created_at: 1_000,
            updated_at: 1_000,
        }
    }

    #[test]
    fn timer_is_always_interval() {
        assert_eq!(
            resolve_display_mode(&sample_entry(None, TimeEntrySource::Timer)),
            TimeBlockDisplayMode::Interval
        );
    }

    #[test]
    fn manual_with_end_is_interval() {
        assert_eq!(
            resolve_display_mode(&sample_entry(Some(2_000), TimeEntrySource::Manual)),
            TimeBlockDisplayMode::Interval
        );
    }

    #[test]
    fn manual_without_end_is_marker() {
        assert_eq!(
            resolve_display_mode(&sample_entry(None, TimeEntrySource::Manual)),
            TimeBlockDisplayMode::Marker
        );
    }
}
