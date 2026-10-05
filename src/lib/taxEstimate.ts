import { roundCents } from "./money";
import type { Bracket, PensionPlan, PhasedAmount, ProvinceCode, ProvinceRates, TaxYearRates } from "./taxRates";

/**
 * Estimates a sole proprietor's income tax, CPP/QPP and GST/HST for a year.
 *
 * It follows the T1 return in simplified form: business income plus any employment income, less the
 * deductible part of CPP/QPP (and QPIP in Québec), less RRSP-type deductions, gives taxable income.
 * Federal and provincial tax are then worked out with the basic personal amount and the credits for
 * CPP/QPP, EI and QPIP. Other credits (tuition, medical, donations, dependants) are not included.
 *
 * Amounts are in dollars. Results are rounded to cents; work in between is not, so a line may differ
 * from the return by a cent.
 */

export type GstMethod = "regular" | "quick";

export interface EstimateInput {
  province: ProvinceCode;
  /** Business revenue for the year, before GST/HST. */
  revenue: number;
  /** Deductible business expenses, not counting GST/HST you claim back. */
  expenses: number;
  /** Employment income (T4), assumed to be from one employer and fully pensionable and insurable. */
  employmentIncome: number;
  /** RRSP, FHSA and similar deductions. */
  rrsp: number;
  taxDeductedAtWork: number;
  instalmentsPaid: number;
  gstRegistered: boolean;
  gstMethod: GstMethod;
  /** Share of revenue GST/HST is charged on, from 0 to 1 (exports and some clients are zero-rated). */
  taxableShare: number;
  /** GST/HST paid on business expenses, claimed back as input tax credits under the regular method. */
  gstOnExpenses: number;
}

export interface SalesTaxResult {
  label: "GST" | "HST";
  rate: number;
  registered: boolean;
  /** Not registered, but revenue is past the small supplier limit. */
  mustRegister: boolean;
  /** The method actually used: the Quick Method falls back to regular above its limit. */
  method: GstMethod;
  quickAvailable: boolean;
  quickRate: number;
  collected: number;
  inputCredits: number;
  quickCredit: number;
  /** Negative when the input tax credits are larger than the tax collected (a refund). */
  remit: number;
  /** Quick Method only: tax collected but not remitted. It counts as business income. */
  kept: number;
}

export interface PensionResult {
  plan: "CPP" | "QPP";
  /** Base and first additional contributions on self-employment income, both halves. */
  selfEmployedBase: number;
  /** Second additional contributions (CPP2/QPP2) on self-employment income, both halves. */
  selfEmployedSecond: number;
  selfEmployed: number;
  /** Withheld by an employer (the employee half only). */
  employment: number;
  /** Deducted from income: the employer half and all enhanced contributions. */
  deduction: number;
  /** Claimed as a credit: the employee half of base contributions. */
  creditAmount: number;
}

export interface FederalResult {
  bracketTax: number;
  basicPersonalAmount: number;
  /** Value of the non-refundable credits (amounts times the lowest rate). */
  credits: number;
  /** Québec abatement. */
  abatement: number;
  tax: number;
}

export interface ProvincialResult {
  name: string;
  taxableIncome: number;
  bracketTax: number;
  basicPersonalAmount: number;
  credits: number;
  surtax: number;
  reduction: number;
  healthPremium: number;
  tax: number;
}

