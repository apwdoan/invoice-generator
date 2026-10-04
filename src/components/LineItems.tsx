import { useId } from "react";
import { formatMoney, lineCents, parseAmount } from "../lib/money";
import { emptyItem } from "../lib/state";
import type { LineItem } from "../lib/types";
import { DownIcon, IconButton, RemoveIcon, UpIcon } from "./fields";

/** Shows typed prices with at least two decimals ("145" becomes "145.00"), keeping any extra precision. */
function tidyPrice(input: string): string {
  if (input.trim() === "") return "";
  const n = parseAmount(input);
  const decimals = (String(n).split(".")[1] ?? "").length;
  return n.toFixed(Math.min(Math.max(2, decimals), 6));
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
  const id = useId();
  return (
    <li className="item">
      <div className="item-main">
        <input
          className="item-description"
          aria-label={`Item ${index + 1} description`}
          placeholder="What you did or supplied"
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <input
          className="item-detail"
          aria-label={`Item ${index + 1} details`}
          placeholder="Details (optional)"
          value={item.detail}
          onChange={(e) => onChange({ detail: e.target.value })}
        />
        <div className="item-numbers">
          <label htmlFor={`${id}-qty`}>Qty</label>
          <input
            id={`${id}-qty`}
            className="num qty"
            inputMode="decimal"
            value={item.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
          />
          <label htmlFor={`${id}-rate`}>Rate</label>
          <input
            id={`${id}-rate`}
            className="num rate"
            inputMode="decimal"
            placeholder="0.00"
            value={item.unitPrice}
            onChange={(e) => onChange({ unitPrice: e.target.value })}
            onBlur={() => onChange({ unitPrice: tidyPrice(item.unitPrice) })}
          />
          {taxName && (
            <label className="item-tax" title={`Charge ${taxName} on this item`}>
              <input type="checkbox" checked={item.taxable} onChange={(e) => onChange({ taxable: e.target.checked })} />
              {taxName}
            </label>
          )}
          <output className="item-amount" aria-label={`Item ${index + 1} amount`}>
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
      <button type="button" className="text-button" onClick={() => onChange([...items, emptyItem()])}>
        + Add item
      </button>
    </>
  );
}
