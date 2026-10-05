import { contrastWithWhite, isHexColor, mix, mutedFrom, readableOnWhite, tintOf } from "../lib/color";
import type { BrandColors } from "../lib/types";

const NEUTRAL_INK = "#1B2129";

export interface InvoiceTheme {
  /** Body text. The primary colour itself when it is dark enough to read as near-black. */
  ink: string;
  /** Title, totals and the heavier rules. */
  primary: string;
  /** Labels and secondary text: a quiet colour in the primary's hue. */
  muted: string;
  /** Row dividers. */
  hairline: string;
  /** The amount due. */
  accentText: string;
  /** Background of the amount due panel. */
  accentWash: string;
  /** Top band, as gradient stops from left to right (one stop means solid). */
  band: string[];
}

/**
 * Turns the three brand colours into every colour the invoice uses, keeping
 * text readable whatever was picked: pale colours are darkened for text and
 * only used at full strength in the decorative band.
 */
export function invoiceTheme(colors: BrandColors): InvoiceTheme {
  const valid = (c: string, fallback: string) => (isHexColor(c) ? c.toUpperCase() : fallback);
  const primarySource = valid(colors.primary, "#23395B");
  const accentSource = valid(colors.accent, primarySource);
  const highlight = valid(colors.highlight, accentSource);

  const primary = readableOnWhite(primarySource, 7);
  const muted = mutedFrom(primary);
  return {
    ink: contrastWithWhite(primary) >= 12 ? primary : NEUTRAL_INK,
    primary,
    muted,
    hairline: mix(muted, "#FFFFFF", 0.78),
    accentText: readableOnWhite(accentSource, 4.5),
    accentWash: tintOf(accentSource),
    band: highlight === accentSource ? [accentSource] : [accentSource, highlight],
  };
}
