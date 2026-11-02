import type { PaymentTerms } from "./types";

export const TERMS: { value: PaymentTerms; label: string }[] = [
  { value: "receipt", label: "Due immediately" },
  { value: "net", label: "Net" },
  { value: "custom", label: "Custom date" },
];

export const DEFAULT_NET_DAYS = "30";

export function isTerms(value: unknown): value is PaymentTerms {
  return TERMS.some((t) => t.value === value);
}

/** Whole days from what was typed ("30" is 30). Blank or anything else is null. */
export function parseDays(input: string): number | null {
  const trimmed = String(input).trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  return Number(trimmed);
}

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

/**
 * The due date for the terms. Custom terms keep the current date, as does a
 * net invoice while its days field is blank.
 */
export function dueDateFor(issueDate: string, terms: PaymentTerms, netDays: string, current: string): string {
  if (terms === "receipt") return issueDate;
  const days = terms === "net" ? parseDays(netDays) : null;
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

/** How the terms read on the invoice: "Due immediately", "Net 21 days". Custom dates need no label. */
export function termsLabel(terms: PaymentTerms, netDays: string): string {
  if (terms === "receipt") return "Due immediately";
  if (terms !== "net") return "";
  const days = parseDays(netDays);
  if (days == null) return "";
  if (days === 0) return "Due immediately";
  return `Net ${days} ${days === 1 ? "day" : "days"}`;
}
