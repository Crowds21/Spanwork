//! IPC 命令层聚合，按业务域拆分子模块。
//! 各子模块暴露 `#[tauri::command]` 函数，由 lib.rs 统一注册到 invoke handler。

pub mod device;
pub mod log;
pub mod milestone;
pub mod project;
pub mod project_category;
pub mod task;
pub mod time_entry;
pub mod timer;
pub mod today;
pub mod habit;
pub mod calendar;
pub mod sync;
