import type { ReactElement } from "react";
import type { Appearance } from "../lib/types";

const ORDER: Appearance[] = ["system", "light", "dark"];
const NAMES: Record<Appearance, string> = { system: "System", light: "Light", dark: "Dark" };

const ICONS: Record<Appearance, ReactElement> = {
  // A display: follow the system setting.
  system: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="2.75" width="12" height="8.5" rx="1.5" />
      <path d="M5.5 13.75h5M8 11.25v2.5" strokeLinecap="round" />
    </svg>
  ),
  light: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="3" />
      <path
        d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"
        strokeLinecap="round"
      />
    </svg>
  ),
  dark: (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M13.2 9.6A5.5 5.5 0 0 1 6.4 2.8a5.5 5.5 0 1 0 6.8 6.8Z" strokeLinejoin="round" />
    </svg>
  ),
};

/** Cycles System, Light, Dark. */
export function AppearanceButton({ value, onChange }: { value: Appearance; onChange: (next: Appearance) => void }) {
  const next = ORDER[(ORDER.indexOf(value) + 1) % ORDER.length];
  const label = `Appearance: ${NAMES[value]}. Switch to ${NAMES[next]}`;
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} onClick={() => onChange(next)}>
      {ICONS[value]}
    </button>
  );
}
