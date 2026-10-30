#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod document;
use document::Document;
use serde::Serialize;
use std::sync::Mutex;
#[derive(Default)]
struct Files(Mutex<Option<std::path::PathBuf>>);
#[derive(Serialize)]
struct Opened {
    document: Document,
    name: String,
}
#[tauri::command]
async fn open_atlas(state: tauri::State<'_, Files>) -> Result<Option<Opened>, String> {
    let Some(handle) = rfd::AsyncFileDialog::new()
        .add_filter("SaltMarcher Atlas", &["json"])
        .pick_file()
        .await
    else {
        return Ok(None);
    };
    let document = document::read(handle.path())?;
    *state.0.lock().map_err(|e| e.to_string())? = Some(handle.path().into());
    Ok(Some(Opened {
        document,
        name: handle.file_name(),
    }))
}
#[tauri::command]
async fn save_atlas(
    document: Document,
    save_as: bool,
    state: tauri::State<'_, Files>,
) -> Result<Option<String>, String> {
    let existing = state.0.lock().map_err(|e| e.to_string())?.clone();
    let path = match (existing, save_as) {
        (Some(path), false) => path,
        _ => {
            let Some(handle) = rfd::AsyncFileDialog::new()
                .add_filter("SaltMarcher Atlas", &["json"])
                .set_file_name("Unbenannter Atlas.saltatlas.json")
                .save_file()
                .await
            else {
                return Ok(None);
            };
            handle.path().to_path_buf()
        }
    };
    document::write(&path, &document)?;
    let name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    *state.0.lock().map_err(|e| e.to_string())? = Some(path);
    Ok(Some(name))
}
#[tauri::command]
fn new_atlas(state: tauri::State<'_, Files>) -> Result<(), String> {
    *state.0.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}
fn main() {
    tauri::Builder::default()
        .manage(Files::default())
        .invoke_handler(tauri::generate_handler![open_atlas, save_atlas, new_atlas])
        .run(tauri::generate_context!())
        .expect("SaltMarcher konnte nicht gestartet werden");
}
