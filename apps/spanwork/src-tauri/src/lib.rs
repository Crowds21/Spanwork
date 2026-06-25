//! Spanwork Tauri 后端库入口。
//! 在 setup 中初始化文件日志、SQLite 数据库与 AppState，并注册全部 IPC command。
//! 依赖 tauri、db、commands、logging、state 等子模块。

mod commands;
mod db;
mod domain;
mod dto;
mod error;
mod logging;
mod state;
mod sync;
mod timer;

use logging::{FileLogger, LogLevel, DEFAULT_MAX_BYTES};
use state::AppState;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use crate::sync::pairing::PairingManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("resolve app data dir failed: {e}"))?;
            let log_dir = app_dir.join("logs");
            let logger = FileLogger::new(log_dir, DEFAULT_MAX_BYTES, 1)
                .map_err(|e| format!("init logger failed: {e}"))?;

            let _ = logger.write(
                LogLevel::Info,
                "app",
                "Spanwork started",
                Some(env!("CARGO_PKG_VERSION")),
            );

            let (db, db_path) = db::init_db(app.handle())?;
            let _ = logger.write(LogLevel::Info, "db", "database initialized", None);

            app.manage(AppState {
                db,
                logger,
                db_path,
                pairing: Arc::new(PairingManager::new()),
                sync_session: Mutex::new(None),
                sync_abort: Arc::new(AtomicBool::new(false)),
                sync_stream: Mutex::new(None),
                discovery: Mutex::new(None),
                listener: Mutex::new(None),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::device::device_get,
            commands::device::device_update_name,
            commands::device::app_get_info,
            commands::log::log_write,
            commands::log::log_get_info,
            commands::log::log_read_tail,
            commands::project::project_list,
            commands::project::project_get,
            commands::project::project_create,
            commands::project::project_update,
            commands::project::project_delete,
            commands::project::project_reorder,
            commands::project_category::project_category_list,
            commands::project_category::project_category_create,
            commands::project_category::project_category_update,
            commands::project_category::project_category_delete,
            commands::project_category::project_category_reorder,
            commands::task::task_list,
            commands::task::task_get,
            commands::task::task_create,
            commands::task::task_update,
            commands::task::task_delete,
            commands::task::task_reorder,
            commands::task::task_batch_complete,
            commands::milestone::milestone_list,
            commands::milestone::milestone_create,
            commands::milestone::milestone_update,
            commands::milestone::milestone_delete,
            commands::milestone::milestone_link_set,
            commands::time_entry::time_entry_list,
            commands::time_entry::time_entry_create,
            commands::time_entry::time_entry_update,
            commands::time_entry::time_entry_delete,
            commands::timer::timer_get_active,
            commands::timer::timer_start,
            commands::timer::timer_pause,
            commands::timer::timer_resume,
            commands::timer::timer_stop,
            commands::timer::timer_cancel,
            commands::today::today_get_dashboard,
            commands::habit::habit_rule_list,
            commands::habit::habit_rule_get,
            commands::habit::habit_rule_create,
            commands::habit::habit_rule_update,
            commands::habit::habit_rule_delete,
            commands::habit::habit_occurrence_list,
            commands::habit::habit_occurrence_ensure,
            commands::habit::habit_occurrence_update,
            commands::habit::habit_streak_get,
            commands::calendar::calendar_get_day,
            commands::calendar::calendar_get_range,
            commands::sync::sync_discovery_start,
            commands::sync::sync_discovery_stop,
            commands::sync::sync_discovery_list,
            commands::sync::sync_pairing_request,
            commands::sync::sync_start,
            commands::sync::sync_connect_manual,
            commands::sync::sync_cancel,
            commands::sync::sync_history_list,
            commands::sync::sync_get_peer_cursors,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use crate::commands::today::utc_day_bounds;
    use crate::db::migrate::run_migrations;
    use crate::db::repos::{milestone, project, project_category, task, time_entry};
    use crate::domain::task_tree;
    use crate::dto::{
        CreateMilestoneInput, CreateProjectCategoryInput, CreateProjectInput, CreateTaskInput, CreateTimeEntryInput,
        MilestoneLinkInput, MilestoneLinkSetParams, MilestoneLinkType, ProjectType,
        StartTimerInput, TimeTargetType,
    };
    use crate::error::{AppError, now_ms};
    use crate::timer;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();
        run_migrations(&conn).unwrap();
        let now = now_ms();
        conn.execute(
            "INSERT INTO device_config (id, device_id, device_name, platform, created_at, updated_at)
             VALUES (1, 'test-device', 'Test', 'macos', ?1, ?1)",
            [now],
        )
        .unwrap();
        conn
    }

    fn create_test_project(conn: &Connection) -> String {
        project::create(
            conn,
            &CreateProjectInput {
                name: "Demo".into(),
                description: None,
                project_type: ProjectType::Aim,
                color: None,
                icon: None,
                start_date: None,
                target_end_date: None,
                category_id: None,
                habit_rule: None,
            },
        )
        .unwrap()
        .id
    }

    #[test]
    fn create_and_list_projects() {
        let conn = test_conn();
        let created = project::create(
            &conn,
            &CreateProjectInput {
                name: "Demo".into(),
                description: Some("desc".into()),
                project_type: ProjectType::Aim,
                color: None,
                icon: None,
                start_date: None,
                target_end_date: None,
                category_id: None,
                habit_rule: None,
            },
        )
        .unwrap();

        assert_eq!(created.name, "Demo");
        let list = project::list(&conn, &Default::default()).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, created.id);
    }

    #[test]
    fn device_config_readable() {
        let conn = test_conn();
        let dev = crate::db::repos::device::get_device(&conn).unwrap();
        assert_eq!(dev.device_name, "Test");
    }

    #[test]
    fn task_tree_depth_and_cascade_delete() {
        let conn = test_conn();
        let project_id = create_test_project(&conn);

        let root = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: None,
                milestone_id: None,
                title: "Root".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: true,
                ..Default::default()
            },
        )
        .unwrap();

        let sub = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: Some(root.id.clone()),
                milestone_id: None,
                title: "Sub".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: false,
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(task_tree::get_depth(&conn, &root.id).unwrap(), 0);
        assert_eq!(task_tree::get_depth(&conn, &sub.id).unwrap(), 1);

        let depth_error = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: Some(sub.id.clone()),
                milestone_id: None,
                title: "Sub-sub".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: false,
                ..Default::default()
            },
        );
        assert!(matches!(
            depth_error,
            Err(AppError::Validation { field, .. }) if field == "parentId"
        ));

        let plain = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: None,
                milestone_id: None,
                title: "Plain".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: false,
                ..Default::default()
            },
        )
        .unwrap();

        let parent_error = task::create(
            &conn,
            &CreateTaskInput {
                project_id,
                parent_id: Some(plain.id.clone()),
                milestone_id: None,
                title: "Under plain".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: false,
                ..Default::default()
            },
        );
        assert!(matches!(
            parent_error,
            Err(AppError::Validation { field, .. }) if field == "parentId"
        ));

        task::delete(&conn, &root.id).unwrap();

        assert!(task::get_by_id(&conn, &root.id).is_err());
        assert!(task::get_by_id(&conn, &sub.id).is_err());
    }

    #[test]
    fn timer_start_stop_conflict() {
        let conn = test_conn();
        let project_id = create_test_project(&conn);

        let root = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: None,
                milestone_id: None,
                title: "Work".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: false,
                ..Default::default()
            },
        )
        .unwrap();

        let started = timer::start(
            &conn,
            &StartTimerInput {
                project_id: project_id.clone(),
                target_type: TimeTargetType::Task,
                target_id: root.id.clone(),
                note: None,
                force: None,
            },
        )
        .unwrap();
        assert_eq!(started.target_id, root.id);

        let conflict = timer::start(
            &conn,
            &StartTimerInput {
                project_id: project_id.clone(),
                target_type: TimeTargetType::Task,
                target_id: root.id.clone(),
                note: None,
                force: None,
            },
        );
        assert!(matches!(conflict, Err(AppError::Conflict { .. })));

        let entry = timer::stop(&conn).unwrap();
        assert_eq!(entry.source, crate::dto::TimeEntrySource::Timer);
        assert!(timer::get_active(&conn).unwrap().is_none());

        let stop_again = timer::stop(&conn);
        assert!(matches!(stop_again, Err(AppError::Conflict { .. })));
    }

    #[test]
    fn timer_pause_resume_and_complete() {
        let conn = test_conn();
        let project_id = create_test_project(&conn);

        let root = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: None,
                milestone_id: None,
                title: "Work".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: false,
                ..Default::default()
            },
        )
        .unwrap();

        let started = timer::start(
            &conn,
            &StartTimerInput {
                project_id: project_id.clone(),
                target_type: TimeTargetType::Task,
                target_id: root.id.clone(),
                note: None,
                force: None,
            },
        )
        .unwrap();
        assert!(!started.is_paused);
        assert_eq!(started.accumulated_seconds, 0);

        let paused = timer::pause(&conn).unwrap();
        assert!(paused.is_paused);
        assert_eq!(paused.elapsed_seconds, paused.accumulated_seconds);

        let resumed = timer::resume(&conn).unwrap();
        assert!(!resumed.is_paused);

        let entry = timer::stop(&conn).unwrap();
        assert_eq!(entry.source, crate::dto::TimeEntrySource::Timer);
        assert!(timer::get_active(&conn).unwrap().is_none());
    }

    #[test]
    fn milestone_crud_and_links() {
        let conn = test_conn();
        let project_id = create_test_project(&conn);

        let created = milestone::create(
            &conn,
            &CreateMilestoneInput {
                project_id: project_id.clone(),
                title: "M1".into(),
                description: Some("first".into()),
                target_date: Some("2026-12-31".into()),
                status: None,
                sort_order: None,
            },
        )
        .unwrap();
        assert_eq!(created.title, "M1");

        let task_item = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: None,
                milestone_id: None,
                title: "Linked task".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: false,
                ..Default::default()
            },
        )
        .unwrap();

        milestone::link_set(
            &conn,
            &MilestoneLinkSetParams {
                milestone_id: created.id.clone(),
                links: vec![MilestoneLinkInput {
                    link_type: MilestoneLinkType::Task,
                    link_id: task_item.id.clone(),
                }],
            },
        )
        .unwrap();

        let fetched = milestone::get_by_id(&conn, &created.id).unwrap();
        assert_eq!(fetched.linked_count, Some(1));

        milestone::delete(&conn, &created.id).unwrap();
        assert!(milestone::get_by_id(&conn, &created.id).is_err());
    }

    #[test]
    fn today_dashboard_and_time_entry() {
        let conn = test_conn();
        let project_id = create_test_project(&conn);
        let now = now_ms();
        let (day_start, day_end) = utc_day_bounds(now);

        let task_item = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: None,
                milestone_id: None,
                title: "Recent".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: false,
                ..Default::default()
            },
        )
        .unwrap();

        time_entry::create(
            &conn,
            &CreateTimeEntryInput {
                project_id,
                target_type: TimeTargetType::Task,
                target_id: task_item.id,
                start_at: Some(day_start + 1_000),
                end_at: Some(day_start + 3_600_000),
                duration_seconds: None,
                note: None,
            },
        )
        .unwrap();

        let total = time_entry::sum_today(&conn, day_start, day_end).unwrap();
        assert!(total > 0);

        let recent = task::recent_tasks(&conn, 10).unwrap();
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].title, "Recent");

        let active_timer = timer::get_active(&conn).unwrap();
        let dashboard = crate::dto::TodayDashboardDto {
            active_timer,
            habit_occurrences_today: Vec::new(),
            recent_tasks: recent,
            total_time_today_seconds: total,
        };
        assert!(dashboard.habit_occurrences_today.is_empty());
        assert_eq!(dashboard.recent_tasks.len(), 1);
    }

    #[test]
    fn project_delete_cascades_dashboard() {
        let conn = test_conn();
        let project_id = create_test_project(&conn);
        let now = now_ms();
        let (day_start, day_end) = utc_day_bounds(now);

        let task_item = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: None,
                milestone_id: None,
                title: "Orphan".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: false,
                ..Default::default()
            },
        )
        .unwrap();

        time_entry::create(
            &conn,
            &CreateTimeEntryInput {
                project_id: project_id.clone(),
                target_type: TimeTargetType::Task,
                target_id: task_item.id.clone(),
                start_at: Some(day_start + 1_000),
                end_at: Some(day_start + 3_600_000),
                duration_seconds: None,
                note: None,
            },
        )
        .unwrap();

        assert_eq!(task::recent_tasks(&conn, 10).unwrap().len(), 1);
        assert!(time_entry::sum_today(&conn, day_start, day_end).unwrap() > 0);

        timer::start(
            &conn,
            &StartTimerInput {
                project_id: project_id.clone(),
                target_type: TimeTargetType::Task,
                target_id: task_item.id.clone(),
                note: None,
                force: None,
            },
        )
        .unwrap();
        assert!(timer::get_active(&conn).unwrap().is_some());

        project::delete(&conn, &project_id).unwrap();

        assert!(project::get_by_id(&conn, &project_id).is_err());
        assert_eq!(task::recent_tasks(&conn, 10).unwrap().len(), 0);
        assert_eq!(time_entry::sum_today(&conn, day_start, day_end).unwrap(), 0);
        assert!(timer::get_active(&conn).unwrap().is_none());
    }

    #[test]
    fn milestone_timer_rejected_and_rollup() {
        let conn = test_conn();
        let project_id = create_test_project(&conn);

        let milestone = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: None,
                milestone_id: None,
                title: "Phase 1".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: true,
                ..Default::default()
            },
        )
        .unwrap();

        let sub = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: Some(milestone.id.clone()),
                milestone_id: None,
                title: "Sub task".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: false,
                ..Default::default()
            },
        )
        .unwrap();

        let milestone = task::get_by_id(&conn, &milestone.id).unwrap();
        assert_eq!(milestone.time_trackable, Some(false));

        let timer_error = timer::start(
            &conn,
            &StartTimerInput {
                project_id: project_id.clone(),
                target_type: TimeTargetType::Task,
                target_id: milestone.id.clone(),
                note: None,
                force: None,
            },
        );
        assert!(matches!(
            timer_error,
            Err(AppError::TimeTargetNotTrackable { .. })
        ));

        time_entry::create(
            &conn,
            &CreateTimeEntryInput {
                project_id: project_id.clone(),
                target_type: TimeTargetType::Task,
                target_id: sub.id.clone(),
                start_at: Some(now_ms() - 7200_000),
                end_at: Some(now_ms()),
                duration_seconds: None,
                note: None,
            },
        )
        .unwrap();

        let fetched = task::get_by_id(&conn, &milestone.id).unwrap();
        assert_eq!(fetched.total_time_seconds, Some(7200));
        assert_eq!(fetched.time_trackable, Some(false));

        let sub_fetched = task::get_by_id(&conn, &sub.id).unwrap();
        assert_eq!(sub_fetched.time_trackable, Some(true));
        assert_eq!(sub_fetched.timer_startable, Some(true));
    }

    #[test]
    fn empty_milestone_is_trackable() {
        let conn = test_conn();
        let project_id = create_test_project(&conn);

        let milestone = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: None,
                milestone_id: None,
                title: "Solo milestone".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: true,
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(milestone.time_trackable, Some(true));
        assert_eq!(milestone.timer_startable, Some(true));
        assert_eq!(milestone.child_count, Some(0));

        timer::start(
            &conn,
            &StartTimerInput {
                project_id: project_id.clone(),
                target_type: TimeTargetType::Task,
                target_id: milestone.id.clone(),
                note: None,
                force: None,
            },
        )
        .unwrap();
    }

    #[test]
    fn done_task_blocks_timer_but_allows_manual_entry() {
        let conn = test_conn();
        let project_id = create_test_project(&conn);

        let done_task = task::create(
            &conn,
            &CreateTaskInput {
                project_id: project_id.clone(),
                parent_id: None,
                milestone_id: None,
                title: "Finished".into(),
                description: None,
                priority: None,
                due_date: None,
                tags: None,
                sort_order: None,
                is_milestone: false,
                ..Default::default()
            },
        )
        .unwrap();

        task::update(
            &conn,
            &crate::dto::TaskUpdateParams {
                id: done_task.id.clone(),
                patch: crate::dto::UpdateTaskInput {
                    status: Some(crate::dto::TaskStatus::Done),
                    ..Default::default()
                },
            },
        )
        .unwrap();

        let fetched = task::get_by_id(&conn, &done_task.id).unwrap();
        assert_eq!(fetched.time_trackable, Some(true));
        assert_eq!(fetched.timer_startable, Some(false));

        let timer_error = timer::start(
            &conn,
            &StartTimerInput {
                project_id: project_id.clone(),
                target_type: TimeTargetType::Task,
                target_id: done_task.id.clone(),
                note: None,
                force: None,
            },
        );
        assert!(matches!(
            timer_error,
            Err(AppError::TimerTargetNotStartable { .. })
        ));

        let entry = time_entry::create(
            &conn,
            &CreateTimeEntryInput {
                project_id,
                target_type: TimeTargetType::Task,
                target_id: done_task.id,
                start_at: Some(now_ms() - 3600_000),
                end_at: Some(now_ms()),
                duration_seconds: None,
                note: None,
            },
        );
        assert!(entry.is_ok());
    }

    #[test]
    fn project_category_crud() {
        let conn = test_conn();

        let created = project_category::create(
            &conn,
            &CreateProjectCategoryInput {
                name: "工作".into(),
                color: Some("#3b82f6".into()),
                icon: None,
                sort_order: None,
            },
        )
        .unwrap();
        assert_eq!(created.name, "工作");
        assert_eq!(created.project_count, Some(0));

        let dup = project_category::create(
            &conn,
            &CreateProjectCategoryInput {
                name: "工作".into(),
                color: None,
                icon: None,
                sort_order: None,
            },
        );
        assert!(matches!(dup, Err(AppError::CategoryNameExists { .. })));

        let project_id = project::create(
            &conn,
            &CreateProjectInput {
                name: "Cat Project".into(),
                description: None,
                project_type: ProjectType::Aim,
                color: None,
                icon: None,
                start_date: None,
                target_end_date: None,
                category_id: Some(created.id.clone()),
                habit_rule: None,
            },
        )
        .unwrap()
        .id;

        let listed = project_category::list(&conn).unwrap();
        assert_eq!(listed[0].project_count, Some(1));

        project_category::delete(&conn, &created.id).unwrap();

        let project_after = project::get_by_id(&conn, &project_id).unwrap();
        assert!(project_after.category_id.is_none());
    }

    #[test]
    fn habit_project_calendar_flow() {
        use crate::db::repos::{calendar, habit_occurrence, habit_rule};
        use crate::domain::habit_schedule::{format_date, today_local_date};
        use crate::dto::{
            CalendarDayParams, CreateHabitRuleInput, HabitFrequency, HabitOccurrenceStatus,
            TimeBlockDisplayMode, UpdateHabitOccurrenceInput,
        };

        let conn = test_conn();
        let today = format_date(today_local_date());

        let project = project::create(
            &conn,
            &CreateProjectInput {
                name: "Morning Run".into(),
                description: None,
                project_type: ProjectType::Habit,
                color: Some("#22c55e".into()),
                icon: None,
                start_date: None,
                target_end_date: None,
                category_id: None,
                habit_rule: None,
            },
        )
        .unwrap();

        habit_rule::create(
            &conn,
            &project.id,
            Some(&CreateHabitRuleInput {
                title: Some("Morning Run".into()),
                sort_order: None,
                frequency: Some(HabitFrequency::Daily),
                days_of_week: None,
                day_of_month: None,
                days_of_month: None,
                month_and_day: None,
                yearly_dates: None,
                why: None,
                celebration_messages: None,
                target_duration_seconds: None,
                minimum_duration_seconds: None,
                ability_tips: None,
                anchor_time: None,
                anchor_habit: None,
                behavior_design_enabled: None,
                celebration_on_complete: None,
            }),
            &project.name,
        )
        .unwrap();

        let to = format_date(today_local_date() + chrono::Duration::days(90));
        habit_occurrence::ensure_range(&conn, &today, &to).unwrap();

        let day = calendar::get_day(
            &conn,
            &CalendarDayParams {
                date: today.clone(),
                project_id: None,
            },
            None,
        )
        .unwrap();
        assert_eq!(day.occurrences.len(), 1);
        assert_eq!(day.occurrences[0].status, HabitOccurrenceStatus::Pending);

        assert_eq!(day.occurrences[0].display_title.as_deref(), Some("Morning Run · Morning Run"));

        let occ_id = day.occurrences[0].id.clone();
        let rule_id = day.occurrences[0].rule_id.clone();
        time_entry::create(
            &conn,
            &CreateTimeEntryInput {
                project_id: project.id.clone(),
                target_type: TimeTargetType::HabitOccurrence,
                target_id: occ_id.clone(),
                start_at: Some(now_ms() - 1800_000),
                end_at: None,
                duration_seconds: Some(1800),
                note: None,
            },
        )
        .unwrap();

        let day2 = calendar::get_day(
            &conn,
            &CalendarDayParams {
                date: today,
                project_id: None,
            },
            None,
        )
        .unwrap();
        assert_eq!(day2.time_blocks.len(), 1);
        assert_eq!(day2.time_blocks[0].display_mode, TimeBlockDisplayMode::Marker);

        habit_occurrence::update(
            &conn,
            &occ_id,
            &UpdateHabitOccurrenceInput {
                status: Some(HabitOccurrenceStatus::Done),
                scheduled_date: None,
                note: None,
            },
        )
        .unwrap();

        let streak = habit_occurrence::compute_streak(&conn, &rule_id).unwrap();
        assert_eq!(streak, 1);
    }

    #[test]
    fn habit_rule_delete_hides_calendar_time_and_summaries() {
        use crate::commands::today::utc_day_bounds;
        use crate::db::repos::{calendar, habit_occurrence, habit_rule};
        use crate::domain::habit_schedule::{format_date, today_local_date};
        use crate::dto::{
            CalendarDayParams, CreateHabitRuleInput, HabitFrequency, HabitOccurrenceStatus,
            UpdateHabitOccurrenceInput,
        };

        let conn = test_conn();
        let today = format_date(today_local_date());
        let (utc_start, utc_end) = utc_day_bounds(now_ms());

        let project = project::create(
            &conn,
            &CreateProjectInput {
                name: "Bodyweight".into(),
                description: None,
                project_type: ProjectType::Habit,
                color: None,
                icon: None,
                start_date: None,
                target_end_date: None,
                category_id: None,
                habit_rule: None,
            },
        )
        .unwrap();

        let rule = habit_rule::create(
            &conn,
            &project.id,
            Some(&CreateHabitRuleInput {
                title: Some("自重训练".into()),
                sort_order: None,
                frequency: Some(HabitFrequency::Daily),
                days_of_week: None,
                day_of_month: None,
                days_of_month: None,
                month_and_day: None,
                yearly_dates: None,
                why: None,
                celebration_messages: None,
                target_duration_seconds: None,
                minimum_duration_seconds: None,
                ability_tips: None,
                anchor_time: None,
                anchor_habit: None,
                behavior_design_enabled: None,
                celebration_on_complete: None,
            }),
            &project.name,
        )
        .unwrap();

        habit_occurrence::ensure_range(&conn, &today, &today).unwrap();

        let day = calendar::get_day(
            &conn,
            &CalendarDayParams {
                date: today.clone(),
                project_id: None,
            },
            None,
        )
        .unwrap();
        let occ_id = day.occurrences[0].id.clone();

        time_entry::create(
            &conn,
            &CreateTimeEntryInput {
                project_id: project.id.clone(),
                target_type: TimeTargetType::HabitOccurrence,
                target_id: occ_id.clone(),
                start_at: Some(now_ms() - 60_000),
                end_at: None,
                duration_seconds: Some(1800),
                note: None,
            },
        )
        .unwrap();

        habit_occurrence::update(
            &conn,
            &occ_id,
            &UpdateHabitOccurrenceInput {
                status: Some(HabitOccurrenceStatus::Done),
                scheduled_date: None,
                note: None,
            },
        )
        .unwrap();

        let before_delete = calendar::get_day(
            &conn,
            &CalendarDayParams {
                date: today.clone(),
                project_id: None,
            },
            None,
        )
        .unwrap();
        assert_eq!(before_delete.time_blocks.len(), 1);
        assert!(time_entry::sum_today(&conn, utc_start, utc_end).unwrap() > 0);

        habit_rule::delete(&conn, &rule.id).unwrap();

        let after_delete = calendar::get_day(
            &conn,
            &CalendarDayParams {
                date: today.clone(),
                project_id: None,
            },
            None,
        )
        .unwrap();
        assert!(after_delete.time_blocks.is_empty());
        assert!(after_delete.occurrences.is_empty());
        assert_eq!(time_entry::sum_today(&conn, utc_start, utc_end).unwrap(), 0);

        let summaries = habit_occurrence::summarize_range(&conn, &today, &today, None).unwrap();
        assert!(summaries.is_empty());

        let detail = project::get_detail(&conn, &project.id).unwrap();
        assert_eq!(detail.total_time_seconds, Some(0));
    }

    #[test]
    fn habit_timer_stop_allows_existing_manual_time() {
        use crate::db::repos::{calendar, habit_occurrence, habit_rule};
        use crate::domain::habit_schedule::{format_date, today_local_date};
        use crate::dto::{CalendarDayParams, CreateHabitRuleInput, HabitFrequency, StartTimerInput};

        let conn = test_conn();
        let today = format_date(today_local_date());

        let project = project::create(
            &conn,
            &CreateProjectInput {
                name: "Reading".into(),
                description: None,
                project_type: ProjectType::Habit,
                color: None,
                icon: None,
                start_date: None,
                target_end_date: None,
                category_id: None,
                habit_rule: None,
            },
        )
        .unwrap();

        habit_rule::create(
            &conn,
            &project.id,
            Some(&CreateHabitRuleInput {
                title: Some("Reading Notes".into()),
                sort_order: None,
                frequency: Some(HabitFrequency::Daily),
                days_of_week: None,
                day_of_month: None,
                days_of_month: None,
                month_and_day: None,
                yearly_dates: None,
                why: None,
                celebration_messages: None,
                target_duration_seconds: None,
                minimum_duration_seconds: None,
                ability_tips: None,
                anchor_time: None,
                anchor_habit: None,
                behavior_design_enabled: None,
                celebration_on_complete: None,
            }),
            &project.name,
        )
        .unwrap();

        let to = format_date(today_local_date() + chrono::Duration::days(7));
        habit_occurrence::ensure_range(&conn, &today, &to).unwrap();

        let occ_id = calendar::get_day(
            &conn,
            &CalendarDayParams {
                date: today,
                project_id: None,
            },
            None,
        )
        .unwrap()
        .occurrences[0]
        .id
        .clone();

        time_entry::create(
            &conn,
            &CreateTimeEntryInput {
                project_id: project.id.clone(),
                target_type: TimeTargetType::HabitOccurrence,
                target_id: occ_id.clone(),
                start_at: Some(now_ms() - 1800_000),
                end_at: None,
                duration_seconds: Some(1800),
                note: None,
            },
        )
        .unwrap();

        timer::start(
            &conn,
            &StartTimerInput {
                project_id: project.id,
                target_type: TimeTargetType::HabitOccurrence,
                target_id: occ_id,
                note: None,
                force: None,
            },
        )
        .unwrap();

        let entry = timer::stop(&conn).unwrap();
        assert!(entry.duration_seconds >= 0);
    }
}
