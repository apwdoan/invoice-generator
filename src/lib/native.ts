import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * Everything that touches the desktop lives here. When the UI runs in a plain
 * browser (npm run dev), it falls back to localStorage and a download link so
 * the interface can still be worked on without the Rust side.
 */

const STORAGE_KEY = "invoice-generator-state";
export const inDesktopApp = isTauri();

export async function loadState(): Promise<string | null> {
  if (inDesktopApp) return invoke<string | null>("load_state");
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function saveState(json: string): Promise<void> {
  if (inDesktopApp) {
    await invoke("save_state", { json });
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* storage unavailable: nothing to persist to */
  }
}

/** Header values must be plain ASCII, so the suggested file name is simplified. */
export function safeFileName(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ._-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${ascii || "invoice"}.pdf`;
}

/**
 * Asks where to save and writes the PDF. Resolves to the saved path,
 * or null if the save dialog was cancelled.
 */
export async function exportPdf(bytes: Uint8Array, fileName: string): Promise<string | null> {
  if (inDesktopApp) {
    return invoke<string | null>("export_pdf", bytes, {
      headers: { "x-file-name": fileName },
    });
  }
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return fileName;
}

export async function openExported(path: string): Promise<void> {
  if (inDesktopApp) await invoke("open_exported", { path });
}

export async function revealExported(path: string): Promise<void> {
  if (inDesktopApp) await invoke("reveal_exported", { path });
}

export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
