/**
 * Checks the tax estimate against published figures and hand-worked examples:
 *   npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateTaxes, federalIncomeTax, provincialIncomeTax, type EstimateInput } from "../src/lib/taxEstimate";
import { RATES_2026 as R, type ProvinceCode } from "../src/lib/taxRates";

const near = (actual: number, expected: number, tolerance = 0.02, label = "") =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} expected ${expected}, got ${actual}`);

/** Federal plus provincial tax with only the basic personal amounts, as in published rate tables. */
function basicTax(province: ProvinceCode, income: number, { healthPremium = true } = {}) {
  const federal = federalIncomeTax(R, {
    taxableIncome: income,
    netIncome: income,
    otherCredits: 0,
    quebec: province === "QC",
  });
  if (province === "QC") return { federal: federal.tax, total: federal.tax };
  const p = provincialIncomeTax(R, province, {
    taxableIncome: income,
    netIncome: income,
    otherCredits: 0,
    employmentIncome: 0,
  });
  return { federal: federal.tax, total: federal.tax + p.tax - (healthPremium ? 0 : p.healthPremium) };
}

const blank: EstimateInput = {
  province: "AB",
  revenue: 0,
  expenses: 0,
  employmentIncome: 0,
  rrsp: 0,
  taxDeductedAtWork: 0,
  instalmentsPaid: 0,
  gstRegistered: false,
  gstMethod: "regular",
  taxableShare: 1,
  gstOnExpenses: 0,
};

/**
 * EY's 2026 combined rate tables (as of January 15, 2026): [lower limit, tax at the limit, marginal rate %].
 * Rows below $50,000 are left out because they include low-income reductions this estimate does not model.
 * BC, Newfoundland and Labrador and PEI's top bracket changed after January and are checked by hand below.
 * Québec rows are federal tax after the abatement. Ontario rows leave out the Health Premium.
 * EY rounds to the dollar; its Nova Scotia figure at $258,482 is $4 under an exact calculation.
 */
const EY: Partial<Record<ProvinceCode, [number, number, number][]>> = {
  AB: [
    [58524, 8750, 28.5],
    [61201, 9513, 30.5],
    [117046, 26546, 36],
    [154260, 39943, 38],
    [181441, 50272, 41.29],
    [185112, 51788, 42.29],
    [246814, 77885, 43.29],
    [258483, 82937, 47],
    [370221, 135453, 48],
  ],
  MB: [
    [58524, 10731, 33.25],
    [100001, 24522, 37.9],
    [117046, 30982, 43.4],
    [181441, 58929, 46.69],
    [200001, 67596, 47.55],
    [258483, 95403, 51.25],
    [400001, 167933, 50.4],
  ],
  NB: [
    [52334, 8658, 28],
    [58524, 10391, 34.5],
    [104667, 26311, 36.5],
    [117046, 30829, 42],
    [181441, 57875, 45.29],
    [193862, 63501, 48.79],
    [258483, 95033, 52.5],
  ],
  NS: [
    [58524, 11681, 35.45],
    [61992, 12910, 37.17],
    [97418, 26078, 38],
    [117046, 33537, 43.5],
    [157125, 50971, 47],
    [181441, 62400, 50.29],
    [258483, 101144, 54],
  ],
  NT: [
    [53004, 7171, 22.6],
    [58524, 8418, 29.1],
    [106010, 22237, 32.7],
    [117046, 25845, 38.2],
    [172347, 46970, 40.05],
    [181441, 50612, 43.34],
    [258483, 84006, 47.05],
  ],
  NU: [
    [55802, 6955, 21],
    [58524, 7526, 27.5],
    [111603, 22123, 29.5],
    [117046, 23729, 35],
    [181440, 46266, 40.79],
    [258483, 77696, 44.5],
  ],
  ON: [
    [53892, 7307, 23.15],
    [58524, 8379, 29.65],
    [94902, 19166, 31.48],
    [107786, 23221, 33.89],
    [111811, 24585, 37.91],
    [117046, 26570, 43.41],
    [150001, 40876, 44.97],
    [181441, 55014, 48.26],
    [220001, 73625, 49.82],
    [258483, 92798, 53.53],
  ],
  PE: [
    [58524, 11001, 33.97],
    [65821, 13480, 37.1],
    [106891, 28717, 38.12],
    [117046, 32588, 43.62],
  ],
  SK: [
    [54533, 8917, 26.5],
    [58524, 9975, 33],
    [117046, 29287, 38.5],
    [155806, 44210, 40.5],
    [181441, 54592, 43.79],
    [258483, 88332, 47.5],
  ],
  YT: [
    [58524, 8582, 29.5],
    [117046, 25846, 36.9],
    [181441, 49608, 42.23],
    [258483, 82143, 45.8],
  ],
  QC: [
    [58524, 4918, 17.12],
    [117046, 14936, 21.71],
    [181441, 28916, 24.46],
  ],
};

