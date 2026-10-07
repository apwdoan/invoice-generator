import type { ReactNode } from "react";
import { formatMoney, roundCents, type Totals } from "../lib/money";
import type { Estimate } from "../lib/taxEstimate";
import { TAX_YEARS } from "../lib/taxRates";
import { formatDollars, formatPercent } from "../lib/taxSettings";
import type { Invoice } from "../lib/types";

interface Props {
  estimate: Estimate;
  invoice: Invoice;
  totals: Totals;
}

const MINUS = "−";

/** Deduction lines pass `negative` and a positive value; other lines show their own sign. */
function Amount({ value, negative }: { value: number; negative?: boolean }) {
  const shown = formatDollars(Math.abs(value));
  const sign = Math.sign(Math.round(value)) * (negative ? -1 : 1);
  return <>{sign < 0 ? `${MINUS}${shown}` : shown}</>;
}

function Line({
  label,
  value,
  negative,
  kind,
  detail,
}: {
  label: string;
  value: number;
  negative?: boolean;
  kind?: "subtotal" | "total";
  detail?: string;
}) {
  return (
    <tr className={kind ? `line-${kind}` : undefined}>
      <th scope="row">
        {label}
        {detail && <span className="line-detail">{detail}</span>}
      </th>
      <td className="num">
        <Amount value={value} negative={negative} />
      </td>
    </tr>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <tbody>
      <tr className="line-group">
        <th scope="rowgroup" colSpan={2}>
          {title}
        </th>
      </tr>
      {children}
    </tbody>
  );
}

/** Colour roles for the revenue bar. Kept leads in the app's green; expenses recede as context. */
const PARTS = {
  kept: { color: "var(--viz-kept)", ink: "var(--viz-on-kept)" },
  tax: { color: "var(--viz-tax)", ink: "var(--viz-on-tax)" },
  contributions: { color: "var(--viz-contributions)", ink: "var(--viz-on-contributions)" },
  expenses: { color: "var(--viz-expenses)", ink: "var(--viz-on-expenses)" },
};

