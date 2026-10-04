use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

const STATE_FILE: &str = "state.json";

/// Paths written by `export_pdf` during this session. Only these can be
/// opened or revealed, so the webview cannot ask the OS to open arbitrary files.
#[derive(Default)]
struct ExportedFiles(Mutex<HashSet<PathBuf>>);

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not find the app data folder: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    Ok(dir.join(STATE_FILE))
}

/// Returns the saved business profile, settings, clients and current draft, if any.
#[tauri::command]
fn load_state(app: AppHandle) -> Result<Option<String>, String> {
    let path = state_path(&app)?;
    let json = match fs::read_to_string(&path) {
        Ok(json) => json,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("Could not read {}: {e}", path.display())),
    };
    if serde_json::from_str::<serde_json::Value>(&json).is_ok() {
        return Ok(Some(json));
    }
    // Keep an unreadable file aside instead of overwriting it on the next save.
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default();
    let backup = path.with_file_name(format!("state.unreadable-{stamp}.json"));
    fs::rename(&path, &backup).map_err(|e| format!("Could not set aside {}: {e}", path.display()))?;
    Err(format!(
        "The saved data was unreadable, so it was moved to {} and the app started fresh",
        backup.display()
    ))
}

/// Saves app state atomically: write a temp file, then rename over the old one.
#[tauri::command]
fn save_state(app: AppHandle, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| format!("Refusing to save invalid JSON: {e}"))?;
    let path = state_path(&app)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| format!("Could not write {}: {e}", tmp.display()))?;
    fs::rename(&tmp, &path).map_err(|e| format!("Could not replace {}: {e}", path.display()))
}

/// Receives the PDF as a raw byte body, asks where to save it, and writes it.
/// Returns the saved path, or `None` when the dialog is cancelled.
#[tauri::command]
async fn export_pdf(
    app: AppHandle,
    exported: State<'_, ExportedFiles>,
    request: Request<'_>,
) -> Result<Option<String>, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected the PDF as raw bytes".into());
    };
    if !bytes.starts_with(b"%PDF-") {
        return Err("The data received is not a PDF".into());
    }
    let file_name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .filter(|name| !name.is_empty())
        .unwrap_or("invoice.pdf")
        .to_string();

    let mut dialog = app
        .dialog()
        .file()
        .set_title("Export invoice as PDF")
        .set_file_name(&file_name)
        .add_filter("PDF document", &["pdf"]);
    if let Ok(documents) = app.path().document_dir() {
        dialog = dialog.set_directory(documents);
    }

    // The dialog blocks until the user picks a location, so keep it off the async workers.
    let choice = tauri::async_runtime::spawn_blocking(move || dialog.blocking_save_file())
        .await
        .map_err(|e| format!("The save dialog failed: {e}"))?;
    let Some(choice) = choice else {
        return Ok(None);
    };

    let mut path = choice
        .into_path()
        .map_err(|e| format!("Unsupported save location: {e}"))?;
    let has_pdf_extension = path
        .extension()
        .map(|ext| ext.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);
    if !has_pdf_extension {
        path.set_extension("pdf");
    }

    fs::write(&path, bytes).map_err(|e| format!("Could not save {}: {e}", path.display()))?;
    exported.0.lock().unwrap().insert(path.clone());
    Ok(Some(path.to_string_lossy().into_owned()))
}

fn exported_path(exported: &State<'_, ExportedFiles>, path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    if exported.0.lock().unwrap().contains(&path) {
        Ok(path)
    } else {
        Err("Only invoices exported in this session can be opened".into())
    }
}

/// Opens an exported PDF in the default viewer.
#[tauri::command]
fn open_exported(exported: State<'_, ExportedFiles>, path: String) -> Result<(), String> {
    let path = exported_path(&exported, &path)?;
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}

/// Shows an exported PDF in Finder / File Explorer.
#[tauri::command]
fn reveal_exported(exported: State<'_, ExportedFiles>, path: String) -> Result<(), String> {
    let path = exported_path(&exported, &path)?;
    tauri_plugin_opener::reveal_item_in_dir(path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(ExportedFiles::default())
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            export_pdf,
            open_exported,
            reveal_exported
        ])
        .run(tauri::generate_context!())
        .expect("error while running the invoice generator");
}
