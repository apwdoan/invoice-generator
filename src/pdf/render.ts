import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoiceDocument, type InvoiceDocumentProps } from "./InvoiceDocument";

/** Lays out the invoice and returns the finished PDF file as bytes. */
export async function renderInvoicePdf(props: InvoiceDocumentProps): Promise<Uint8Array> {
  // pdf() expects a <Document> element; InvoiceDocument returns one.
  const instance = pdf(createElement(InvoiceDocument, props) as Parameters<typeof pdf>[0]);
  const blob = await instance.toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}
