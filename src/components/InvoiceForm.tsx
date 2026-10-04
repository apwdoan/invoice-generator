import { dueDateFor, TERMS } from "../lib/dates";
import { CURRENCIES } from "../lib/money";
import { emptyClient } from "../lib/state";
import type { Client, Invoice, PaymentTerms } from "../lib/types";
import { Section, SelectField, TextArea, TextField } from "./fields";
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
            onChange={(issueDate) => set({ issueDate, dueDate: dueDateFor(issueDate, invoice.terms, invoice.dueDate) })}
          />
          <SelectField
            label="Payment terms"
            value={invoice.terms}
            onChange={(value) => {
              const terms = value as PaymentTerms;
              set({ terms, dueDate: dueDateFor(invoice.issueDate, terms, invoice.dueDate) });
            }}
          >
            {TERMS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectField>
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
            className="span-2"
            label="Email"
            type="email"
            placeholder="Optional"
            value={invoice.client.email}
            onChange={(email) => setClient({ email })}
          />
        </div>
      </Section>

      <Section title="Items">
        <LineItems items={invoice.items} currency={invoice.currency} taxName={taxName} onChange={(items) => set({ items })} />
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
