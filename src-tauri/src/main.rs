#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    net::TcpStream,
    path::{Path, PathBuf},
    process::Command,
    thread,
    time::Duration,
};
use tauri::Manager;

fn project_root(app: &tauri::AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("missing project root")
            .to_path_buf()
    } else {
        app.path()
            .resource_dir()
            .unwrap_or_else(|_| {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .parent()
                    .expect("missing project root")
                    .to_path_buf()
            })
    }
}

fn bundled_root(candidate: &Path) -> Option<PathBuf> {
    let direct = candidate.join("start-webui.sh");
    if direct.exists() {
        return Some(candidate.to_path_buf());
    }

    let updater_layout = candidate.join("_up_").join("start-webui.sh");
    if updater_layout.exists() {
        return Some(candidate.join("_up_"));
    }

    None
}

fn bootstrap_root(app: &tauri::AppHandle) -> PathBuf {
    let root = project_root(app);
    bundled_root(&root).unwrap_or(root)
}

fn wait_for_port(addr: &str, attempts: u8) {
    for _ in 0..attempts {
        if TcpStream::connect(addr).is_ok() {
            return;
        }
        thread::sleep(Duration::from_millis(500));
    }
}

fn port_open(addr: &str) -> bool {
    TcpStream::connect(addr).is_ok()
}

fn start_local_backend(app: &tauri::AppHandle) {
    if port_open("127.0.0.1:3000") {
        return;
    }

    let root = bootstrap_root(app);
    let script = root.join("start-webui.sh");

    if !script.exists() {
        eprintln!("Hackloi desktop bootstrap script not found at {}", script.display());
        return;
    }

    let status = Command::new("bash")
        .arg(&script)
        .current_dir(&root)
        .env("WEBUI_PORT", "3000")
        .env("TAURI_DESKTOP", "1")
        .status();

    match status {
        Ok(exit) if exit.success() => wait_for_port("127.0.0.1:3000", 24),
        Ok(exit) => eprintln!("Hackloi backend bootstrap exited with status {exit}"),
        Err(error) => eprintln!("Failed to launch Hackloi backend: {error}"),
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            start_local_backend(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Hackloi AI Cyber Lab");
}