export interface Estimate {
  year: number;
  province: ProvinceCode;
  revenue: number;
  expenses: number;
  /** Quick Method gain included in business income. */
  quickMethodIncome: number;
  netBusinessIncome: number;
  employmentIncome: number;
  pensionDeduction: number;
  qpipDeduction: number;
  rrspDeduction: number;
  /** Québec deduction for workers (Québec return only). */
  workerDeduction: number;
  netIncome: number;
  taxableIncome: number;
  pension: PensionResult;
  ei: number;
  qpipEmployment: number;
  qpipSelfEmployed: number;
  /** Québec Health Services Fund contribution. */
  healthServicesFund: number;
  federal: FederalResult;
  provincial: ProvincialResult;
  incomeTax: number;
  /** Paid with the return: CPP/QPP and QPIP on self-employment income, and the Health Services Fund. */
  contributions: number;
  /** Income tax plus contributions for the year. */
  total: number;
  taxDeductedAtWork: number;
  instalmentsPaid: number;
  /** Total less tax deducted at work: the basis for instalments. */
  netOwing: number;
  /** What is left to pay after instalments already made. Negative is a refund. */
  balance: number;
  quarterlyInstalment: number;
  instalmentThreshold: number;
  instalmentsLikely: boolean;
  /** The part of the year's tax that the business adds, on top of tax on other income. */
  business: {
    incomeTax: number;
    contributions: number;
    total: number;
    /** Share of each invoice (before sales tax) to put aside for income tax and contributions. */
    setAsideRate: number;
    /** Tax and contributions on the next dollar of revenue. */
    marginalRate: number;
    /** Revenue left after expenses, tax and contributions (plus any Quick Method gain). */
    kept: number;
  };
  salesTax: SalesTaxResult;
}

const money = (n: number) => roundCents(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const positive = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);

/** Tax on `income` across progressive brackets. */
export function bracketTax(brackets: Bracket[], income: number): number {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const from = brackets[i].from;
    const to = brackets[i + 1]?.from ?? Infinity;
    if (income <= from) break;
    tax += (Math.min(income, to) - from) * brackets[i].rate;
  }
  return tax;
}

/** The marginal bracket rate at `income`. */
export function bracketRate(brackets: Bracket[], income: number): number {
  let rate = 0;
  for (const b of brackets) if (income > b.from) rate = b.rate;
  return rate;
}

export function phasedAmount(amount: number | PhasedAmount, netIncome: number): number {
  if (typeof amount === "number") return amount;
  if (netIncome <= amount.from) return amount.max;
  if (netIncome >= amount.to) return amount.min;
  return amount.max - ((netIncome - amount.from) * (amount.max - amount.min)) / (amount.to - amount.from);
}

/** CPP or QPP on employment and self-employment earnings, with the basic exemption shared between them. */
function pensionContributions(rates: TaxYearRates, plan: PensionPlan, employment: number, selfEmployment: number) {
  const { ympe, yampe, basicExemption } = rates.pension;
  const firstRate = plan.baseRate + plan.firstAdditionalRate;
  const band1 = (earnings: number) => clamp(earnings - basicExemption, 0, ympe - basicExemption);
  const band2 = (earnings: number) => clamp(earnings - ympe, 0, yampe - ympe);
  const employee1 = firstRate * band1(employment);
  const employee2 = plan.secondAdditionalRate * band2(employment);
  const combined = employment + selfEmployment;
  // The self-employed owe both halves of whatever the employer did not already cover.
  const self1 = 2 * Math.max(0, firstRate * band1(combined) - employee1);
  const self2 = 2 * Math.max(0, plan.secondAdditionalRate * band2(combined) - employee2);
  const baseShare = plan.baseRate / firstRate;
  // Employer halves and enhanced contributions are deducted; the employee half of base contributions is a credit.
  const selfDeduction = self1 / 2 + (self1 / 2) * (1 - baseShare) + self2;
  return {
    plan: plan.name,
    employee: employee1 + employee2,
    self1,
    self2,
    creditAmount: (employee1 + self1 / 2) * baseShare,
    selfDeduction,
    deduction: employee1 * (1 - baseShare) + employee2 + selfDeduction,
  };
}

export function federalIncomeTax(
  rates: TaxYearRates,
  args: { taxableIncome: number; netIncome: number; otherCredits: number; quebec: boolean },
): FederalResult {
  const { brackets, basicPersonalAmount, quebecAbatement } = rates.federal;
  const bpa = phasedAmount(basicPersonalAmount, args.netIncome);
  const gross = bracketTax(brackets, args.taxableIncome);
  const credits = brackets[0].rate * (bpa + args.otherCredits);
  const basic = Math.max(0, gross - credits);
  const abatement = args.quebec ? basic * quebecAbatement : 0;
  return { bracketTax: gross, basicPersonalAmount: bpa, credits, abatement, tax: basic - abatement };
}

