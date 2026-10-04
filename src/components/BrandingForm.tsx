import { useRef, useState, type DragEvent } from "react";
import { contrastWithWhite, isHexColor } from "../lib/color";
import { readLogo } from "../lib/logo";
import { checkGstNumber, formatGstNumber, looksLikeGstLabel } from "../lib/registration";
import { ACCENTS, formatInvoiceNumber } from "../lib/state";
import type { BusinessProfile, InvoiceFont, Settings } from "../lib/types";
import { Checkbox, Section, TextArea, TextField } from "./fields";

interface Props {
  profile: BusinessProfile;
  settings: Settings;
  onProfile: (patch: Partial<BusinessProfile>) => void;
  onSettings: (patch: Partial<Settings>) => void;
}

const FONTS: { value: InvoiceFont; label: string; family: string }[] = [
  { value: "sans", label: "Sans", family: "var(--font-invoice-sans)" },
  { value: "serif", label: "Serif", family: "var(--font-invoice-serif)" },
  { value: "mono", label: "Mono", family: "var(--font-invoice-mono)" },
];

function gstHint(profile: BusinessProfile): { text: string; tone: "neutral" | "good" | "warn" } {
  if (!looksLikeGstLabel(profile.taxNumberLabel)) return { text: "Printed under your contact details.", tone: "neutral" };
  switch (checkGstNumber(profile.taxNumber)) {
    case "empty":
      return { text: "Printed under your contact details. Format: 123456789 RT0001.", tone: "neutral" };
    case "valid":
      return { text: "Format looks right.", tone: "good" };
    case "missing-program":
      return { text: "That’s your business number. Add the program account, e.g. RT0001.", tone: "warn" };
    default:
      return { text: "GST/HST numbers are 9 digits, then RT and 4 digits, like 123456789 RT0001.", tone: "warn" };
  }
}

