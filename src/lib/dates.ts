import type { PaymentTerms } from "./types";

export const TERMS: { value: PaymentTerms; label: string; days: number | null }[] = [
  { value: "receipt", label: "Due on receipt", days: 0 },
  { value: "net15", label: "Net 15", days: 15 },
  { value: "net30", label: "Net 30", days: 30 },
  { value: "net45", label: "Net 45", days: 45 },
  { value: "net60", label: "Net 60", days: 60 },
  { value: "custom", label: "Custom date", days: null },
];

/** Today's local date as YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  if (!d) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Recomputes the due date unless the terms are custom. */
export function dueDateFor(issueDate: string, terms: PaymentTerms, current: string): string {
  const days = TERMS.find((t) => t.value === terms)?.days;
  return days == null ? current || issueDate : addDays(issueDate, days);
}

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string): string {
  const d = parseIso(iso);
  return d ? dateFormatter.format(d) : "";
}

export function termsLabel(terms: PaymentTerms): string {
  return TERMS.find((t) => t.value === terms)?.label ?? "";
}
