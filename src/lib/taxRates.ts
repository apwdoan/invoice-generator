/**
 * Rates for the contractor tax estimate, one table per tax year.
 *
 * 2026 sources:
 * - CRA, T4127 Payroll Deductions Formulas, 122nd edition (January 1, 2026) and 123rd edition
 *   (July 1, 2026): federal and provincial brackets, basic personal amounts, Ontario surtax,
 *   Health Premium and tax reduction, the BC tax reduction, and CPP, QPP, EI and QPIP rates.
 *   The July edition brings in three changes announced during 2026, all effective January 1:
 *   BC's lowest rate rises to 5.6% with a $690 tax reduction, Newfoundland and Labrador's basic
 *   personal amount rises to $13,094, and PEI adds a 20% bracket above $200,000.
 * - Finances Québec, Parameters of the Personal Income Tax System for 2026: Québec brackets,
 *   basic personal amount, deduction for workers and Health Services Fund thresholds.
 * - Revenu Québec: QPIP rates for 2026 (self-employed rate 0.764%).
 * - CRA, RC4058 Quick Method of Accounting for GST/HST: remittance rates for service businesses.
 */

export type ProvinceCode = "AB" | "BC" | "MB" | "NB" | "NL" | "NS" | "NT" | "NU" | "ON" | "PE" | "QC" | "SK" | "YT";

/** The rate on income above `from`, up to the next bracket. */
export interface Bracket {
  from: number;
  rate: number;
}

/** An amount that falls in a straight line from `max` to `min` as net income rises from `from` to `to`. */
export interface PhasedAmount {
  max: number;
  min: number;
  from: number;
  to: number;
}

export interface PensionPlan {
  name: "CPP" | "QPP";
  /** Employee rates. The self-employed pay both the employee and employer halves. */
  baseRate: number;
  firstAdditionalRate: number;
  secondAdditionalRate: number;
}

export interface SalesTax {
  label: "GST" | "HST";
  rate: number;
  /** Quick Method remittance rate for a service business selling in its own province. */
  quickRate: number;
}

export type TaxReduction =
  /** BC: a fixed amount, reduced by `rate` of net income above `from`. */
  | { kind: "bc"; amount: number; from: number; rate: number }
  /** Ontario: twice the basic amount, less Ontario tax (including surtax). */
  | { kind: "on"; basic: number };

export interface ProvinceRates {
  code: ProvinceCode;
  name: string;
  brackets: Bracket[];
  basicPersonalAmount: number | PhasedAmount;
  salesTax: SalesTax;
  /** Yukon also gives a credit for the Canada employment amount. */
  employmentAmountCredit?: boolean;
  /** Alberta: credit amounts above `above` are worth `rate` instead of the lowest rate. */
  supplementalCredit?: { above: number; rate: number };
  /** Ontario: a percentage of basic provincial tax above each threshold. */
  surtax?: { over: number; rate: number }[];
  /** Ontario Health Premium, based on taxable income. */
  healthPremium?: { from: number; rate: number; cap: number }[];
  taxReduction?: TaxReduction;
}

export interface TaxYearRates {
  year: number;
  /** Where the figures come from, shown with the estimate. */
  source: string;
  federal: {
    brackets: Bracket[];
    basicPersonalAmount: PhasedAmount;
    /** Canada employment amount, for employment income only. */
    employmentAmount: number;
    /** Québec residents get this share of basic federal tax back. */
    quebecAbatement: number;
  };
  pension: {
    /** Year's maximum pensionable earnings. */
    ympe: number;
    /** Year's additional maximum pensionable earnings (top of the CPP2 band). */
    yampe: number;
    basicExemption: number;
    cpp: PensionPlan;
    qpp: PensionPlan;
  };
  ei: { maxInsurable: number; rate: number; quebecRate: number };
  qpip: { maxInsurable: number; employeeRate: number; selfEmployedRate: number; selfEmployedMinimum: number };
  quebec: {
    /** Deduction for workers: a share of employment and business income, up to a maximum. */
    workerDeduction: { rate: number; max: number };
    /** Health Services Fund contribution on income other than employment income. */
    healthServicesFund: { first: number; second: number; rate: number; firstMax: number; max: number };
  };
  gst: {
    /** Above this, registration is required (four consecutive calendar quarters). */
    smallSupplierLimit: number;
    /** The Quick Method is available up to this much in annual taxable supplies. */
    quickMethodLimit: number;
    /** Quick Method credit on the first `quickCreditOn` of tax-included sales. */
    quickCreditRate: number;
    quickCreditOn: number;
  };
  /** Instalments are expected when net tax owing is above this, this year and in either of the last two. */
  instalments: { threshold: number; quebecThreshold: number };
  provinces: Record<ProvinceCode, ProvinceRates>;
}