function LogoPicker({ profile, onProfile }: Pick<Props, "profile" | "onProfile">) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      onProfile({ logo: await readLogo(file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void accept(e.dataTransfer.files[0]);
  };

  return (
    <div className="field">
      <span className="label">Logo</span>
      <div
        className={`logo-drop ${dragging ? "is-dragging" : ""} ${profile.logo ? "has-logo" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {profile.logo ? (
          <img src={profile.logo.dataUrl} alt="Your logo" />
        ) : (
          <p>Drop an image here, or choose a file. PNG, JPG and SVG all work; transparent edges are trimmed.</p>
        )}
        <div className="logo-actions">
          <button type="button" className="button" onClick={() => input.current?.click()}>
            {profile.logo ? "Replace logo" : "Choose logo"}
          </button>
          {profile.logo && (
            <button type="button" className="text-button" onClick={() => onProfile({ logo: null })}>
              Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
          hidden
          onChange={(e) => {
            void accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="hint hint-warn">{error}</p>}
    </div>
  );
}

export function BrandingForm({ profile, settings, onProfile, onSettings }: Props) {
  const hint = gstHint(profile);
  const paleAccent = isHexColor(profile.accent) && contrastWithWhite(profile.accent) < 4.5;

  return (
    <>
      <Section title="Logo and name">
        <LogoPicker profile={profile} onProfile={onProfile} />
        {profile.logo && (
          <div className="grid-2 align-end">
            <div className="field">
              <label htmlFor="logo-size">Logo height</label>
              <input
                id="logo-size"
                type="range"
                min={24}
                max={96}
                step={2}
                value={profile.logoHeight}
                onChange={(e) => onProfile({ logoHeight: Number(e.target.value) })}
              />
            </div>
            <Checkbox
              label="Also print the business name"
              checked={profile.showName}
              onChange={(showName) => onProfile({ showName })}
            />
          </div>
        )}
        <TextField label="Business name" value={profile.name} onChange={(name) => onProfile({ name })} />
      </Section>

      <Section title="Contact details">
        <TextArea label="Address" rows={3} value={profile.address} onChange={(address) => onProfile({ address })} />
        <div className="grid-2">
          <TextField label="Email" type="email" value={profile.email} onChange={(email) => onProfile({ email })} />
          <TextField label="Phone" type="tel" value={profile.phone} onChange={(phone) => onProfile({ phone })} />
          <TextField className="span-2" label="Website" value={profile.website} onChange={(website) => onProfile({ website })} />
        </div>
      </Section>

      <Section title="Tax registration">
        <div className="grid-label-value">
          <TextField
            label="Label"
            value={profile.taxNumberLabel}
            onChange={(taxNumberLabel) => onProfile({ taxNumberLabel })}
          />
          <TextField
            id="gst-number"
            label="GST/HST registration number"
            placeholder="123456789 RT0001"
            value={profile.taxNumber}
            onChange={(taxNumber) => onProfile({ taxNumber })}
            onBlur={() => looksLikeGstLabel(profile.taxNumberLabel) && onProfile({ taxNumber: formatGstNumber(profile.taxNumber) })}
            hint={hint.text}
            hintTone={hint.tone}
            spellCheck={false}
          />
          <TextField
            label="Second label"
            placeholder="QST No."
            value={profile.extraTaxNumberLabel}
            onChange={(extraTaxNumberLabel) => onProfile({ extraTaxNumberLabel })}
          />
          <TextField
            label="Second registration number"
            placeholder="Optional, e.g. for QST or PST"
            value={profile.extraTaxNumber}
            onChange={(extraTaxNumber) => onProfile({ extraTaxNumber })}
            spellCheck={false}
          />
        </div>
      </Section>

      <Section title="Look">
        <div className="field">
          <span className="label">Brand colour</span>
          <div className="swatches" role="radiogroup" aria-label="Brand colour">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={profile.accent.toLowerCase() === c.toLowerCase()}
                aria-label={c}
                className="swatch"
                style={{ background: c }}
                onClick={() => onProfile({ accent: c })}
              />
            ))}
            <label className="swatch swatch-custom" title="Pick any colour">
              <input
                type="color"
                aria-label="Custom brand colour"
                value={isHexColor(profile.accent) ? profile.accent : "#23395b"}
                onChange={(e) => onProfile({ accent: e.target.value })}
              />
            </label>
            <input
              className="hex-input"
              aria-label="Brand colour hex code"
              value={profile.accent}
              maxLength={7}
              spellCheck={false}
              onChange={(e) => {
                const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                onProfile({ accent: v });
              }}
            />
          </div>
          {paleAccent && (
            <p className="hint">This colour is light, so text that uses it is darkened slightly to stay readable.</p>
          )}
        </div>

        <div className="field">
          <span className="label">Typeface</span>
          <div className="font-options" role="radiogroup" aria-label="Typeface">
            {FONTS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={profile.font === f.value}
                className="font-option"
                onClick={() => onProfile({ font: f.value })}
              >
                <span className="font-sample" style={{ fontFamily: f.family }}>
                  Aa 123
                </span>
                <span className="font-name">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Numbering and defaults">
        <div className="grid-2">
          <TextField
            label="Number prefix"
            value={settings.numberPrefix}
            onChange={(numberPrefix) => onSettings({ numberPrefix })}
          />
          <TextField
            label="Next number"
            type="number"
            min={1}
            value={String(settings.nextNumber)}
            onChange={(v) => onSettings({ nextNumber: Math.max(1, Math.floor(Number(v) || 1)) })}
            hint={`Next new invoice: ${formatInvoiceNumber(settings, settings.nextNumber)}`}
          />
        </div>
        <TextArea
          label="Default notes for new invoices"
          rows={3}
          placeholder="e.g. Pay by Interac e-Transfer to billing@yourcompany.ca"
          value={profile.defaultNotes}
          onChange={(defaultNotes) => onProfile({ defaultNotes })}
        />
        <TextField label="Footer" value={profile.footer} onChange={(footer) => onProfile({ footer })} />
      </Section>
    </>
  );
}
