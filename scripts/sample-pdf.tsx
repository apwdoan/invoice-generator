/**
 * Renders a sample invoice to sample-invoice.pdf without the app, for checking
 * layout changes quickly:
 *   npm run sample-pdf -- --logo=logo.png --font=serif --size=A4 --items=30
 */
import { renderToFile } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FONT_FILES, registerInvoiceFonts } from "../src/pdf/fonts";
import { InvoiceDocument } from "../src/pdf/InvoiceDocument";
import { defaultProfile, newId } from "../src/lib/state";
import type { BusinessProfile, Invoice, InvoiceFont, PageSize } from "../src/lib/types";

const fontDir = fileURLToPath(new URL("../src/assets/fonts/", import.meta.url));
const resolveAll = (files: typeof FONT_FILES.sans) => ({
  regular: fontDir + files.regular,
  italic: fontDir + files.italic,
  semibold: fontDir + files.semibold,
});
registerInvoiceFonts({
  sans: resolveAll(FONT_FILES.sans),
  serif: resolveAll(FONT_FILES.serif),
  mono: resolveAll(FONT_FILES.mono),
});

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a) => /^--(\w+)=(.*)$/.exec(a))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => [m[1], m[2]]),
);
const logoPath = args.logo;
const font = args.font ?? "sans";
const size = (args.size ?? "LETTER").toUpperCase();
const extraItems = Number(args.items ?? 0);

function pngSize(buf: Buffer) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const logo = logoPath
  ? (() => {
      const buf = readFileSync(logoPath);
      return { dataUrl: `data:image/png;base64,${buf.toString("base64")}`, ...pngSize(buf) };
    })()
  : null;

const profile: BusinessProfile = {
  ...defaultProfile,
  logo,
  showName: true,
  font: font as InvoiceFont,
  address: "10230 Jasper Ave NW, Suite 400\nEdmonton, AB  T5J 4P6",
  email: "billing@example.com",
  phone: "(780) 555-0142",
  website: "example.com",
  taxNumber: "123456789 RT0001",
  footer: "Thank you for your business.",
};

const invoice: Invoice = {
  number: "INV-0042",
  reference: "PO-7781",
  issueDate: "2026-10-03",
  terms: "net30",
  dueDate: "2026-11-02",
  currency: "CAD",
  client: {
    name: "Northern Lights Food Bank Society",
    contact: "Priya Raman",
    email: "accounts@example.org",
    address: "8820 51 Ave NW\nEdmonton, AB  T6E 5E8",
  },
  items: [
    { id: newId(), description: "Discovery workshop and requirements", detail: "Two half-day sessions with program staff", quantity: "8", unitPrice: "145", taxable: true },
    { id: newId(), description: "Volunteer scheduling web app, phase 1", detail: "Shift sign-up, reminders, admin dashboard", quantity: "42.5", unitPrice: "145", taxable: true },
    { id: newId(), description: "Hosting and domain, 12 months", detail: "", quantity: "1", unitPrice: "384.00", taxable: true },
    { id: newId(), description: "Reimbursed stock photography licence", detail: "Billed at cost", quantity: "1", unitPrice: "59.99", taxable: false },
  ],
  taxes: [{ id: newId(), label: "GST", rate: "5" }],
  notes: "Please pay by Interac e-Transfer to billing@example.com, or by cheque payable to Abstraction Software Development.\nInvoices unpaid after 30 days accrue interest at 1.5% per month.",
};

for (let i = 1; i <= extraItems; i++) {
  invoice.items.push({ id: newId(), description: `Support retainer, week ${i}`, detail: "", quantity: "3", unitPrice: "145", taxable: true });
}

await renderToFile(
  <InvoiceDocument profile={profile} invoice={invoice} pageSize={size as PageSize} />,
  "sample-invoice.pdf",
);
console.log("Wrote sample-invoice.pdf");
