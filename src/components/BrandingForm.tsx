import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { contrastWithWhite, isHexColor } from "../lib/color";
import { readLogo } from "../lib/logo";
import { paletteFromImage, suggestColors } from "../lib/palette";
import { checkGstNumber, formatGstNumber, looksLikeGstLabel } from "../lib/registration";
import { formatInvoiceNumber, logoHeightFor, NEUTRAL_COLORS, PRESET_COLORS } from "../lib/state";
import type { BrandColors, BusinessProfile, InvoiceFont, Settings } from "../lib/types";
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

function sameColor(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function sameColors(a: BrandColors, b: BrandColors): boolean {
  return sameColor(a.primary, b.primary) && sameColor(a.accent, b.accent) && sameColor(a.highlight, b.highlight);
}

function LogoPicker({ profile, onProfile }: Pick<Props, "profile" | "onProfile">) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const logo = await readLogo(file);
      // A new logo brings its own colours and a height suited to its shape.
      onProfile({
        logo,
        logoHeight: logoHeightFor(logo.width, logo.height),
        ...(logo.palette.length ? { colors: suggestColors(logo.palette, profile.colors) } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Removing the logo also drops its colours, unless they were changed by hand afterwards. */
  const removeLogo = () => {
    const palette = profile.logo?.palette ?? [];
    const fromLogo = palette.length > 0 && sameColors(suggestColors(palette, profile.colors), profile.colors);
    onProfile({ logo: null, ...(fromLogo ? { colors: { ...NEUTRAL_COLORS } } : {}) });
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
          <p>Drop your logo here or choose a file (PNG, JPG or SVG). The invoice takes its colours from it.</p>
        )}
        <div className="logo-actions">
          <button type="button" className="button" onClick={() => input.current?.click()}>
            {profile.logo ? "Replace logo" : "Choose logo"}
          </button>
          {profile.logo && (
            <button type="button" className="text-button" onClick={removeLogo}>
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

function ColorRow({
  label,
  hint,
  value,
  swatches,
  minContrast,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  swatches: string[];
  /** When set, warns that a paler colour will be darkened for text. */
  minContrast?: number;
  onChange: (color: string) => void;
}) {
  const id = useId();
  const darkened = minContrast !== undefined && isHexColor(value) && contrastWithWhite(value) < minContrast;
  return (
    <div className="color-row">
      <p className="color-row-head">
        <span className="label" id={`${id}-label`}>
          {label}
        </span>
        <span className="hint">{hint}</span>
      </p>
      <div className="swatches" role="radiogroup" aria-labelledby={`${id}-label`}>
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={sameColor(value, c)}
            aria-label={c}
            title={c}
            className="swatch"
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
        <label className="swatch swatch-custom" title="Pick any colour">
          <input
            type="color"
            aria-label={`Custom ${label.toLowerCase()} colour`}
            value={isHexColor(value) ? value.toLowerCase() : "#23395b"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
          />
        </label>
        <input
          className="hex-input"
          aria-label={`${label} colour hex code`}
          value={value}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
        />
      </div>
      {darkened && <p className="hint">Text in this colour is darkened slightly so it stays readable on white.</p>}
    </div>
  );
}

function ColorsSection({ profile, onProfile }: Pick<Props, "profile" | "onProfile">) {
  const logo = profile.logo;
  const palette = logo?.palette ?? [];

  // Logos saved before colour extraction existed get their palette on first view.
  useEffect(() => {
    if (!logo || logo.palette.length) return;
    let cancelled = false;
    paletteFromImage(logo.dataUrl)
      .then((found) => !cancelled && found.length > 0 && onProfile({ logo: { ...logo, palette: found } }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [logo, onProfile]);

  const suggested = palette.length ? suggestColors(palette, profile.colors) : null;
  const swatches = palette.length ? palette : PRESET_COLORS;
  const setColor = (role: keyof BrandColors) => (color: string) => onProfile({ colors: { ...profile.colors, [role]: color } });

  return (
    <Section title="Colours">
      {!logo && <p className="hint">Upload a logo and these are filled in from its colours. You can also pick them yourself.</p>}
      {suggested && (
        <div className="logo-palette">
          <div className="logo-palette-swatches" aria-hidden="true">
            {palette.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </div>
          {sameColors(suggested, profile.colors) ? (
            <span className="hint">Using your logo’s colours</span>
          ) : (
            <button type="button" className="button" onClick={() => onProfile({ colors: suggested })}>
              Use logo colours
            </button>
          )}
        </div>
      )}
      <ColorRow
        label="Main"
        hint="Title, totals and lines"
        value={profile.colors.primary}
        swatches={swatches}
        minContrast={7}
        onChange={setColor("primary")}
      />
      <ColorRow
        label="Accent"
        hint="Amount due and the top band"
        value={profile.colors.accent}
        swatches={swatches}
        minContrast={4.5}
        onChange={setColor("accent")}
      />
      <ColorRow
        label="Highlight"
        hint="Where the top band fades to. Match the accent for a solid band."
        value={profile.colors.highlight}
        swatches={swatches}
        onChange={setColor("highlight")}
      />
    </Section>
  );
}

export function BrandingForm({ profile, settings, onProfile, onSettings }: Props) {
  const hint = gstHint(profile);

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
                max={120}
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
        <TextField
          label="Business name"
          placeholder="Your business name"
          value={profile.name}
          onChange={(name) => onProfile({ name })}
        />
      </Section>

      <ColorsSection profile={profile} onProfile={onProfile} />

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

      <Section title="Typeface">
        <div className="field">
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