describe("income tax matches published 2026 rate tables", () => {
  for (const [province, rows] of Object.entries(EY) as [ProvinceCode, [number, number, number][]][]) {
    it(province, () => {
      for (const [lower, tax, rate] of rows) {
        const at = (income: number) => basicTax(province, income, { healthPremium: false }).total;
        near(at(lower - 1), tax, 5, `${province} tax at ${lower - 1}:`);
        const marginal = ((at(lower + 400) - at(lower + 100)) / 300) * 100;
        near(marginal, rate, 0.01, `${province} rate above ${lower}:`);
      }
    });
  }
});

describe("2026 changes made after January", () => {
  it("BC: 5.6% lowest rate and $690 tax reduction", () => {
    // 80,000 is past the reduction's phase-out: 50,363 at 5.6%, the rest at 7.7%, less 5.6% of the BPA.
    const p = provincialIncomeTax(R, "BC", {
      taxableIncome: 80_000,
      netIncome: 80_000,
      otherCredits: 0,
      employmentIncome: 0,
    });
    near(p.tax, 50_363 * 0.056 + (80_000 - 50_363) * 0.077 - 13_216 * 0.056);
    // At 30,000 the reduction is 690 less 3.56% of the income above 25,570.
    const low = provincialIncomeTax(R, "BC", {
      taxableIncome: 30_000,
      netIncome: 30_000,
      otherCredits: 0,
      employmentIncome: 0,
    });
    near(low.reduction, 690 - 0.0356 * (30_000 - 25_570));
    near(low.tax, (30_000 - 13_216) * 0.056 - (690 - 0.0356 * (30_000 - 25_570)));
  });

  it("Newfoundland and Labrador: $13,094 basic personal amount", () => {
    const p = provincialIncomeTax(R, "NL", {
      taxableIncome: 60_000,
      netIncome: 60_000,
      otherCredits: 0,
      employmentIncome: 0,
    });
    near(p.tax, 44_678 * 0.087 + (60_000 - 44_678) * 0.145 - 13_094 * 0.087);
  });

  it("PEI: 20% above $200,000", () => {
    const at = (income: number) =>
      provincialIncomeTax(R, "PE", { taxableIncome: income, netIncome: income, otherCredits: 0, employmentIncome: 0 })
        .tax;
    near(at(210_000) - at(200_000), 2_000);
    near(at(190_000) - at(180_000), 1_900);
  });
});

describe("Ontario", () => {
  it("adds surtax and the Health Premium", () => {
    const p = provincialIncomeTax(R, "ON", {
      taxableIncome: 100_000,
      netIncome: 100_000,
      otherCredits: 0,
      employmentIncome: 0,
    });
    const basic = 53_891 * 0.0505 + (100_000 - 53_891) * 0.0915 - 12_989 * 0.0505;
    near(p.surtax, 0.2 * (basic - 5_818));
    near(p.healthPremium, 750);
    near(p.tax, basic + 0.2 * (basic - 5_818) + 750);
  });

  it("Health Premium steps", () => {
    const premium = (income: number) =>
      provincialIncomeTax(R, "ON", { taxableIncome: income, netIncome: income, otherCredits: 0, employmentIncome: 0 })
        .healthPremium;
    near(premium(20_000), 0);
    near(premium(25_000), 300);
    near(premium(40_000), 450);
    near(premium(48_400), 550);
    near(premium(60_000), 600);
    near(premium(250_000), 900);
  });
});

