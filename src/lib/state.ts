import { isHexColor } from "./color";
import { dueDateFor, todayIso } from "./dates";
import type { AppState, BrandColors, BusinessProfile, Client, Invoice, LineItem, Logo, Settings, TaxLine } from "./types";

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

/** Offered when there is no logo to take colours from. */
export const PRESET_COLORS = ["#2A2F36", "#1B2A4A", "#23395B", "#1E6B52", "#7A2E3A", "#B4531A", "#5B3E8C"];

/** Neutral charcoal, so any logo's colours can replace it. */
export const NEUTRAL_COLORS = { primary: "#2A2F36", accent: "#2A2F36", highlight: "#2A2F36" };

/** Logo height in points for a newly uploaded logo: stacked or square logos need more height than wide wordmarks. */
export function logoHeightFor(width: number, height: number): number {
  const ratio = width / Math.max(1, height);
  if (ratio < 1.5) return 80;
  if (ratio < 3) return 60;
  return 44;
}

export const defaultProfile: BusinessProfile = {
  name: "",
  logo: null,
  logoHeight: 56,
  showName: true,
  colors: { ...NEUTRAL_COLORS },
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
export function initialState(defaults: BusinessProfile = defaultProfile): AppState {
  const settings = { ...defaultSettings };
  const invoice = newInvoice(defaults, settings);
  return {
    version: 2,
    profile: { ...defaults },
    settings: { ...settings, nextNumber: settings.nextNumber + 1 },
    invoice,
    clients: [],
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hydrateColors(raw: unknown, fallback: BrandColors): BrandColors {
  const colors = isObject(raw) ? raw : {};
  const pick = (key: keyof BrandColors, backup: string) =>
    typeof colors[key] === "string" && isHexColor(colors[key] as string) ? (colors[key] as string) : backup;
  const primary = pick("primary", fallback.primary);
  const accent = pick("accent", fallback.accent);
  return { primary, accent, highlight: pick("highlight", accent) };
}

function hydrateLogo(raw: unknown): Logo | null {
  if (!isObject(raw) || typeof raw.dataUrl !== "string") return null;
  return {
    dataUrl: raw.dataUrl,
    width: Number(raw.width) || 1,
    height: Number(raw.height) || 1,
    palette: Array.isArray(raw.palette) ? raw.palette.filter((c): c is string => typeof c === "string" && isHexColor(c)) : [],
  };
}

/**
 * Fills in anything missing from a saved file, so older saves keep loading.
 * Version 1 had one brand colour (`accent`); it becomes all three colour roles.
 */
export function hydrate(raw: unknown, defaults: BusinessProfile = defaultProfile): AppState {
  const base = initialState(defaults);
  if (!isObject(raw)) return base;
  const rawProfile = isObject(raw.profile) ? raw.profile : {};
  const { accent: v1Accent, colors: rawColors, logo: rawLogo, ...rest } = rawProfile;
  let profile = { ...base.profile, ...rest, logo: hydrateLogo(rawLogo) } as BusinessProfile;
  if (raw.version !== 2 && typeof v1Accent === "string") {
    profile = { ...profile, colors: hydrateColors({ primary: v1Accent, accent: v1Accent }, defaults.colors) };
  } else {
    profile.colors = hydrateColors(rawColors, defaults.colors);
  }
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
  return { version: 2, profile, settings, invoice, clients };
}

/** Adds or refreshes a client in the saved list, matched by name. Most recent first. */
export function rememberClient(clients: Client[], client: Client): Client[] {
  const key = client.name.trim().toLowerCase();
  if (!key) return clients;
  const rest = clients.filter((c) => c.name.trim().toLowerCase() !== key);
  return [{ ...client }, ...rest].slice(0, 50);
}
