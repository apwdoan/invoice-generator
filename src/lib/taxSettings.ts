import { parseAmount } from "./money";
import { estimateTaxes, type Estimate, type EstimateInput } from "./taxEstimate";
import { LATEST_TAX_YEAR, TAX_YEARS } from "./taxRates";
import type { TaxSettings } from "./types";

export function toEstimateInput(s: TaxSettings): EstimateInput {
  const share = s.taxableShare.trim() === "" ? 100 : parseAmount(s.taxableShare);
  return {
    province: s.province,
    revenue: parseAmount(s.revenue),
    expenses: parseAmount(s.expenses),
    employmentIncome: parseAmount(s.employmentIncome),
    rrsp: parseAmount(s.rrsp),
    taxDeductedAtWork: parseAmount(s.taxDeductedAtWork),
    instalmentsPaid: parseAmount(s.instalmentsPaid),
    gstRegistered: s.gstRegistered,
    gstMethod: s.gstMethod,
    taxableShare: Math.min(100, Math.max(0, share)) / 100,
    gstOnExpenses: parseAmount(s.gstOnExpenses),
  };
}

export function estimateFor(s: TaxSettings): Estimate {
  return estimateTaxes(TAX_YEARS[s.year] ?? TAX_YEARS[LATEST_TAX_YEAR], toEstimateInput(s));
}

const dollars = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** Whole dollars, for estimates: "$12,345". Negative zero shows as "$0". */
export function formatDollars(amount: number): string {
  return dollars.format(Math.round(amount) || 0);
}

export function formatPercent(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits).replace(/\.0+$/, "")}%`;
}

/** Tidies a typed amount on blur: "85000" becomes "85,000", "1234.5" becomes "1,234.50". */
export function tidyAmount(input: string): string {
  if (input.trim() === "") return "";
  const n = Math.abs(parseAmount(input));
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return n.toLocaleString("en-CA", { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 });
}