function healthPremium(tiers: NonNullable<ProvinceRates["healthPremium"]>, taxableIncome: number): number {
  let premium = 0;
  let previousCap = 0;
  for (const tier of tiers) {
    if (taxableIncome <= tier.from) break;
    premium = Math.min(tier.cap, previousCap + tier.rate * (taxableIncome - tier.from));
    previousCap = tier.cap;
  }
  return premium;
}

/** Provincial or territorial tax outside Québec. */
export function provincialIncomeTax(
  rates: TaxYearRates,
  code: ProvinceCode,
  args: { taxableIncome: number; netIncome: number; otherCredits: number; employmentIncome: number },
): ProvincialResult {
  const p = rates.provinces[code];
  const bpa = phasedAmount(p.basicPersonalAmount, args.netIncome);
  const amounts =
    bpa +
    args.otherCredits +
    (p.employmentAmountCredit ? Math.min(positive(args.employmentIncome), rates.federal.employmentAmount) : 0);
  const lowest = p.brackets[0].rate;
  let credits = lowest * amounts;
  if (p.supplementalCredit) {
    credits += (p.supplementalCredit.rate - lowest) * Math.max(0, amounts - p.supplementalCredit.above);
  }
  const gross = bracketTax(p.brackets, args.taxableIncome);
  const basic = Math.max(0, gross - credits);
  const surtax = (p.surtax ?? []).reduce((sum, s) => sum + s.rate * Math.max(0, basic - s.over), 0);
  let reduction = 0;
  if (p.taxReduction?.kind === "bc") {
    const r = p.taxReduction;
    reduction = Math.min(basic, Math.max(0, r.amount - r.rate * Math.max(0, args.netIncome - r.from)));
  } else if (p.taxReduction?.kind === "on") {
    const owing = basic + surtax;
    reduction = Math.min(owing, Math.max(0, 2 * p.taxReduction.basic - owing));
  }
  const premium = p.healthPremium ? healthPremium(p.healthPremium, args.taxableIncome) : 0;
  return {
    name: p.name,
    taxableIncome: args.taxableIncome,
    bracketTax: gross,
    basicPersonalAmount: bpa,
    credits,
    surtax,
    reduction,
    healthPremium: premium,
    tax: basic + surtax - reduction + premium,
  };
}

/**
 * Québec tax. QPP, EI and QPIP have no separate credits on the Québec return: they are folded into
 * the basic personal amount.
 */
export function quebecIncomeTax(rates: TaxYearRates, taxableIncome: number): ProvincialResult {
  const p = rates.provinces.QC;
  const bpa = phasedAmount(p.basicPersonalAmount, taxableIncome);
  const gross = bracketTax(p.brackets, taxableIncome);
  const credits = p.brackets[0].rate * bpa;
  return {
    name: p.name,
    taxableIncome,
    bracketTax: gross,
    basicPersonalAmount: bpa,
    credits,
    surtax: 0,
    reduction: 0,
    healthPremium: 0,
    tax: Math.max(0, gross - credits),
  };
}

function healthServicesFund(rates: TaxYearRates, income: number): number {
  const f = rates.quebec.healthServicesFund;
  if (income <= f.first) return 0;
  if (income <= f.second) return Math.min(f.firstMax, f.rate * (income - f.first));
  return Math.min(f.max, f.firstMax + f.rate * (income - f.second));
}

