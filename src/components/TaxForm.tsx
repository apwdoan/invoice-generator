import type { Estimate } from "../lib/taxEstimate";
import { PROVINCE_ORDER, TAX_YEARS } from "../lib/taxRates";
import { formatDollars, formatPercent, tidyAmount } from "../lib/taxSettings";
import type { TaxSettings } from "../lib/types";
import { Checkbox, MoneyField, PercentField, Section, SelectField } from "./fields";

type AmountKey =
  "revenue" | "expenses" | "employmentIncome" | "taxDeductedAtWork" | "rrsp" | "instalmentsPaid" | "gstOnExpenses";

interface Props {
  settings: TaxSettings;
  estimate: Estimate;
  onChange: (patch: Partial<TaxSettings>) => void;
}

export function TaxForm({ settings, estimate, onChange }: Props) {
  const rates = TAX_YEARS[settings.year];
  const st = estimate.salesTax;
  const years = Object.keys(TAX_YEARS)
    .map(Number)
    .sort((a, b) => b - a);

  const amount = (key: AmountKey) => ({
    value: settings[key],
    onChange: (value: string) => onChange({ [key]: value }),
    onBlur: () => onChange({ [key]: tidyAmount(settings[key]) }),
  });

  return (
    <>
      <Section title="Where and when">
        <div className="grid-2">
          <SelectField
            label="Province or territory"
            hint="Where you live on December 31."
            value={settings.province}
            onChange={(province) => onChange({ province: province as TaxSettings["province"] })}
          >
            {PROVINCE_ORDER.map((code) => (
              <option key={code} value={code}>
                {rates.provinces[code].name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Tax year"
            value={String(settings.year)}
            onChange={(year) => onChange({ year: Number(year) })}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectField>
        </div>
      </Section>

      <Section title="Your business">
        <MoneyField
          label={`Revenue for ${settings.year}`}
          placeholder="0"
          hint="Before GST/HST. Count the invoices you expect to send by December 31, not only the ones paid."
          {...amount("revenue")}
        />
        <MoneyField
          label="Business expenses"
          placeholder="0"
          hint={
            st.registered && st.method === "regular"
              ? `Software, equipment, phone, a share of your home office and vehicle. Leave out the ${st.label} you claim back.`
              : "Software, equipment, phone, a share of your home office and vehicle."
          }
          {...amount("expenses")}
        />
      </Section>

      <Section title="Other income and payments">
        <div className="grid-2">
          <MoneyField
            label="Employment income"
            placeholder="0"
            hint="From a job (T4), if you have one."
            {...amount("employmentIncome")}
          />
          <MoneyField
            label="Tax deducted at work"
            placeholder="0"
            hint="Income tax on your pay stubs or T4."
            {...amount("taxDeductedAtWork")}
          />
          <MoneyField
            label="RRSP and FHSA deductions"
            placeholder="0"
            hint="Lowers income tax, not CPP."
            {...amount("rrsp")}
          />
          <MoneyField
            label="Instalments already paid"
            placeholder="0"
            hint={`Paid toward ${settings.year} so far.`}
            {...amount("instalmentsPaid")}
          />
        </div>
      </Section>

      <Section title="GST/HST">
        <Checkbox
          label={`I’m registered for ${st.label} and charge it on invoices`}
          checked={settings.gstRegistered}
          onChange={(gstRegistered) => onChange({ gstRegistered })}
        />
        {settings.gstRegistered ? (
          <>
            <div className="field">
              <span className="label" id="gst-method-label">
                Accounting method
              </span>
              <div className="segmented segmented-field" role="radiogroup" aria-labelledby="gst-method-label">
                {(
                  [
                    ["regular", "Regular"],
                    ["quick", "Quick Method"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={settings.gstMethod === value}
                    onClick={() => onChange({ gstMethod: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {settings.gstMethod === "quick" ? (
                st.quickAvailable ? (
                  <p className="hint">
                    You remit {formatPercent(st.quickRate)} of your sales including {st.label} and keep the rest, which
                    is taxed as income. You can’t claim {st.label} on expenses except capital purchases. It has to be
                    elected with CRA, and isn’t open to accountants, bookkeepers, lawyers or financial consultants.
                  </p>
                ) : (
                  <p className="hint hint-warn">
                    The Quick Method is only for revenue up to {formatDollars(rates.gst.quickMethodLimit)}, so this uses
                    the regular method.
                  </p>
                )
              ) : (
                <p className="hint">
                  Remit the {st.label} you charge, less the {st.label} you paid on business expenses.
                </p>
              )}
            </div>
            <div className="grid-2 align-end">
              <PercentField
                label={`Revenue you charge ${st.label} on`}
                hint="Lower it for clients outside Canada."
                value={settings.taxableShare}
                onChange={(taxableShare) => onChange({ taxableShare })}
              />
              {st.method === "regular" && (
                <MoneyField
                  label={`${st.label} paid on expenses`}
                  placeholder="0"
                  hint="Claimed back as input tax credits."
                  {...amount("gstOnExpenses")}
                />
              )}
            </div>
          </>
        ) : st.mustRegister ? (
          <p className="callout">
            With revenue over {formatDollars(rates.gst.smallSupplierLimit)} you’re no longer a small supplier, so you
            have to register for GST/HST and start charging it.
          </p>
        ) : (
          <p className="hint">
            Registration is optional until your revenue passes {formatDollars(rates.gst.smallSupplierLimit)} in four
            consecutive quarters.
          </p>
        )}
      </Section>
    </>
  );
}
