import type { Invoice, LineItem, TaxLine } from "./types";

/** Parses user-typed numbers such as "1,250.50", "$90" or "". Invalid input counts as 0. */
export function parseAmount(input: string): number {
  const cleaned = String(input).replace(/[\s,$€£]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Rounds half away from zero, after trimming float noise (2.675 * 100 = 267.49999…). */
export function roundCents(value: number): number {
  const trimmed = Number(Math.abs(value).toFixed(6));
  return Math.sign(value) * Math.round(trimmed);
}

export function lineCents(item: LineItem): number {
  const quantity = item.billing === "flat" ? 1 : parseAmount(item.quantity);
  return roundCents(quantity * parseAmount(item.unitPrice) * 100);
}

export interface TaxAmount {
  tax: TaxLine;
  rate: number;
  cents: number;
}

export interface Totals {
  subtotal: number;
  taxableBase: number;
  taxes: TaxAmount[];
  total: number;
}

/**
 * Items that should appear on the invoice: anything with a description or a non-zero amount.
 * Under one flat rate the items have no amounts of their own, so any item with text counts.
 */
export function billableItems(invoice: Pick<Invoice, "items" | "pricing">): LineItem[] {
  if (invoice.pricing === "flat") {
    return invoice.items.filter((item) => item.description.trim() !== "" || item.detail.trim() !== "");
  }
  return invoice.items.filter((item) => item.description.trim() !== "" || lineCents(item) !== 0);
}

export function flatFeeCents(invoice: Pick<Invoice, "flatFee">): number {
  return roundCents(parseAmount(invoice.flatFee) * 100);
}

/** One flat rate is taxed as a whole; per-item pricing taxes only the items marked taxable. */
export function computeTotals(invoice: Invoice): Totals {
  let subtotal = 0;
  let taxableBase = 0;
  if (invoice.pricing === "flat") {
    subtotal = taxableBase = flatFeeCents(invoice);
  } else {
    for (const item of billableItems(invoice)) {
      const cents = lineCents(item);
      subtotal += cents;
      if (item.taxable) taxableBase += cents;
    }
  }
  const taxes = invoice.taxes
    .filter((tax) => tax.label.trim() !== "" || parseAmount(tax.rate) !== 0)
    .map((tax) => {
      const rate = parseAmount(tax.rate);
      return { tax, rate, cents: roundCents((taxableBase * rate) / 100) };
    });
  const total = subtotal + taxes.reduce((sum, t) => sum + t.cents, 0);
  return { subtotal, taxableBase, taxes, total };
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: number, currency: string): string {
  let fmt = moneyFormatters.get(currency);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
      });
    } catch {
      fmt = new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    moneyFormatters.set(currency, fmt);
  }
  // Avoid "-$0.00" from negative zero.
  return fmt.format(cents / 100 || 0);
}

/** The symbol shown in front of amounts typed in a currency: "$" for CAD, USD and AUD, "€", "£". */
export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en-CA", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? "";
  } catch {
    return "";
  }
}

const quantityFormatter = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 3 });

export function formatQuantity(input: string): string {
  return quantityFormatter.format(parseAmount(input));
}

export function formatRate(rate: number): string {
  return `${new Intl.NumberFormat("en-CA", { maximumFractionDigits: 3 }).format(rate)}%`;
}

export const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD"] as const;
