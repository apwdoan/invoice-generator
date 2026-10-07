import type { ProvinceCode } from "./taxRates";

export type PageSize = "LETTER" | "A4";
export type InvoiceFont = "sans" | "serif" | "mono";
/** The app's colour theme. The invoice itself is always printed on white. */
export type Appearance = "system" | "light" | "dark";
export type PaymentTerms = "receipt" | "net15" | "net30" | "net45" | "net60" | "custom";

export interface Logo {
  /** PNG or JPEG data URL, normalised on upload so react-pdf can always embed it. */
  dataUrl: string;
  width: number;
  height: number;
  /** Main colours found in the logo, darkest first. */
  palette: string[];
}

/** The invoice's colour roles. */
export interface BrandColors {
  /** Title, totals, rules and (when dark enough) body text. */
  primary: string;
  /** Amount due and the start of the top band. */
  accent: string;
  /** Where the top band fades to. The same as accent gives a solid band. */
  highlight: string;
}

export interface BusinessProfile {
  name: string;
  logo: Logo | null;
  /** Logo height on the invoice, in PDF points. */
  logoHeight: number;
  /** Hide the name when the logo already contains it (a wordmark). */
  showName: boolean;
  colors: BrandColors;
  font: InvoiceFont;
  address: string;
  email: string;
  phone: string;
  website: string;
  taxNumberLabel: string;
  taxNumber: string;
  extraTaxNumberLabel: string;
  extraTaxNumber: string;
  defaultNotes: string;
  footer: string;
}

export interface Client {
  name: string;
  contact: string;
  email: string;
  address: string;
}

export interface LineItem {
  id: string;
  description: string;
  detail: string;
  /** Kept as strings so fields can be edited freely ("1.", ""). */
  quantity: string;
  unitPrice: string;
  taxable: boolean;
}

export interface TaxLine {
  id: string;
  label: string;
  /** Percentage, e.g. "5" or "9.975". */
  rate: string;
}

export interface Invoice {
  number: string;
  reference: string;
  issueDate: string;
  terms: PaymentTerms;
  dueDate: string;
  currency: string;
  client: Client;
  items: LineItem[];
  taxes: TaxLine[];
  notes: string;
}

export interface Settings {
  pageSize: PageSize;
  appearance: Appearance;
  numberPrefix: string;
  nextNumber: number;
  numberDigits: number;
}

/** Inputs to the tax estimate. Amounts are kept as typed, like invoice fields. */
export interface TaxSettings {
  year: number;
  province: ProvinceCode;
  revenue: string;
  expenses: string;
  employmentIncome: string;
  taxDeductedAtWork: string;
  rrsp: string;
  instalmentsPaid: string;
  gstRegistered: boolean;
  gstMethod: "regular" | "quick";
  /** Percentage of revenue GST/HST is charged on. */
  taxableShare: string;
  gstOnExpenses: string;
}

export interface AppState {
  version: 2;
  profile: BusinessProfile;
  settings: Settings;
  invoice: Invoice;
  clients: Client[];
  tax: TaxSettings;
}