function RevenueBar({ estimate, contributionsLabel }: { estimate: Estimate; contributionsLabel: string }) {
  const b = estimate.business;
  const parts = [
    { key: "kept" as const, label: "You keep", value: b.kept },
    { key: "tax" as const, label: "Income tax", value: b.incomeTax },
    { key: "contributions" as const, label: contributionsLabel, value: b.contributions },
    { key: "expenses" as const, label: "Expenses", value: estimate.expenses },
  ];
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  if (parts.some((p) => p.value < 0) || total <= 0) {
    return (
      <p className="hint">
        Your expenses are more than your revenue. The business loss lowers the tax on your other income
        {b.total < 0 ? ` by about ${formatDollars(-b.total)}` : ""}.
      </p>
    );
  }
  const shown = parts.filter((p) => p.value > 0);
  return (
    <figure className="revenue">
      <div
        className="revenue-bar"
        role="img"
        aria-label={parts.map((p) => `${p.label} ${formatDollars(p.value)}`).join(", ")}
      >
        {shown.map((p) => {
          const share = p.value / total;
          return (
            <span
              key={p.key}
              className="revenue-segment"
              style={{ flexGrow: p.value, background: PARTS[p.key].color, color: PARTS[p.key].ink }}
              title={`${p.label}: ${formatDollars(p.value)} (${formatPercent(share)})`}
            >
              {share >= 0.09 && formatPercent(share, 0)}
            </span>
          );
        })}
      </div>
      <ul className="revenue-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className="legend-key" style={{ background: PARTS[p.key].color }} aria-hidden="true" />
            <span className="legend-label">{p.label}</span>
            <span className="legend-value">{formatDollars(p.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function hasRevenueOrJob(e: Estimate): boolean {
  return e.revenue > 0 || e.employmentIncome > 0;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function TaxSummary({ estimate: e, invoice, totals }: Props) {
  const rates = TAX_YEARS[e.year];
  const quebec = e.province === "QC";
  const plan = e.pension.plan;
  const planRates = quebec ? rates.pension.qpp : rates.pension.cpp;
  const contributionsLabel = quebec ? "QPP and QPIP" : "CPP";
  const taxAndContributions = quebec ? "income tax, QPP and QPIP" : "income tax and CPP";
  const hasIncome = hasRevenueOrJob(e);
  const p = e.provincial;
  const st = e.salesTax;
  const b = e.business;
  const next = e.year + 1;
  const hasRevenue = e.revenue > 0;

  const invoiceTaxCents = totals.taxes.reduce((sum, t) => sum + t.cents, 0);
  const invoiceTaxName =
    totals.taxes
      .map((t) => t.tax.label.trim())
      .filter(Boolean)
      .join("/") || "sales tax";
  const setAsideCents = roundCents(totals.subtotal * b.setAsideRate);
  const client = invoice.client.name.trim();

  return (
    <div className="tax-frame">
      <article className="tax-sheet">
        <header className="tax-hero">
          {hasRevenue ? (
            <div className="hero-main">
              <p className="eyebrow">Set aside from each invoice</p>
              <p className="hero-figure">{formatPercent(b.setAsideRate)}</p>
              <p className="hero-note">
                of the amount before tax, for {taxAndContributions}
                {st.registered ? `, plus the ${st.label} you charge` : ""}.
              </p>
            </div>
          ) : (
            <div className="hero-main">
              <p className="eyebrow">Set aside from each invoice</p>
              <p className="hero-empty">
                Enter the revenue you expect this year to see how much of each invoice to keep for tax.
              </p>
            </div>
          )}
          {hasIncome && (
            <dl className="tax-kpis">
              <div>
                <dt>
                  {capitalize(taxAndContributions)}, {e.year}
                </dt>
                <dd>{formatDollars(e.total)}</dd>
              </div>
              <div>
                <dt>On your next $1,000 of revenue</dt>
                <dd>
                  {formatDollars(b.marginalRate * 1000)}{" "}
                  <span className="kpi-aside">({formatPercent(b.marginalRate)})</span>
                </dd>
              </div>
              <div>
                <dt>{e.balance < 0 ? "Expected refund" : `Left to pay for ${e.year}`}</dt>
                <dd>{formatDollars(Math.abs(e.balance))}</dd>
              </div>
            </dl>
          )}
        </header>

        {hasRevenue && totals.subtotal > 0 && b.setAsideRate > 0 && (
          <p className="tax-invoice">
            <strong>{invoice.number || "This invoice"}</strong>
            {client ? ` for ${client}` : ""}: when it’s paid, move{" "}
            <strong>{formatMoney(setAsideCents + invoiceTaxCents, invoice.currency)}</strong> to savings.{" "}
            {invoiceTaxCents > 0
              ? `That’s ${formatMoney(setAsideCents, invoice.currency)} for ${taxAndContributions}, and the ${formatMoney(invoiceTaxCents, invoice.currency)} in ${invoiceTaxName} you charged.`
              : `That’s ${formatPercent(b.setAsideRate)} of ${formatMoney(totals.subtotal, invoice.currency)}.`}
          </p>
        )}

        {hasRevenue && (
          <section className="tax-section">
            <h3>Where your revenue goes</h3>
            <RevenueBar estimate={e} contributionsLabel={contributionsLabel} />
            {e.employmentIncome > 0 && (
              <p className="hint">Tax shown here is what the business adds on top of the tax on your job.</p>
            )}
          </section>
        )}

        {hasIncome && (
          <>
            <section className="tax-section">
              <h3>How it adds up</h3>
              <table className="tax-table">
                <Group title="Income">
                  <Line label="Revenue" value={e.revenue} />
                  {e.expenses > 0 && <Line label="Business expenses" value={e.expenses} negative />}
                  {e.quickMethodIncome > 0 && (
                    <Line
                      label={`${st.label} kept under the Quick Method`}
                      value={e.quickMethodIncome}
                      detail="Counts as income"
                    />
                  )}
                  <Line label="Net business income" value={e.netBusinessIncome} kind="subtotal" />
                  {e.employmentIncome > 0 && <Line label="Employment income" value={e.employmentIncome} />}
                  {e.pensionDeduction > 0 && (
                    <Line
                      label={`${plan} deduction`}
                      value={e.pensionDeduction}
                      negative
                      detail={
                        e.pension.selfEmployed > 0
                          ? "The employer half and enhanced contributions"
                          : "Enhanced contributions"
                      }
                    />
                  )}
                  {e.qpipDeduction > 0 && <Line label="QPIP deduction" value={e.qpipDeduction} negative />}
                  {e.rrspDeduction > 0 && <Line label="RRSP and FHSA deductions" value={e.rrspDeduction} negative />}
                  <Line label="Taxable income" value={e.taxableIncome} kind="subtotal" />
                </Group>

                <Group title="Federal tax">
                  <Line label="Tax on taxable income" value={e.federal.bracketTax} />
                  <Line
                    label="Credits"
                    value={Math.min(e.federal.credits, e.federal.bracketTax)}
                    negative
                    detail={`Basic personal amount, ${plan}${e.ei > 0 ? ", EI" : ""}${quebec ? ", QPIP" : ""}${e.employmentIncome > 0 ? ", Canada employment amount" : ""}`}
                  />
                  {e.federal.abatement > 0 && (
                    <Line label="Québec abatement" value={e.federal.abatement} negative detail="16.5%" />
                  )}
                  <Line label="Federal tax" value={e.federal.tax} kind="subtotal" />
                </Group>

                <Group title={`${p.name} tax`}>
                  {quebec && e.workerDeduction > 0 && (
                    <Line
                      label="Québec taxable income"
                      value={p.taxableIncome}
                      detail={`After the ${formatDollars(e.workerDeduction)} deduction for workers`}
                    />
                  )}
                  <Line label="Tax on taxable income" value={p.bracketTax} />
                  <Line
                    label="Credits"
                    value={Math.min(p.credits, p.bracketTax)}
                    negative
                    detail={
                      quebec ? "Basic personal amount" : `Basic personal amount, ${plan}${e.ei > 0 ? ", EI" : ""}`
                    }
                  />
                  {p.surtax > 0 && <Line label="Surtax" value={p.surtax} />}
                  {p.reduction > 0 && (
                    <Line label="Tax reduction" value={p.reduction} negative detail="For lower incomes" />
                  )}
                  {p.healthPremium > 0 && <Line label="Ontario Health Premium" value={p.healthPremium} />}
                  <Line label={`${p.name} tax`} value={p.tax} kind="subtotal" />
                </Group>

                <Group title={`${contributionsLabel} on self-employment`}>
                  <Line
                    label={`${plan}, both halves`}
                    value={e.pension.selfEmployedBase}
                    detail={`${formatPercent(2 * (planRates.baseRate + planRates.firstAdditionalRate))} up to ${formatDollars(rates.pension.ympe)}`}
                  />
                  {e.pension.selfEmployedSecond > 0 && (
                    <Line
                      label={`${plan}2`}
                      value={e.pension.selfEmployedSecond}
                      detail={`${formatPercent(2 * planRates.secondAdditionalRate)} from ${formatDollars(rates.pension.ympe)} to ${formatDollars(rates.pension.yampe)}`}
                    />
                  )}
                  {e.qpipSelfEmployed > 0 && <Line label="QPIP" value={e.qpipSelfEmployed} />}
                  {e.healthServicesFund > 0 && <Line label="Health Services Fund" value={e.healthServicesFund} />}
                  <Line label="Contributions" value={e.contributions} kind="subtotal" />
                </Group>

                <tbody>
                  <Line label={`Total for ${e.year}`} value={e.total} kind="total" />
                  {e.taxDeductedAtWork > 0 && (
                    <Line label="Tax deducted at work" value={e.taxDeductedAtWork} negative />
                  )}
                  {e.instalmentsPaid > 0 && <Line label="Instalments paid" value={e.instalmentsPaid} negative />}
                  {(e.taxDeductedAtWork > 0 || e.instalmentsPaid > 0) && (
                    <Line
                      label={e.balance < 0 ? "Expected refund" : `Left to pay by April 30, ${next}`}
                      value={Math.abs(e.balance)}
                      kind="total"
                    />
                  )}
                </tbody>
              </table>
              {e.employmentIncome > 0 && (
                <p className="hint">
                  Your employer also deducts {formatDollars(e.pension.employment)} {plan}
                  {e.ei > 0 ? ` and ${formatDollars(e.ei)} EI` : ""}
                  {e.qpipEmployment > 0 ? ` and ${formatDollars(e.qpipEmployment)} QPIP` : ""} from your pay, which
                  isn’t counted above.
                </p>
              )}
            </section>

            <section className="tax-section">
              <h3>{st.label}</h3>
              {st.registered ? (
                <table className="tax-table">
                  <tbody>
                    <Line
                      label={`${st.label} you charge`}
                      value={st.collected}
                      detail={`${formatPercent(st.rate, 3)} of ${formatDollars(st.collected / st.rate)}`}
                    />
                    {st.method === "quick" ? (
                      <>
                        <Line
                          label="Quick Method remittance"
                          value={st.remit + st.quickCredit}
                          detail={`${formatPercent(st.quickRate)} of sales including ${st.label}`}
                        />
                        {st.quickCredit > 0 && (
                          <Line label="1% credit" value={st.quickCredit} negative detail="On the first $30,000" />
                        )}
                      </>
                    ) : (
                      st.inputCredits > 0 && <Line label="Input tax credits" value={st.inputCredits} negative />
                    )}
                    <Line label={st.remit < 0 ? "Refund" : "To remit"} value={Math.abs(st.remit)} kind="subtotal" />
                  </tbody>
                </table>
              ) : st.mustRegister ? (
                <p className="callout">
                  Your revenue is over {formatDollars(rates.gst.smallSupplierLimit)}, so you need to register for{" "}
                  {st.label} and charge it. Once you do, set aside the {st.label} on each invoice as well.
                </p>
              ) : (
                <p className="hint">
                  Not registered. You don’t charge {st.label} until you register, which is required once revenue passes{" "}
                  {formatDollars(rates.gst.smallSupplierLimit)} in four consecutive quarters.
                </p>
              )}
              {quebec && <p className="hint">QST is reported to Revenu Québec separately and isn’t included here.</p>}
              {(e.province === "BC" || e.province === "MB" || e.province === "SK") && (
                <p className="hint">
                  Provincial sales tax, where it applies to your services, is filed separately and isn’t included.
                </p>
              )}
            </section>

            <section className="tax-section">
              <h3>When to pay</h3>
              <ul className="tax-dates">
                {e.instalmentsLikely && (
                  <li>
                    <strong>Instalments of about {formatDollars(e.quarterlyInstalment)}</strong> on March 15, June 15,
                    September 15 and December 15, if you also owed more than {formatDollars(e.instalmentThreshold)} in{" "}
                    {e.year - 1} or {e.year - 2}. CRA sends a reminder when they’re required.
                    {quebec
                      ? " Québec residents pay federal instalments to CRA and Québec instalments to Revenu Québec."
                      : ""}
                  </li>
                )}
                <li>
                  <strong>April 30, {next}:</strong> any balance of {taxAndContributions}
                  {st.registered ? `, and ${st.label} if you file annually` : ""}.
                </li>
                <li>
                  <strong>June 15, {next}:</strong> your return is due (self-employed filing deadline). Interest still
                  runs from April 30.
                </li>
              </ul>
            </section>
          </>
        )}

        <footer className="tax-notes">
          <p>
            An estimate for a sole proprietor, using {e.year} rates from {rates.source}. It includes the basic personal
            amount and the credits for {plan}
            {quebec ? ", EI and QPIP" : " and EI"}, but not other credits or deductions (tuition, medical, donations,
            dependants, moving or child care), benefits such as the GST/HST credit or Canada Workers Benefit, or
            low-income tax reductions outside BC and Ontario
            {quebec ? ", or the Québec prescription drug insurance premium" : ""}. Check with an accountant before you
            file.
          </p>
        </footer>
      </article>
    </div>
  );
}
