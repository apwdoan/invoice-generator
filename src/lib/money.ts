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
  return roundCents(parseAmount(item.quantity) * parseAmount(item.unitPrice) * 100);
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

/** Items that should appear on the invoice: anything with a description or a non-zero amount. */
export function billableItems(items: LineItem[]): LineItem[] {
  return items.filter((item) => item.description.trim() !== "" || lineCents(item) !== 0);
}

export function computeTotals(invoice: Invoice): Totals {
  const items = billableItems(invoice.items);
  let subtotal = 0;
  let taxableBase = 0;
  for (const item of items) {
    const cents = lineCents(item);
    subtotal += cents;
    if (item.taxable) taxableBase += cents;
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

const quantityFormatter = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 3 });

export function formatQuantity(input: string): string {
  return quantityFormatter.format(parseAmount(input));
}

export function formatRate(rate: number): string {
  return `${new Intl.NumberFormat("en-CA", { maximumFractionDigits: 3 }).format(rate)}%`;
}

export const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD"] as const;
