import { getCurrentWindow } from "@tauri-apps/api/window";
import { inDesktopApp } from "./native";
import type { Appearance } from "./types";

/**
 * Light and Dark are set on <html data-theme>; System leaves it off so the CSS follows
 * prefers-color-scheme. The choice is saved with the rest of the app's data, and copied to
 * localStorage so the next launch can apply it before that data has loaded.
 */

const CACHE_KEY = "invoice-generator-appearance";

function setWindowTheme(appearance: Appearance) {
  if (!inDesktopApp) return;
  // Keeps the native title bar in step. Cosmetic, so a failure is ignored.
  getCurrentWindow()
    .setTheme(appearance === "system" ? null : appearance)
    .catch(() => undefined);
}

export function applyAppearance(appearance: Appearance) {
  const root = document.documentElement;
  if (appearance === "system") delete root.dataset.theme;
  else root.dataset.theme = appearance;
  setWindowTheme(appearance);
  try {
    localStorage.setItem(CACHE_KEY, appearance);
  } catch {
    /* storage unavailable: the saved setting still applies once it loads */
  }
}

/** Applies the last-used appearance at startup, before saved data has loaded. */
export function applyCachedAppearance() {
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(CACHE_KEY);
  } catch {
    return;
  }
  if (cached === "light" || cached === "dark") applyAppearance(cached);
}