describe("self-employed contractor in Alberta", () => {
  // $100,000 revenue, $10,000 expenses, no other income.
  const e = estimateTaxes(R, { ...blank, revenue: 100_000, expenses: 10_000 });
  // Both halves of CPP on 74,600 less the 3,500 exemption, and CPP2 on 74,600 to 85,000.
  const cpp = 2 * 0.0595 * (74_600 - 3_500);
  const cpp2 = 2 * 0.04 * (85_000 - 74_600);
  const deduction = cpp / 2 + 0.01 * (74_600 - 3_500) + cpp2;
  const credit = 0.0495 * (74_600 - 3_500);
  const taxable = 90_000 - deduction;

  it("CPP and CPP2 on both halves", () => {
    near(e.pension.selfEmployedBase, cpp);
    near(e.pension.selfEmployedSecond, cpp2);
    near(e.pension.deduction, deduction);
    near(e.pension.creditAmount, credit);
    near(e.taxableIncome, taxable);
  });

  it("federal and Alberta tax", () => {
    const federal = 58_523 * 0.14 + (taxable - 58_523) * 0.205 - 0.14 * (16_452 + credit);
    const alberta = 61_200 * 0.08 + (taxable - 61_200) * 0.1 - 0.08 * (22_769 + credit);
    near(e.federal.tax, federal);
    near(e.provincial.tax, alberta);
    near(e.total, federal + alberta + cpp + cpp2);
  });

  it("set-aside and marginal rate", () => {
    near(e.business.setAsideRate, e.total / 100_000, 0.0001);
    // Past the CPP maximum, the next dollar is taxed at 20.5% federal and 10% Alberta.
    near(e.business.marginalRate, 0.305, 0.0001);
  });

  it("marginal rate inside the CPP band", () => {
    const mid = estimateTaxes(R, { ...blank, revenue: 60_000 });
    // CPP 11.9%; taxable income rises by 1 - 6.95%; credits rise by 4.95% at 14% + 8%.
    near(mid.business.marginalRate, 0.119 + (1 - 0.0695) * 0.22 - 0.0495 * 0.22, 0.0001);
  });
});

describe("employment and self-employment together", () => {
  const e = estimateTaxes(R, {
    ...blank,
    province: "ON",
    revenue: 30_000,
    employmentIncome: 50_000,
    taxDeductedAtWork: 6_000,
  });

  it("shares the CPP exemption and maximum", () => {
    // The job already used the exemption; self-employment fills the rest up to 74,600 and into CPP2.
    near(e.pension.employment, 0.0595 * (50_000 - 3_500));
    near(e.pension.selfEmployedBase, 0.119 * (74_600 - 50_000));
    near(e.pension.selfEmployedSecond, 0.08 * (80_000 - 74_600));
  });

  it("claims EI and the Canada employment amount", () => {
    near(e.ei, 50_000 * 0.0163);
    const withoutJob = estimateTaxes(R, { ...blank, province: "ON", revenue: 30_000 });
    assert.ok(e.total > withoutJob.total);
  });

  it("set-aside counts only what the business adds", () => {
    const jobOnly = estimateTaxes(R, { ...blank, province: "ON", employmentIncome: 50_000 });
    near(e.business.total, e.total - jobOnly.total);
    near(e.netOwing, e.total - 6_000);
  });
});

