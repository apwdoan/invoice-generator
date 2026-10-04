import { newId, TAX_PRESETS, taxesFromPreset } from "../lib/state";
import type { TaxLine } from "../lib/types";
import { IconButton, RemoveIcon } from "./fields";

interface Props {
  taxes: TaxLine[];
  onChange: (taxes: TaxLine[]) => void;
}

/** The preset matching the current lines, if any, so the picker reflects what is set. */
function matchingPreset(taxes: TaxLine[]): string {
  const key = (list: { label: string; rate: string }[]) =>
    list.map((t) => `${t.label.trim().toUpperCase()}:${Number(t.rate)}`).join("|");
  const current = key(taxes);
  return TAX_PRESETS.find((p) => key(p.taxes) === current)?.id ?? "";
}

export function TaxEditor({ taxes, onChange }: Props) {
  const update = (id: string, patch: Partial<TaxLine>) =>
    onChange(taxes.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  return (
    <div className="taxes">
      <div className="field">
        <label htmlFor="tax-preset">Province or territory rates</label>
        <select
          id="tax-preset"
          value={matchingPreset(taxes)}
          onChange={(e) => {
            const preset = TAX_PRESETS.find((p) => p.id === e.target.value);
            if (preset) onChange(taxesFromPreset(preset));
          }}
        >
          <option value="" disabled>
            Custom rates
          </option>
          {TAX_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="hint">Fills in the taxes below. Which ones apply depends on the place of supply.</p>
      </div>

      {taxes.length > 0 && (
        <ul className="tax-lines">
          {taxes.map((tax, i) => (
            <li key={tax.id} className="tax-line">
              <input
                aria-label={`Tax ${i + 1} name`}
                placeholder="Name"
                value={tax.label}
                onChange={(e) => update(tax.id, { label: e.target.value })}
              />
              <div className="rate-input">
                <input
                  aria-label={`Tax ${i + 1} rate`}
                  className="num"
                  inputMode="decimal"
                  value={tax.rate}
                  onChange={(e) => update(tax.id, { rate: e.target.value })}
                />
                <span aria-hidden="true">%</span>
              </div>
              <IconButton label={`Remove ${tax.label || "tax"}`} onClick={() => onChange(taxes.filter((t) => t.id !== tax.id))}>
                <RemoveIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="text-button" onClick={() => onChange([...taxes, { id: newId(), label: "", rate: "" }])}>
        + Add tax
      </button>
    </div>
  );
}