const GST: SalesTax = { label: "GST", rate: 0.05, quickRate: 0.036 };
const HST15: SalesTax = { label: "HST", rate: 0.15, quickRate: 0.1 };

const FEDERAL_BPA_2026: PhasedAmount = { max: 16_452, min: 14_829, from: 181_440, to: 258_482 };

export const RATES_2026: TaxYearRates = {
  year: 2026,
  source: "CRA payroll formulas (T4127, July 2026), Finances Québec 2026 parameters and CRA guide RC4058",
  federal: {
    brackets: [
      { from: 0, rate: 0.14 },
      { from: 58_523, rate: 0.205 },
      { from: 117_045, rate: 0.26 },
      { from: 181_440, rate: 0.29 },
      { from: 258_482, rate: 0.33 },
    ],
    basicPersonalAmount: FEDERAL_BPA_2026,
    employmentAmount: 1_501,
    quebecAbatement: 0.165,
  },
  pension: {
    ympe: 74_600,
    yampe: 85_000,
    basicExemption: 3_500,
    cpp: { name: "CPP", baseRate: 0.0495, firstAdditionalRate: 0.01, secondAdditionalRate: 0.04 },
    qpp: { name: "QPP", baseRate: 0.053, firstAdditionalRate: 0.01, secondAdditionalRate: 0.04 },
  },
  ei: { maxInsurable: 68_900, rate: 0.0163, quebecRate: 0.013 },
  qpip: { maxInsurable: 103_000, employeeRate: 0.0043, selfEmployedRate: 0.00764, selfEmployedMinimum: 2_000 },
  quebec: {
    workerDeduction: { rate: 0.06, max: 1_450 },
    healthServicesFund: { first: 18_500, second: 64_355, rate: 0.01, firstMax: 150, max: 1_000 },
  },
  gst: { smallSupplierLimit: 30_000, quickMethodLimit: 400_000, quickCreditRate: 0.01, quickCreditOn: 30_000 },
  instalments: { threshold: 3_000, quebecThreshold: 1_800 },
  provinces: {
    AB: {
      code: "AB",
      name: "Alberta",
      brackets: [
        { from: 0, rate: 0.08 },
        { from: 61_200, rate: 0.1 },
        { from: 154_259, rate: 0.12 },
        { from: 185_111, rate: 0.13 },
        { from: 246_813, rate: 0.14 },
        { from: 370_220, rate: 0.15 },
      ],
      basicPersonalAmount: 22_769,
      supplementalCredit: { above: 61_200, rate: 0.1 },
      salesTax: GST,
    },
    BC: {
      code: "BC",
      name: "British Columbia",
      brackets: [
        { from: 0, rate: 0.056 },
        { from: 50_363, rate: 0.077 },
        { from: 100_728, rate: 0.105 },
        { from: 115_648, rate: 0.1229 },
        { from: 140_430, rate: 0.147 },
        { from: 190_405, rate: 0.168 },
        { from: 265_545, rate: 0.205 },
      ],
      basicPersonalAmount: 13_216,
      taxReduction: { kind: "bc", amount: 690, from: 25_570, rate: 0.0356 },
      salesTax: GST,
    },
    MB: {
      code: "MB",
      name: "Manitoba",
      brackets: [
        { from: 0, rate: 0.108 },
        { from: 47_000, rate: 0.1275 },
        { from: 100_000, rate: 0.174 },
      ],
      basicPersonalAmount: { max: 15_780, min: 0, from: 200_000, to: 400_000 },
      salesTax: GST,
    },
    NB: {
      code: "NB",
      name: "New Brunswick",
      brackets: [
        { from: 0, rate: 0.094 },
        { from: 52_333, rate: 0.14 },
        { from: 104_666, rate: 0.16 },
        { from: 193_861, rate: 0.195 },
      ],
      basicPersonalAmount: 13_664,
      salesTax: HST15,
    },
    NL: {
      code: "NL",
      name: "Newfoundland and Labrador",
      brackets: [
        { from: 0, rate: 0.087 },
        { from: 44_678, rate: 0.145 },
        { from: 89_354, rate: 0.158 },
        { from: 159_528, rate: 0.178 },
        { from: 223_340, rate: 0.198 },
        { from: 285_319, rate: 0.208 },
        { from: 570_638, rate: 0.213 },
        { from: 1_141_275, rate: 0.218 },
      ],
      basicPersonalAmount: 13_094,
      salesTax: HST15,
    },
    NS: {
      code: "NS",
      name: "Nova Scotia",
      brackets: [
        { from: 0, rate: 0.0879 },
        { from: 30_995, rate: 0.1495 },
        { from: 61_991, rate: 0.1667 },
        { from: 97_417, rate: 0.175 },
        { from: 157_124, rate: 0.21 },
      ],
      basicPersonalAmount: 11_932,
      salesTax: { label: "HST", rate: 0.14, quickRate: 0.094 },
    },
    NT: {
      code: "NT",
      name: "Northwest Territories",
      brackets: [
        { from: 0, rate: 0.059 },
        { from: 53_003, rate: 0.086 },
        { from: 106_009, rate: 0.122 },
        { from: 172_346, rate: 0.1405 },
      ],
      basicPersonalAmount: 18_198,
      salesTax: GST,
    },
    NU: {
      code: "NU",
      name: "Nunavut",
      brackets: [
        { from: 0, rate: 0.04 },
        { from: 55_801, rate: 0.07 },
        { from: 111_602, rate: 0.09 },
        { from: 181_439, rate: 0.115 },
      ],
      basicPersonalAmount: 19_659,
      salesTax: GST,
    },
    ON: {
      code: "ON",
      name: "Ontario",
      brackets: [
        { from: 0, rate: 0.0505 },
        { from: 53_891, rate: 0.0915 },
        { from: 107_785, rate: 0.1116 },
        { from: 150_000, rate: 0.1216 },
        { from: 220_000, rate: 0.1316 },
      ],
      basicPersonalAmount: 12_989,
      surtax: [
        { over: 5_818, rate: 0.2 },
        { over: 7_446, rate: 0.36 },
      ],
      // Set in law and not indexed.
      healthPremium: [
        { from: 20_000, rate: 0.06, cap: 300 },
        { from: 36_000, rate: 0.06, cap: 450 },
        { from: 48_000, rate: 0.25, cap: 600 },
        { from: 72_000, rate: 0.25, cap: 750 },
        { from: 200_000, rate: 0.25, cap: 900 },
      ],
      taxReduction: { kind: "on", basic: 300 },
      salesTax: { label: "HST", rate: 0.13, quickRate: 0.088 },
    },
    PE: {
      code: "PE",
      name: "Prince Edward Island",
      brackets: [
        { from: 0, rate: 0.095 },
        { from: 33_928, rate: 0.1347 },
        { from: 65_820, rate: 0.166 },
        { from: 106_890, rate: 0.1762 },
        { from: 142_520, rate: 0.19 },
        { from: 200_000, rate: 0.2 },
      ],
      basicPersonalAmount: 15_000,
      salesTax: HST15,
    },
    QC: {
      code: "QC",
      name: "Québec",
      brackets: [
        { from: 0, rate: 0.14 },
        { from: 54_345, rate: 0.19 },
        { from: 108_680, rate: 0.24 },
        { from: 132_245, rate: 0.2575 },
      ],
      basicPersonalAmount: 18_952,
      salesTax: GST,
    },
    SK: {
      code: "SK",
      name: "Saskatchewan",
      brackets: [
        { from: 0, rate: 0.105 },
        { from: 54_532, rate: 0.125 },
        { from: 155_805, rate: 0.145 },
      ],
      basicPersonalAmount: 20_381,
      salesTax: GST,
    },
    YT: {
      code: "YT",
      name: "Yukon",
      brackets: [
        { from: 0, rate: 0.064 },
        { from: 58_523, rate: 0.09 },
        { from: 117_045, rate: 0.109 },
        { from: 181_440, rate: 0.128 },
        { from: 500_000, rate: 0.15 },
      ],
      // Yukon's basic personal amount mirrors the federal one.
      basicPersonalAmount: FEDERAL_BPA_2026,
      employmentAmountCredit: true,
      salesTax: GST,
    },
  },
};

export const TAX_YEARS: Record<number, TaxYearRates> = { 2026: RATES_2026 };

export const LATEST_TAX_YEAR = Math.max(...Object.keys(TAX_YEARS).map(Number));

/** Provinces and territories in the order people expect to find them. */
export const PROVINCE_ORDER: ProvinceCode[] = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NT",
  "NS",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
];
