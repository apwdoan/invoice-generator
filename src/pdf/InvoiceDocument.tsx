import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ComponentProps } from "react";
import { mix, readableOnWhite } from "../lib/color";
import { formatDate, termsLabel } from "../lib/dates";
import { billableItems, computeTotals, formatMoney, formatQuantity, formatRate, lineCents, parseAmount, roundCents } from "../lib/money";
import type { BusinessProfile, Invoice, PageSize } from "../lib/types";
import { FONT_FAMILY } from "./fonts";

const INK = "#1B2129";
const MUTED = "#69727D";
const HAIRLINE = "#E1E4E8";

const COL_QTY = 50;
const COL_RATE = 80;
const COL_AMOUNT = 88;

const BODY_SIZE = 9.5;
const LEADING = 1.42;

type TextStyle = Record<string, unknown>;

function flatten(style: unknown): TextStyle {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return style && typeof style === "object" ? (style as TextStyle) : {};
}

/**
 * Text with an explicit size and leading. react-pdf resolves a unitless
 * lineHeight against the font size in the same style, falling back to a large
 * default when the size is only inherited, so every run carries both.
 */
function T({ style, ...props }: ComponentProps<typeof Text>) {
  const flat = flatten(style);
  const sized = { fontSize: BODY_SIZE, lineHeight: LEADING, ...flat };
  return <Text {...props} style={sized} />;
}

