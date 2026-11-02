import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoiceDocument, type InvoiceDocumentProps } from "./InvoiceDocument";

/** The furthest the content shrinks to fit one page: 9.5pt body text becomes about 7pt. */
export const MIN_SCALE = 0.75;

/** Halvings between MIN_SCALE and full size; five lands within 1% of the largest scale that fits. */
const SEARCH_STEPS = 5;

export interface RenderedInvoice {
  bytes: Uint8Array;
  pages: number;
  /** 1 at full size, less when the content was shrunk to fit one page. */
  scale: number;
  /** Fitting was asked for but the content needs more than one page even at MIN_SCALE. */
  tooLong: boolean;
}

export interface RenderOptions {
  /** Shrink the content as little as needed for it all to fit on one page. */
  fitOnePage?: boolean;
  /** Stops a fit search early, for a preview that has been replaced by a newer one. */
  signal?: AbortSignal;
}

/** Lays out the invoice at one scale and returns the finished PDF file as bytes. */
async function renderAt(props: InvoiceDocumentProps, scale: number) {
  // pdf() expects a <Document> element; InvoiceDocument returns one.
  const instance = pdf(createElement(InvoiceDocument, { ...props, scale }) as Parameters<typeof pdf>[0]);
  const blob = await instance.toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, pages: pageCount(bytes), scale };
}

/** Reads the page count from the PDF's page tree, which react-pdf writes as plain text. */
export function pageCount(bytes: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(bytes);
  const count = /\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/.exec(text);
  return count ? Number(count[1]) : (text.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
}

/** The scale found for recent invoices, so Export reuses what the preview worked out. */
const fitted = new Map<string, number>();

function remember(key: string, scale: number) {
  fitted.delete(key);
  fitted.set(key, scale);
  if (fitted.size > 8) fitted.delete(fitted.keys().next().value as string);
}

/**
 * Lays out the invoice and returns the finished PDF. With fitOnePage, content that runs
 * past one page is shrunk by the least amount that brings it back to one, down to
 * MIN_SCALE; anything longer than that keeps its full size and its extra pages.
 */
export async function renderInvoicePdf(props: InvoiceDocumentProps, options: RenderOptions = {}): Promise<RenderedInvoice> {
  const full = await renderAt(props, 1);
  if (!options.fitOnePage || full.pages <= 1) return { ...full, tooLong: false };

  const key = JSON.stringify(props);
  const known = fitted.get(key);
  if (known !== undefined) {
    const again = await renderAt(props, known);
    if (again.pages === 1) return { ...again, tooLong: false };
  }

  const stop = () => {
    if (options.signal?.aborted) throw new DOMException("Replaced by a newer render", "AbortError");
  };
  stop();
  const smallest = await renderAt(props, MIN_SCALE);
  if (smallest.pages > 1) return { ...full, tooLong: true };

  // The largest scale that still fits lies between MIN_SCALE (fits) and 1 (doesn't).
  let best = smallest;
  let low = MIN_SCALE;
  let high = 1;
  for (let step = 0; step < SEARCH_STEPS; step++) {
    stop();
    const mid = (low + high) / 2;
    const attempt = await renderAt(props, mid);
    if (attempt.pages === 1) {
      best = attempt;
      low = mid;
    } else {
      high = mid;
    }
  }
  remember(key, best.scale);
  return { ...best, tooLong: false };
}