describe("Québec", () => {
  const e = estimateTaxes(R, { ...blank, province: "QC", revenue: 90_000 });
  const qpp = 2 * 0.063 * (74_600 - 3_500);
  const qpp2 = 2 * 0.04 * (85_000 - 74_600);
  const qpip = 0.00764 * 90_000;
  const qpipDeduction = qpip * (1 - 0.0043 / 0.00764);
  const deduction = qpp / 2 + 0.01 * (74_600 - 3_500) + qpp2;
  const net = 90_000 - deduction - qpipDeduction;

  it("QPP and QPIP on self-employment", () => {
    near(e.pension.plan === "QPP" ? e.pension.selfEmployedBase : 0, qpp);
    near(e.pension.selfEmployedSecond, qpp2);
    near(e.qpipSelfEmployed, qpip);
    near(e.qpipDeduction, qpipDeduction);
    near(e.netIncome, net);
  });

  it("federal tax with the abatement", () => {
    const credits = 0.14 * (16_452 + 0.053 * (74_600 - 3_500) + 0.0043 * 90_000);
    const basic = 58_523 * 0.14 + (net - 58_523) * 0.205 - credits;
    near(e.federal.tax, basic * (1 - 0.165));
  });

  it("Québec tax with the deduction for workers and Health Services Fund", () => {
    const taxable = net - 1_450;
    near(e.provincial.taxableIncome, taxable);
    near(e.provincial.tax, 54_345 * 0.14 + (taxable - 54_345) * 0.19 - 0.14 * 18_952);
    const fundBase = 90_000 - deduction - qpipDeduction;
    near(e.healthServicesFund, Math.min(1_000, 150 + 0.01 * (fundBase - 64_355)));
  });
});

describe("GST/HST", () => {
  it("regular method remits tax collected less input tax credits", () => {
    const e = estimateTaxes(R, { ...blank, province: "ON", revenue: 50_000, gstRegistered: true, gstOnExpenses: 500 });
    near(e.salesTax.collected, 6_500);
    near(e.salesTax.remit, 6_000);
    near(e.quickMethodIncome, 0);
  });

  it("Quick Method uses the remittance rate and the 1% credit, and the gain is income", () => {
    const e = estimateTaxes(R, { ...blank, province: "ON", revenue: 50_000, gstRegistered: true, gstMethod: "quick" });
    near(e.salesTax.remit, 56_500 * 0.088 - 300);
    near(e.salesTax.kept, 6_500 - (56_500 * 0.088 - 300));
    near(e.netBusinessIncome, 50_000 + 6_500 - (56_500 * 0.088 - 300));
  });

  it("only charges tax on the taxable share", () => {
    const e = estimateTaxes(R, { ...blank, revenue: 80_000, gstRegistered: true, taxableShare: 0.25 });
    near(e.salesTax.collected, 1_000);
  });

  it("flags registration past $30,000", () => {
    assert.equal(estimateTaxes(R, { ...blank, revenue: 30_000 }).salesTax.mustRegister, false);
    assert.equal(estimateTaxes(R, { ...blank, revenue: 30_001 }).salesTax.mustRegister, true);
  });

  it("falls back to the regular method above $400,000", () => {
    const e = estimateTaxes(R, { ...blank, revenue: 450_000, gstRegistered: true, gstMethod: "quick" });
    assert.equal(e.salesTax.method, "regular");
  });
});

describe("edge cases", () => {
  it("no income means no tax", () => {
    const e = estimateTaxes(R, blank);
    assert.equal(e.total, 0);
    assert.equal(e.business.setAsideRate, 0);
  });

  it("a business loss reduces tax on employment income", () => {
    const job = estimateTaxes(R, { ...blank, employmentIncome: 70_000 });
    const loss = estimateTaxes(R, { ...blank, employmentIncome: 70_000, revenue: 5_000, expenses: 15_000 });
    assert.ok(loss.incomeTax < job.incomeTax);
    assert.equal(loss.pension.selfEmployed, 0);
    assert.equal(loss.business.setAsideRate, 0);
  });

  it("RRSP deductions lower tax but not CPP", () => {
    const a = estimateTaxes(R, { ...blank, revenue: 80_000 });
    const b = estimateTaxes(R, { ...blank, revenue: 80_000, rrsp: 10_000 });
    assert.ok(b.incomeTax < a.incomeTax);
    assert.equal(b.pension.selfEmployed, a.pension.selfEmployed);
  });

  it("instalments", () => {
    const e = estimateTaxes(R, { ...blank, revenue: 100_000, instalmentsPaid: 5_000 });
    assert.equal(e.instalmentsLikely, true);
    near(e.quarterlyInstalment, e.total / 4);
    near(e.balance, e.total - 5_000);
  });
});