export function salesTaxFor(rates: TaxYearRates, input: EstimateInput): SalesTaxResult {
  const st = rates.provinces[input.province].salesTax;
  const revenue = positive(input.revenue);
  const taxable = revenue * clamp(Number.isFinite(input.taxableShare) ? input.taxableShare : 1, 0, 1);
  const registered = input.gstRegistered;
  const quickAvailable = revenue <= rates.gst.quickMethodLimit;
  const method: GstMethod = input.gstMethod === "quick" && quickAvailable ? "quick" : "regular";
  const base = {
    label: st.label,
    rate: st.rate,
    registered,
    mustRegister: !registered && revenue > rates.gst.smallSupplierLimit,
    method,
    quickAvailable,
    quickRate: st.quickRate,
    collected: 0,
    inputCredits: 0,
    quickCredit: 0,
    remit: 0,
    kept: 0,
  };
  if (!registered) return base;
  const collected = taxable * st.rate;
  if (method === "quick") {
    const salesWithTax = taxable * (1 + st.rate);
    const gross = salesWithTax * st.quickRate;
    const quickCredit = Math.min(gross, rates.gst.quickCreditRate * Math.min(salesWithTax, rates.gst.quickCreditOn));
    const remit = gross - quickCredit;
    return { ...base, collected, quickCredit, remit, kept: collected - remit };
  }
  const inputCredits = positive(input.gstOnExpenses);
  return { ...base, collected, inputCredits, remit: collected - inputCredits };
}

/** The year's figures without the business-only comparisons. */
function core(rates: TaxYearRates, input: EstimateInput) {
  const quebec = input.province === "QC";
  const revenue = positive(input.revenue);
  const expenses = positive(input.expenses);
  const employment = positive(input.employmentIncome);
  const salesTax = salesTaxFor(rates, input);
  const netBusiness = revenue - expenses + salesTax.kept;
  const selfEmployment = Math.max(0, netBusiness);

  const pension = pensionContributions(
    rates,
    quebec ? rates.pension.qpp : rates.pension.cpp,
    employment,
    selfEmployment,
  );

  // EI and QPIP premiums are refunded when insurable earnings are under $2,000.
  const insured = employment >= 2_000;
  const ei = insured ? Math.min(employment, rates.ei.maxInsurable) * (quebec ? rates.ei.quebecRate : rates.ei.rate) : 0;
  const q = rates.qpip;
  const qpipEmployment = quebec && insured ? Math.min(employment, q.maxInsurable) * q.employeeRate : 0;
  const qpipSelfEmployed =
    quebec && selfEmployment >= q.selfEmployedMinimum
      ? q.selfEmployedRate *
        Math.max(0, Math.min(employment + selfEmployment, q.maxInsurable) - Math.min(employment, q.maxInsurable))
      : 0;
  // The employee-equivalent part of self-employed QPIP is a federal credit; the rest is deductible.
  const qpipEmployeeShare = q.employeeRate / q.selfEmployedRate;
  const qpipDeduction = qpipSelfEmployed * (1 - qpipEmployeeShare);
  const qpipCredit = qpipEmployment + qpipSelfEmployed * qpipEmployeeShare;

  const beforeRrsp = employment + netBusiness - pension.deduction - qpipDeduction;
  const rrsp = Math.min(positive(input.rrsp), Math.max(0, beforeRrsp));
  const netIncome = beforeRrsp - rrsp;
  const taxableIncome = Math.max(0, netIncome);

  const federal = federalIncomeTax(rates, {
    taxableIncome,
    netIncome,
    otherCredits: pension.creditAmount + ei + qpipCredit + Math.min(employment, rates.federal.employmentAmount),
    quebec,
  });

  let workerDeduction = 0;
  let provincial: ProvincialResult;
  let hsf = 0;
  if (quebec) {
    const w = rates.quebec.workerDeduction;
    workerDeduction = Math.min(w.max, w.rate * (employment + selfEmployment));
    provincial = quebecIncomeTax(rates, Math.max(0, netIncome - workerDeduction));
    // The contribution is on income other than employment income: here, business income after its deductions.
    hsf = healthServicesFund(rates, Math.max(0, netBusiness - pension.selfDeduction - qpipDeduction));
  } else {
    provincial = provincialIncomeTax(rates, input.province, {
      taxableIncome,
      netIncome,
      otherCredits: pension.creditAmount + ei,
      employmentIncome: employment,
    });
  }

  const incomeTax = federal.tax + provincial.tax;
  const contributions = pension.self1 + pension.self2 + qpipSelfEmployed + hsf;
  return {
    revenue,
    expenses,
    employment,
    salesTax,
    netBusiness,
    pension,
    ei,
    qpipEmployment,
    qpipSelfEmployed,
    qpipDeduction,
    rrsp,
    workerDeduction,
    netIncome,
    taxableIncome,
    federal,
    provincial,
    hsf,
    incomeTax,
    contributions,
    total: incomeTax + contributions,
  };
}

