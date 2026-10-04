import { Font } from "@react-pdf/renderer";
import type { InvoiceFont } from "../lib/types";

export const FONT_FAMILY: Record<InvoiceFont, string> = {
  sans: "Invoice Sans",
  serif: "Invoice Serif",
  mono: "Invoice Mono",
};

export interface FontFiles {
  regular: string;
  italic: string;
  semibold: string;
}

/**
 * TTF files in src/assets/fonts, converted from the @fontsource WOFF builds
 * (Latin subset). TTF is used because fontkit cannot read some WOFF glyph tables.
 */
export const FONT_FILES: Record<InvoiceFont, FontFiles> = {
  sans: { regular: "plex-sans-regular.ttf", italic: "plex-sans-italic.ttf", semibold: "plex-sans-semibold.ttf" },
  serif: {
    regular: "source-serif-regular.ttf",
    italic: "source-serif-italic.ttf",
    semibold: "source-serif-semibold.ttf",
  },
  mono: { regular: "plex-mono-regular.ttf", italic: "plex-mono-italic.ttf", semibold: "plex-mono-semibold.ttf" },
};

let registered = false;

/** Registers the three invoice typefaces from URLs (in the app) or file paths (in Node). */
export function registerInvoiceFonts(sources: Record<InvoiceFont, FontFiles>): void {
  if (registered) return;
  registered = true;
  for (const key of Object.keys(sources) as InvoiceFont[]) {
    const files = sources[key];
    Font.register({
      family: FONT_FAMILY[key],
      fonts: [
        { src: files.regular, fontWeight: 400 },
        { src: files.italic, fontWeight: 400, fontStyle: "italic" },
        { src: files.semibold, fontWeight: 600 },
      ],
    });
  }
  // Invoices read better without words split across lines.
  Font.registerHyphenationCallback((word) => [word]);
}
