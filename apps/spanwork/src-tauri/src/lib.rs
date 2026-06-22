mod commands;
mod db;
mod domain;
mod dto;
mod error;
mod logging;
mod state;
mod timer;

use logging::{FileLogger, LogLevel, DEFAULT_MAX_BYTES};
use state::AppState;
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

            let db = db::init_db(app.handle())?;
            let _ = logger.write(LogLevel::Info, "db", "database initialized", None);

            app.manage(AppState { db, logger });
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
            commands::timer::timer_stop,
            commands::timer::timer_cancel,
            commands::today::today_get_dashboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use crate::commands::today::utc_day_bounds;
    use crate::db::migrate::run_migrations;
    use crate::db::repos::{milestone, project, task, time_entry};
    use crate::domain::task_tree;
    use crate::dto::{
        CreateMilestoneInput, CreateProjectInput, CreateTaskInput, CreateTimeEntryInput,
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
                project_type: ProjectType::Task,
                color: None,
                icon: None,
                start_date: None,
                target_end_date: None,
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
                project_type: ProjectType::Task,
                color: None,
                icon: None,
                start_date: None,
                target_end_date: None,
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
            },
        )
        .unwrap();

        time_entry::create(
            &conn,
            &CreateTimeEntryInput {
                project_id,
                target_type: TimeTargetType::Task,
                target_id: task_item.id,
                start_at: day_start + 1_000,
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
}
