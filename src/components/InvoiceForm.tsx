import { useId } from "react";
import { DEFAULT_NET_DAYS, dueDateFor, isTerms, TERMS } from "../lib/dates";
import { computeTotals, CURRENCIES } from "../lib/money";
import { emptyClient, PRICING_OPTIONS } from "../lib/state";
import type { Client, Invoice, PaymentTerms, Pricing } from "../lib/types";
import { Adorned, Section, SelectField, TextArea, TextField } from "./fields";
import { LineItems } from "./LineItems";
import { TaxEditor } from "./TaxEditor";

interface Props {
  invoice: Invoice;
  clients: Client[];
  hasTaxNumber: boolean;
  onChange: (invoice: Invoice) => void;
  onForgetClient: (name: string) => void;
  onOpenBranding: () => void;
}

export function InvoiceForm({ invoice, clients, hasTaxNumber, onChange, onForgetClient, onOpenBranding }: Props) {
  const set = (patch: Partial<Invoice>) => onChange({ ...invoice, ...patch });
  const setClient = (patch: Partial<Client>) => set({ client: { ...invoice.client, ...patch } });
  const taxName = invoice.taxes
    .map((t) => t.label.trim())
    .filter(Boolean)
    .join("/");
  const savedMatch = clients.find((c) => c.name.trim().toLowerCase() === invoice.client.name.trim().toLowerCase());
  const termsId = useId();

  const setTerms = (terms: PaymentTerms, netDays = invoice.netDays) =>
    set({ terms, netDays, dueDate: dueDateFor(invoice.issueDate, terms, netDays, invoice.dueDate) });

  /** Switching to one flat rate starts it at the current total of the items, so the invoice doesn't change. */
  const setPricing = (pricing: Pricing) => {
    if (pricing === invoice.pricing) return;
    const subtotal = computeTotals(invoice).subtotal;
    const flatFee =
      pricing === "flat" && invoice.flatFee.trim() === "" && subtotal > 0 ? (subtotal / 100).toFixed(2) : invoice.flatFee;
    set({ pricing, flatFee });
  };

  return (
    <>
      <Section title="Details">
        <div className="grid-2">
          <TextField label="Invoice number" value={invoice.number} onChange={(number) => set({ number })} />
          <TextField
            label="Reference or PO"
            placeholder="Optional"
            value={invoice.reference}
            onChange={(reference) => set({ reference })}
          />
          <TextField
            label="Issue date"
            type="date"
            value={invoice.issueDate}
            onChange={(issueDate) =>
              set({ issueDate, dueDate: dueDateFor(issueDate, invoice.terms, invoice.netDays, invoice.dueDate) })
            }
          />
          <div className="field">
            <label htmlFor={termsId}>Payment terms</label>
            <div className={invoice.terms === "net" ? "terms-net" : undefined}>
              <select
                id={termsId}
                value={invoice.terms}
                onChange={(e) => {
                  if (isTerms(e.target.value)) setTerms(e.target.value);
                }}
              >
                {TERMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {invoice.terms === "net" && (
                <Adorned suffix="days">
                  <input
                    className="num"
                    aria-label="Days until due"
                    inputMode="numeric"
                    placeholder={DEFAULT_NET_DAYS}
                    value={invoice.netDays}
                    onChange={(e) => setTerms("net", e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onBlur={() => {
                      if (invoice.netDays === "") setTerms("net", DEFAULT_NET_DAYS);
                    }}
                  />
                </Adorned>
              )}
            </div>
          </div>
          <TextField
            label="Due date"
            type="date"
            value={invoice.dueDate}
            onChange={(dueDate) => set({ dueDate, terms: "custom" })}
          />
          <SelectField label="Currency" value={invoice.currency} onChange={(currency) => set({ currency })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
        </div>
      </Section>

      <Section
        title="Bill to"
        aside={
          clients.length > 0 && (
            <select
              className="compact-select"
              aria-label="Fill in a saved client"
              value=""
              onChange={(e) => {
                const client = clients.find((c) => c.name === e.target.value);
                if (client) set({ client: { ...emptyClient(), ...client } });
              }}
            >
              <option value="" disabled>
                Saved clients
              </option>
              {clients.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )
        }
      >
        <div className="grid-2">
          <TextField
            label="Client or company"
            value={invoice.client.name}
            onChange={(name) => setClient({ name })}
            hint={
              savedMatch ? (
                <>
                  Saved client.{" "}
                  <button type="button" className="inline-link" onClick={() => onForgetClient(savedMatch.name)}>
                    Forget
                  </button>
                </>
              ) : undefined
            }
          />
          <TextField label="Contact person" placeholder="Optional" value={invoice.client.contact} onChange={(contact) => setClient({ contact })} />
          <TextArea
            className="span-2"
            label="Address"
            rows={3}
            value={invoice.client.address}
            onChange={(address) => setClient({ address })}
          />
          <TextField
            label="Email"
            type="email"
            placeholder="Optional"
            value={invoice.client.email}
            onChange={(email) => setClient({ email })}
          />
          <TextField
            label="Phone"
            type="tel"
            placeholder="Optional"
            value={invoice.client.phone}
            onChange={(phone) => setClient({ phone })}
          />
        </div>
      </Section>

      <Section
        title="Items"
        aside={
          <div className="segmented" role="radiogroup" aria-label="How items are priced">
            {PRICING_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={invoice.pricing === o.value}
                onClick={() => setPricing(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        }
      >
        <LineItems
          items={invoice.items}
          currency={invoice.currency}
          taxName={taxName}
          pricing={invoice.pricing}
          flatFee={invoice.flatFee}
          onChange={(items) => set({ items })}
          onFlatFeeChange={(flatFee) => set({ flatFee })}
        />
      </Section>

      <Section title="Tax">
        <TaxEditor taxes={invoice.taxes} onChange={(taxes) => set({ taxes })} />
        {invoice.taxes.length > 0 && !hasTaxNumber && (
          <p className="callout">
            Your GST/HST registration number isn’t on this invoice yet.{" "}
            <button type="button" className="inline-link" onClick={onOpenBranding}>
              Add it in Branding
            </button>
          </p>
        )}
      </Section>

      <Section title="Notes">
        <TextArea
          label="Shown below the totals"
          rows={4}
          placeholder="Payment instructions, late fees, a thank-you"
          value={invoice.notes}
          onChange={(notes) => set({ notes })}
        />
      </Section>
    </>
  );
}
