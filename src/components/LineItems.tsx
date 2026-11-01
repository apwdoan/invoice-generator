import type { CSSProperties, ReactNode } from "react";
import { currencySymbol, formatMoney, lineCents, parseAmount } from "../lib/money";
import { BILLING_OPTIONS, emptyItem, isBilling } from "../lib/state";
import type { Billing, LineItem } from "../lib/types";
import { DownIcon, IconButton, RemoveIcon, UpIcon } from "./fields";

/** Shows typed prices with at least two decimals ("145" becomes "145.00"), keeping any extra precision. */
function tidyPrice(input: string): string {
  if (input.trim() === "") return "";
  const n = parseAmount(input);
  const decimals = (String(n).split(".")[1] ?? "").length;
  return n.toFixed(Math.min(Math.max(2, decimals), 6));
}

/** Wording for the number fields of items that multiply a quantity by a price. */
const UNITS: Record<Exclude<Billing, "flat">, { quantity: string; quantitySuffix: string; price: string; priceSuffix: string }> = {
  hourly: { quantity: "hours", quantitySuffix: "hrs", price: "hourly rate", priceSuffix: "/hr" },
  unit: { quantity: "quantity", quantitySuffix: "", price: "unit price", priceSuffix: "each" },
};

/**
 * The fields to change when an item switches billing type. The line's amount stays
 * the same: switching to a flat rate turns the current total into the flat amount,
 * and switching away from one starts at 1 hour (or unit) at that amount.
 */
function switchBilling(item: LineItem, billing: Billing): Partial<LineItem> {
  if (billing === item.billing) return {};
  if (billing === "flat") {
    const cents = lineCents(item);
    const unitPrice = parseAmount(item.quantity) === 1 ? item.unitPrice : cents === 0 ? "" : (cents / 100).toFixed(2);
    return { billing, quantity: "1", unitPrice };
  }
  if (item.billing === "flat") return { billing, quantity: "1" };
  return { billing };
}

/** An input with a currency symbol in front and/or a unit after it. */
function Adorned({ prefix, suffix, children }: { prefix?: string; suffix?: string; children: ReactNode }) {
  return (
    <div
      className={`adorned ${prefix ? "has-prefix" : ""}`}
      style={suffix ? ({ "--suffix-width": `calc(${suffix.length}ch + 4px)` } as CSSProperties) : undefined}
    >
      {prefix && (
        <span className="prefix" aria-hidden="true">
          {prefix}
        </span>
      )}
      {children}
      {suffix && (
        <span className="suffix" aria-hidden="true">
          {suffix}
        </span>
      )}
    </div>
  );
}

interface Props {
  items: LineItem[];
  currency: string;
  /** e.g. "GST" or "GST/PST"; empty when no tax is charged. */
  taxName: string;
  onChange: (items: LineItem[]) => void;
}

function ItemRow({
  item,
  index,
  count,
  currency,
  taxName,
  onChange,
  onRemove,
  onMove,
}: {
  item: LineItem;
  index: number;
  count: number;
  currency: string;
  taxName: string;
  onChange: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const n = index + 1;
  const symbol = currencySymbol(currency);
  const units = item.billing === "flat" ? null : UNITS[item.billing];
  const price = (label: string) => (
    <input
      className={`num ${units ? "rate" : "flat"}`}
      aria-label={`Item ${n} ${label}`}
      inputMode="decimal"
      placeholder="0.00"
      value={item.unitPrice}
      onChange={(e) => onChange({ unitPrice: e.target.value })}
      onBlur={() => onChange({ unitPrice: tidyPrice(item.unitPrice) })}
    />
  );

  return (
    <li className="item">
      <div className="item-main">
        <input
          className="item-description"
          aria-label={`Item ${n} description`}
          placeholder="What you did or supplied"
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <div className="item-sub">
          <input
            className="item-detail"
            aria-label={`Item ${n} details`}
            placeholder="Details (optional)"
            value={item.detail}
            onChange={(e) => onChange({ detail: e.target.value })}
          />
          <select
            className="item-billing"
            aria-label={`Item ${n} billing`}
            title="How this item is priced"
            value={item.billing}
            onChange={(e) => {
              const billing = e.target.value;
              if (isBilling(billing)) onChange(switchBilling(item, billing));
            }}
          >
            {BILLING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="item-numbers">
          {units ? (
            <>
              <Adorned suffix={units.quantitySuffix}>
                <input
                  className="num qty"
                  aria-label={`Item ${n} ${units.quantity}`}
                  inputMode="decimal"
                  placeholder="0"
                  value={item.quantity}
                  onChange={(e) => onChange({ quantity: e.target.value })}
                />
              </Adorned>
              <span className="times" aria-hidden="true">
                ×
              </span>
              <Adorned prefix={symbol} suffix={units.priceSuffix}>
                {price(units.price)}
              </Adorned>
            </>
          ) : (
            <Adorned prefix={symbol}>{price("flat amount")}</Adorned>
          )}
          {taxName && (
            <label className="item-tax" title={`Charge ${taxName} on this item`}>
              <input type="checkbox" checked={item.taxable} onChange={(e) => onChange({ taxable: e.target.checked })} />
              {taxName}
            </label>
          )}
          <output className="item-amount" aria-label={`Item ${n} amount`}>
            {formatMoney(lineCents(item), currency)}
          </output>
        </div>
      </div>
      <div className="item-tools">
        <IconButton label="Move up" onClick={() => onMove(-1)} disabled={index === 0}>
          <UpIcon />
        </IconButton>
        <IconButton label="Move down" onClick={() => onMove(1)} disabled={index === count - 1}>
          <DownIcon />
        </IconButton>
        <IconButton label="Remove item" onClick={onRemove}>
          <RemoveIcon />
        </IconButton>
      </div>
    </li>
  );
}

export function LineItems({ items, currency, taxName, onChange }: Props) {
  const update = (id: string, patch: Partial<LineItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const remove = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    onChange(next.length ? next : [emptyItem()]);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <>
      <ul className="items">
        {items.map((item, index) => (
          <ItemRow
            key={item.id}
            item={item}
            index={index}
            count={items.length}
            currency={currency}
            taxName={taxName}
            onChange={(patch) => update(item.id, patch)}
            onRemove={() => remove(item.id)}
            onMove={(delta) => move(index, delta)}
          />
        ))}
      </ul>
      {/* A new item is billed the same way as the one above it. */}
      <button type="button" className="text-button" onClick={() => onChange([...items, emptyItem(items[items.length - 1]?.billing)])}>
        + Add item
      </button>
    </>
  );
}
