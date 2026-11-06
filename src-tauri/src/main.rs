#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use saltmarcher::{
    atlas::{AppError, Status, Version},
    document_worker::DocumentWorker,
};

#[tauri::command]
async fn atlas_open(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, DocumentWorker>,
    version: Version,
) -> Result<Option<Status>, AppError> {
    let Some(handle) = rfd::AsyncFileDialog::new()
        .set_parent(&window)
        .add_filter("SaltMarcher Atlas", &["saltatlas"])
        .pick_file()
        .await
    else {
        return Ok(None);
    };
    state
        .open(version, handle.path().to_path_buf())
        .await
        .map(Some)
}
#[tauri::command]
async fn atlas_save(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, DocumentWorker>,
    version: Version,
    save_as: bool,
) -> Result<Option<Status>, AppError> {
    let existing = state.path(version.clone()).await?;
    let path = if let (false, Some(path)) = (save_as, existing) {
        path
    } else {
        let Some(handle) = rfd::AsyncFileDialog::new()
            .set_parent(&window)
            .add_filter("SaltMarcher Atlas", &["saltatlas"])
            .set_file_name("Unbenannter Atlas.saltatlas")
            .save_file()
            .await
        else {
            return Ok(None);
        };
        handle.path().to_path_buf()
    };
    state.save(version, path).await.map(Some)
}
#[tauri::command]
async fn atlas_request(
    state: tauri::State<'_, DocumentWorker>,
    cmd: String,
    args: serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    if cmd == "save" || cmd == "open" {
        return Err(saltmarcher::atlas::DomainViolation::InvalidInput {
            object_ids: vec![],
            detail: "Dateioperationen benötigen den nativen Dialog und eine Dokumentversion."
                .into(),
        }
        .into());
    }
    state.request(cmd, args).await
}
fn main() {
    tauri::Builder::default()
        .manage(DocumentWorker::new())
        .invoke_handler(tauri::generate_handler![
            atlas_request,
            atlas_open,
            atlas_save
        ])
        .run(tauri::generate_context!())
        .expect("SaltMarcher konnte nicht gestartet werden");
}
