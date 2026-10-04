import { dueDateFor, todayIso } from "./dates";
import type { AppState, BusinessProfile, Client, Invoice, LineItem, Settings, TaxLine } from "./types";

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyItem(): LineItem {
  return { id: newId(), description: "", detail: "", quantity: "1", unitPrice: "", taxable: true };
}

export function emptyClient(): Client {
  return { name: "", contact: "", email: "", address: "" };
}

export interface TaxPreset {
  id: string;
  label: string;
  taxes: { label: string; rate: string }[];
}

/** Rates as published by the CRA (Nova Scotia HST is 14% since April 1, 2025). */
export const TAX_PRESETS: TaxPreset[] = [
  { id: "gst", label: "GST 5% (AB, NT, NU, YT)", taxes: [{ label: "GST", rate: "5" }] },
  { id: "hst13", label: "HST 13% (ON)", taxes: [{ label: "HST", rate: "13" }] },
  { id: "hst14", label: "HST 14% (NS)", taxes: [{ label: "HST", rate: "14" }] },
  { id: "hst15", label: "HST 15% (NB, NL, PE)", taxes: [{ label: "HST", rate: "15" }] },
  {
    id: "bc",
    label: "GST 5% + PST 7% (BC)",
    taxes: [
      { label: "GST", rate: "5" },
      { label: "PST", rate: "7" },
    ],
  },
  {
    id: "mb",
    label: "GST 5% + RST 7% (MB)",
    taxes: [
      { label: "GST", rate: "5" },
      { label: "RST", rate: "7" },
    ],
  },
  {
    id: "sk",
    label: "GST 5% + PST 6% (SK)",
    taxes: [
      { label: "GST", rate: "5" },
      { label: "PST", rate: "6" },
    ],
  },
  {
    id: "qc",
    label: "GST 5% + QST 9.975% (QC)",
    taxes: [
      { label: "GST", rate: "5" },
      { label: "QST", rate: "9.975" },
    ],
  },
  { id: "none", label: "No tax", taxes: [] },
];

export function taxesFromPreset(preset: TaxPreset): TaxLine[] {
  return preset.taxes.map((t) => ({ id: newId(), ...t }));
}

export const ACCENTS = ["#23395B", "#1E6B52", "#7A2E3A", "#B4531A", "#5B3E8C", "#2A2F36"];

export const defaultProfile: BusinessProfile = {
  name: "Abstraction Software Development",
  logo: null,
  logoHeight: 44,
  showName: true,
  accent: ACCENTS[0],
  font: "sans",
  address: "",
  email: "",
  phone: "",
  website: "",
  taxNumberLabel: "GST/HST No.",
  taxNumber: "",
  extraTaxNumberLabel: "",
  extraTaxNumber: "",
  defaultNotes: "",
  footer: "Thank you for your business.",
};

export const defaultSettings: Settings = {
  pageSize: "LETTER",
  numberPrefix: "INV-",
  nextNumber: 1,
  numberDigits: 4,
};

export function formatInvoiceNumber(settings: Settings, n: number): string {
  return `${settings.numberPrefix}${String(n).padStart(settings.numberDigits, "0")}`;
}

export function newInvoice(profile: BusinessProfile, settings: Settings, previous?: Invoice): Invoice {
  const issueDate = todayIso();
  const terms = previous?.terms ?? "net30";
  return {
    number: formatInvoiceNumber(settings, settings.nextNumber),
    reference: "",
    issueDate,
    terms,
    dueDate: dueDateFor(issueDate, terms, issueDate),
    currency: previous?.currency ?? "CAD",
    client: emptyClient(),
    items: [emptyItem()],
    taxes: previous ? previous.taxes.map((t) => ({ ...t, id: newId() })) : taxesFromPreset(TAX_PRESETS[0]),
    notes: profile.defaultNotes,
  };
}

/** A fresh first-run state: invoice #1 is in use, so the counter moves to 2. */
export function initialState(): AppState {
  const settings = { ...defaultSettings };
  const invoice = newInvoice(defaultProfile, settings);
  return {
    version: 1,
    profile: { ...defaultProfile },
    settings: { ...settings, nextNumber: settings.nextNumber + 1 },
    invoice,
    clients: [],
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Fills in anything missing from a saved file, so older saves keep loading. */
export function hydrate(raw: unknown): AppState {
  const base = initialState();
  if (!isObject(raw)) return base;
  const profile = { ...base.profile, ...(isObject(raw.profile) ? raw.profile : {}) } as BusinessProfile;
  const settings = { ...base.settings, ...(isObject(raw.settings) ? raw.settings : {}) } as Settings;
  const rawInvoice = isObject(raw.invoice) ? raw.invoice : {};
  const invoice = {
    ...base.invoice,
    ...rawInvoice,
    client: { ...emptyClient(), ...(isObject(rawInvoice.client) ? rawInvoice.client : {}) },
    items: Array.isArray(rawInvoice.items)
      ? rawInvoice.items.filter(isObject).map((item) => ({ ...emptyItem(), ...item }))
      : base.invoice.items,
    taxes: Array.isArray(rawInvoice.taxes)
      ? rawInvoice.taxes.filter(isObject).map((t) => ({ id: newId(), label: "", rate: "", ...t }))
      : base.invoice.taxes,
  } as Invoice;
  const clients = Array.isArray(raw.clients)
    ? (raw.clients.filter(isObject).map((c) => ({ ...emptyClient(), ...c })) as Client[])
    : [];
  return { version: 1, profile, settings, invoice, clients };
}

/** Adds or refreshes a client in the saved list, matched by name. Most recent first. */
export function rememberClient(clients: Client[], client: Client): Client[] {
  const key = client.name.trim().toLowerCase();
  if (!key) return clients;
  const rest = clients.filter((c) => c.name.trim().toLowerCase() !== key);
  return [{ ...client }, ...rest].slice(0, 50);
}