function roundFederal(f: FederalResult): FederalResult {
  return {
    bracketTax: money(f.bracketTax),
    basicPersonalAmount: money(f.basicPersonalAmount),
    credits: money(f.credits),
    abatement: money(f.abatement),
    tax: money(f.tax),
  };
}

function roundProvincial(p: ProvincialResult): ProvincialResult {
  return {
    ...p,
    taxableIncome: money(p.taxableIncome),
    bracketTax: money(p.bracketTax),
    basicPersonalAmount: money(p.basicPersonalAmount),
    credits: money(p.credits),
    surtax: money(p.surtax),
    reduction: money(p.reduction),
    healthPremium: money(p.healthPremium),
    tax: money(p.tax),
  };
}

export function estimateTaxes(rates: TaxYearRates, input: EstimateInput): Estimate {
  const c = core(rates, input);
  const withoutBusiness = core(rates, { ...input, revenue: 0, expenses: 0, gstRegistered: false });
  const step = 1_000;
  const bumped = core(rates, { ...input, revenue: c.revenue + step });

  const bizIncomeTax = c.incomeTax - withoutBusiness.incomeTax;
  const bizContributions = c.contributions - withoutBusiness.contributions;
  const bizTotal = bizIncomeTax + bizContributions;

  const taxDeductedAtWork = positive(input.taxDeductedAtWork);
  const instalmentsPaid = positive(input.instalmentsPaid);
  const netOwing = c.total - taxDeductedAtWork;
  const instalmentThreshold = input.province === "QC" ? rates.instalments.quebecThreshold : rates.instalments.threshold;

  const st = c.salesTax;
  const p = c.pension;
  return {
    year: rates.year,
    province: input.province,
    revenue: money(c.revenue),
    expenses: money(c.expenses),
    quickMethodIncome: money(st.kept),
    netBusinessIncome: money(c.netBusiness),
    employmentIncome: money(c.employment),
    pensionDeduction: money(p.deduction),
    qpipDeduction: money(c.qpipDeduction),
    rrspDeduction: money(c.rrsp),
    workerDeduction: money(c.workerDeduction),
    netIncome: money(c.netIncome),
    taxableIncome: money(c.taxableIncome),
    pension: {
      plan: p.plan,
      selfEmployedBase: money(p.self1),
      selfEmployedSecond: money(p.self2),
      selfEmployed: money(p.self1 + p.self2),
      employment: money(p.employee),
      deduction: money(p.deduction),
      creditAmount: money(p.creditAmount),
    },
    ei: money(c.ei),
    qpipEmployment: money(c.qpipEmployment),
    qpipSelfEmployed: money(c.qpipSelfEmployed),
    healthServicesFund: money(c.hsf),
    federal: roundFederal(c.federal),
    provincial: roundProvincial(c.provincial),
    incomeTax: money(c.incomeTax),
    contributions: money(c.contributions),
    total: money(c.total),
    taxDeductedAtWork: money(taxDeductedAtWork),
    instalmentsPaid: money(instalmentsPaid),
    netOwing: money(netOwing),
    balance: money(netOwing - instalmentsPaid),
    quarterlyInstalment: money(Math.max(0, netOwing) / 4),
    instalmentThreshold,
    instalmentsLikely: netOwing > instalmentThreshold,
    business: {
      incomeTax: money(bizIncomeTax),
      contributions: money(bizContributions),
      total: money(bizTotal),
      setAsideRate: c.revenue > 0 ? Math.max(0, bizTotal) / c.revenue : 0,
      marginalRate: Math.max(0, (bumped.total - c.total) / step),
      kept: money(c.revenue - c.expenses + st.kept - bizTotal),
    },
    salesTax: {
      ...st,
      collected: money(st.collected),
      inputCredits: money(st.inputCredits),
      quickCredit: money(st.quickCredit),
      remit: money(st.remit),
      kept: money(st.kept),
    },
  };
}
