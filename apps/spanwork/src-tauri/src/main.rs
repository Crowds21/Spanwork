// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! 桌面端二进制入口，调用 `spanwork_lib::run()` 启动 Tauri 应用。
//! Release 构建在 Windows 上通过 inner attribute 隐藏控制台窗口。

fn main() {
    spanwork_lib::run();
}