export interface InvoiceDocumentProps {
  profile: BusinessProfile;
  invoice: Invoice;
  pageSize: PageSize;
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Fits the logo inside its height while never letting a wide wordmark exceed 240pt. */
function logoBox(profile: BusinessProfile): { width: number; height: number } | null {
  const logo = profile.logo;
  if (!logo || !logo.width || !logo.height) return null;
  let height = profile.logoHeight;
  let width = (logo.width / logo.height) * height;
  if (width > 240) {
    width = 240;
    height = (logo.height / logo.width) * width;
  }
  return { width, height };
}

export function InvoiceDocument({ profile, invoice, pageSize }: InvoiceDocumentProps) {
  const accent = readableOnWhite(profile.accent);
  const tint = mix(profile.accent, "#ffffff", 0.91);
  const family = FONT_FAMILY[profile.font] ?? FONT_FAMILY.sans;
  const items = billableItems(invoice.items);
  const totals = computeTotals(invoice);
  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const logo = logoBox(profile);
  const client = invoice.client;
  const taxNames = totals.taxes.map((t) => t.tax.label.trim()).filter(Boolean).join("/");
  const showName = profile.name.trim() !== "" && (profile.showName || !logo);

  const s = StyleSheet.create({
    page: {
      fontFamily: family,
      color: INK,
      paddingTop: 46,
      paddingBottom: 72,
      paddingHorizontal: 52,
    },

    accentBar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: profile.accent },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    from: { maxWidth: "60%" },
    logo: { marginBottom: 8, objectFit: "contain" },
    businessName: { fontSize: 14, fontWeight: 600, lineHeight: 1.25, marginBottom: 6 },
    muted: { color: MUTED },
    small: { fontSize: 8.5 },
    registration: { marginTop: 6, fontSize: 8.5 },
    titleBlock: { alignItems: "flex-end", paddingTop: 2 },
    title: { fontSize: 28, fontWeight: 600, color: accent, letterSpacing: -0.6, lineHeight: 1.1 },
    number: { fontSize: 10.5, marginTop: 4 },
    summary: {
      flexDirection: "row",
      marginTop: 24,
      paddingVertical: 13,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: HAIRLINE,
    },
    label: { fontSize: 8, color: MUTED, marginBottom: 3 },
    billTo: { flex: 1.7, paddingRight: 18 },
    clientName: { fontWeight: 600, fontSize: 10.5 },
    dates: { flex: 1, paddingRight: 12 },
    due: {
      flex: 1.2,
      alignItems: "flex-end",
      backgroundColor: tint,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginVertical: -4,
      borderRadius: 3,
    },
    dueAmount: { fontSize: 17, fontWeight: 600, color: accent, lineHeight: 1.2 },
    table: { marginTop: 22 },
    thead: {
      flexDirection: "row",
      paddingBottom: 6,
      borderBottomWidth: 1.25,
      borderColor: accent,
    },
    th: { fontSize: 8, color: MUTED },
    row: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 0.75, borderColor: HAIRLINE },
    desc: { flex: 1, paddingRight: 12 },
    detail: { color: MUTED, fontSize: 8.5, marginTop: 1 },
    note: { color: MUTED, fontSize: 7.5, marginTop: 2, fontStyle: "italic" },
    qty: { width: COL_QTY, textAlign: "right" },
    rate: { width: COL_RATE, textAlign: "right" },
    amount: { width: COL_AMOUNT, textAlign: "right" },
    empty: { paddingVertical: 14, color: MUTED, fontStyle: "italic" },
    totals: { marginTop: 12, marginLeft: "auto", width: 236 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    grandTotal: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: 6,
      paddingTop: 8,
      borderTopWidth: 1.25,
      borderColor: accent,
    },
    grandLabel: { fontWeight: 600, fontSize: 10.5 },
    grandAmount: { fontWeight: 600, fontSize: 13 },
    notes: { marginTop: 26, maxWidth: "75%" },
    footer: {
      position: "absolute",
      left: 52,
      right: 52,
      bottom: 30,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 8,
      borderTopWidth: 0.75,
      borderColor: HAIRLINE,
    },
    footerText: { fontSize: 8, color: MUTED },
  });

  return (
    <Document
      title={`Invoice ${invoice.number}`}
      author={profile.name}
      subject={client.name ? `Invoice ${invoice.number} for ${client.name}` : `Invoice ${invoice.number}`}
      creator="Invoice Generator"
      producer="Invoice Generator"
    >
      <Page size={pageSize} style={s.page}>
        <View fixed style={s.accentBar} />

        <View style={s.header}>
          <View style={s.from}>
            {logo && profile.logo && <Image src={profile.logo.dataUrl} style={[s.logo, logo]} />}
            {showName && <T style={s.businessName}>{profile.name}</T>}
            {lines(profile.address).map((line, i) => (
              <T key={`a${i}`} style={s.muted}>
                {line}
              </T>
            ))}
            {[profile.email, profile.phone, profile.website]
              .map((v) => v.trim())
              .filter(Boolean)
              .map((v, i) => (
                <T key={`c${i}`} style={s.muted}>
                  {v}
                </T>
              ))}
            {profile.taxNumber.trim() !== "" && (
              <T style={s.registration}>
                <T style={[s.small, s.muted]}>{profile.taxNumberLabel.trim() || "GST/HST No."} </T>
                {profile.taxNumber.trim()}
              </T>
            )}
            {profile.extraTaxNumber.trim() !== "" && (
              <T style={[s.small, { marginTop: 1 }]}>
                <T style={[s.small, s.muted]}>{profile.extraTaxNumberLabel.trim() || "Registration No."} </T>
                {profile.extraTaxNumber.trim()}
              </T>
            )}
          </View>

          <View style={s.titleBlock}>
            <T style={s.title}>Invoice</T>
            <T style={s.number}>{invoice.number}</T>
            {invoice.reference.trim() !== "" && (
              <T style={[s.small, s.muted, { marginTop: 2 }]}>Reference {invoice.reference.trim()}</T>
            )}
          </View>
        </View>

        <View style={s.summary} wrap={false}>
          <View style={s.billTo}>
            <T style={s.label}>Bill to</T>
            {client.name.trim() !== "" && <T style={s.clientName}>{client.name}</T>}
            {client.contact.trim() !== "" && <T>Attn: {client.contact.trim()}</T>}
            {lines(client.address).map((line, i) => (
              <T key={`ca${i}`} style={s.muted}>
                {line}
              </T>
            ))}
            {client.email.trim() !== "" && <T style={s.muted}>{client.email.trim()}</T>}
          </View>
          <View style={s.dates}>
            <T style={s.label}>Issued</T>
            <T>{formatDate(invoice.issueDate)}</T>
            <T style={[s.label, { marginTop: 8 }]}>Due</T>
            <T>{formatDate(invoice.dueDate)}</T>
            {invoice.terms !== "custom" && <T style={[s.small, s.muted]}>{termsLabel(invoice.terms)}</T>}
          </View>
          <View style={s.due}>
            <T style={s.label}>Amount due</T>
            <T style={s.dueAmount}>{money(totals.total)}</T>
            <T style={[s.small, s.muted]}>{invoice.currency}</T>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.thead}>
            <T style={[s.th, s.desc]}>Description</T>
            <T style={[s.th, s.qty]}>Qty</T>
            <T style={[s.th, s.rate]}>Rate</T>
            <T style={[s.th, s.amount]}>Amount</T>
          </View>
          {items.length === 0 && <T style={s.empty}>No line items yet.</T>}
          {items.map((item) => (
            <View key={item.id} style={s.row} wrap={false}>
              <View style={s.desc}>
                <T>{item.description}</T>
                {item.detail.trim() !== "" && <T style={s.detail}>{item.detail.trim()}</T>}
                {!item.taxable && taxNames !== "" && <T style={s.note}>No {taxNames} charged</T>}
              </View>
              <T style={s.qty}>{formatQuantity(item.quantity)}</T>
              <T style={s.rate}>{money(roundCents(parseAmount(item.unitPrice) * 100))}</T>
              <T style={s.amount}>{money(lineCents(item))}</T>
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <T style={s.muted}>Subtotal</T>
            <T>{money(totals.subtotal)}</T>
          </View>
          {totals.taxes.map(({ tax, rate, cents }) => (
            <View key={tax.id} style={s.totalRow}>
              <T style={s.muted}>
                {tax.label.trim() || "Tax"} ({formatRate(rate)})
              </T>
              <T>{money(cents)}</T>
            </View>
          ))}
          <View style={s.grandTotal}>
            <T style={s.grandLabel}>Total</T>
            <T style={s.grandAmount}>
              {money(totals.total)} <T style={[s.small, s.muted, { fontWeight: 400 }]}>{invoice.currency}</T>
            </T>
          </View>
        </View>

        {invoice.notes.trim() !== "" && (
          <View style={s.notes}>
            <T style={s.label}>Notes</T>
            <T>{invoice.notes.trim()}</T>
          </View>
        )}

        <View fixed style={s.footer}>
          {/* Plain Text on purpose: react-pdf drops fixed text that sets a lineHeight. */}
          <Text style={s.footerText}>{profile.footer.trim()}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              totalPages > 1 ? `${invoice.number}, page ${pageNumber} of ${totalPages}` : invoice.number
            }
          />
        </View>
      </Page>
    </Document>
  );
}
