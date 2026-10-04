export type PageSize = "LETTER" | "A4";
export type InvoiceFont = "sans" | "serif" | "mono";
export type PaymentTerms = "receipt" | "net15" | "net30" | "net45" | "net60" | "custom";

export interface Logo {
  /** PNG data URL, normalised on upload so react-pdf can always embed it. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface BusinessProfile {
  name: string;
  logo: Logo | null;
  /** Logo height on the invoice, in PDF points. */
  logoHeight: number;
  /** Hide the name when the logo already contains it (a wordmark). */
  showName: boolean;
  accent: string;
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
  numberPrefix: string;
  nextNumber: number;
  numberDigits: number;
}

export interface AppState {
  version: 1;
  profile: BusinessProfile;
  settings: Settings;
  invoice: Invoice;
  clients: Client[];
}
