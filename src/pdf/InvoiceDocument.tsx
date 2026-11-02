import { Defs, Document, Image, LinearGradient, Page, Rect, Stop, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { createContext, useContext, type ComponentProps } from "react";
import { formatDate, termsLabel } from "../lib/dates";
import { billableItems, computeTotals, formatMoney, formatQuantity, formatRate, lineCents, parseAmount, roundCents } from "../lib/money";
import type { BusinessProfile, Invoice, LineItem, PageSize } from "../lib/types";
import { FONT_FAMILY } from "./fonts";
import { invoiceTheme } from "./theme";

const PAGE_WIDTH: Record<PageSize, number> = { LETTER: 612, A4: 595.28 };
const BAND_HEIGHT = 7;

const COL_QTY = 56;
const COL_RATE = 80;
const COL_AMOUNT = 88;

const BODY_SIZE = 9.5;
const LEADING = 1.42;

/** The body text size for T, which scales with the rest of the content. */
const BodySize = createContext(BODY_SIZE);

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
  const sized = { fontSize: useContext(BodySize), lineHeight: LEADING, ...flat };
  return <Text {...props} style={sized} />;
}

export interface InvoiceDocumentProps {
  profile: BusinessProfile;
  invoice: Invoice;
  pageSize: PageSize;
  /**
   * Shrinks the content by this factor so more fits on a page: text, column widths and the logo
   * by the factor, the space between things by its square. The page margins, top band and
   * footer stay as they are. 1, the default, is full size.
   */
  scale?: number;
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * What the quantity column is called. Flat-rate items leave it blank, so only the
 * other items count: all hourly reads "Hours", otherwise "Qty" with hours marked "hrs".
 */
function quantityHeading(items: LineItem[]): "Hours" | "Qty" | null {
  const counted = items.filter((item) => item.billing !== "flat");
  if (counted.length === 0) return null;
  return counted.every((item) => item.billing === "hourly") ? "Hours" : "Qty";
}

/** Fits the logo inside its height while never letting a wide wordmark exceed 240pt (both scaled). */
function logoBox(profile: BusinessProfile, scale: number): { width: number; height: number } | null {
  const logo = profile.logo;
  if (!logo || !logo.width || !logo.height) return null;
  let height = profile.logoHeight * scale;
  let width = (logo.width / logo.height) * height;
  if (width > 240 * scale) {
    width = 240 * scale;
    height = (logo.height / logo.width) * width;
  }
  return { width, height };
}

/** Full-width band across the top of every page; a left-to-right gradient when there are two stops. */
function Band({ stops, width }: { stops: string[]; width: number }) {
  if (stops.length === 1) {
    return <View fixed style={{ position: "absolute", top: 0, left: 0, right: 0, height: BAND_HEIGHT, backgroundColor: stops[0] }} />;
  }
  return (
    <View fixed style={{ position: "absolute", top: 0, left: 0, right: 0, height: BAND_HEIGHT }}>
      <Svg width={width} height={BAND_HEIGHT} viewBox={`0 0 ${width} ${BAND_HEIGHT}`}>
        <Defs>
          <LinearGradient id="band" x1="0" y1="0" x2="1" y2="0">
            {stops.map((color, i) => (
              <Stop key={color + i} offset={i / (stops.length - 1)} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={BAND_HEIGHT} fill="url(#band)" />
      </Svg>
    </View>
  );
}

export function InvoiceDocument({ profile, invoice, pageSize, scale = 1 }: InvoiceDocumentProps) {
  /** A text size or width in points at the current scale. */
  const z = (points: number) => points * scale;
  /** Space between things shrinks faster than the text, so a fit tightens gaps before shrinking type. */
  const gap = (points: number) => points * scale * scale;
  const theme = invoiceTheme(profile.colors);
  const family = FONT_FAMILY[profile.font] ?? FONT_FAMILY.sans;
  const items = billableItems(invoice);
  // One flat rate for everything lists the items without amounts, then the rate.
  const flatInvoice = invoice.pricing === "flat";
  // An invoice of only flat-rate items has no quantities or rates to show.
  const qtyHeading = flatInvoice ? null : quantityHeading(items);
  const terms = termsLabel(invoice.terms, invoice.netDays);
  const totals = computeTotals(invoice);
  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const logo = logoBox(profile, scale);
  const client = invoice.client;
  const taxNames = totals.taxes.map((t) => t.tax.label.trim()).filter(Boolean).join("/");
  const showName = profile.name.trim() !== "" && (profile.showName || !logo);
  const beside = logo !== null && profile.logo !== null && profile.logo.width / profile.logo.height < 2;

  const s = StyleSheet.create({
    // The margins stay fixed; the content between them scales.
    page: {
      fontFamily: family,
      color: theme.ink,
      paddingTop: 46,
      paddingBottom: 72,
      paddingHorizontal: 52,
    },

    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    from: { maxWidth: "60%" },
    // Square or stacked logos sit beside the contact details instead of above them, saving height.
    fromBeside: { maxWidth: "72%", flexDirection: "row", alignItems: "flex-start" },
    logo: { marginBottom: gap(12), objectFit: "contain" },
    logoBeside: { marginRight: gap(22), objectFit: "contain" },
    contactBeside: { paddingTop: gap(3) },
    businessName: { fontSize: z(14), fontWeight: 600, lineHeight: 1.25, marginBottom: gap(6), color: theme.primary },
    muted: { color: theme.muted },
    small: { fontSize: z(8.5) },
    registration: { marginTop: gap(6), fontSize: z(8.5) },
    titleBlock: { alignItems: "flex-end", paddingTop: gap(2) },
    title: { fontSize: z(28), fontWeight: 600, color: theme.primary, letterSpacing: z(-0.6), lineHeight: 1.1 },
    number: { fontSize: z(10.5), marginTop: gap(4) },
    summary: {
      flexDirection: "row",
      marginTop: gap(24),
      paddingVertical: gap(13),
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.hairline,
    },
    label: { fontSize: z(8), color: theme.muted, marginBottom: gap(3) },
    billTo: { flex: 1.7, paddingRight: gap(18) },
    clientName: { fontWeight: 600, fontSize: z(10.5), color: theme.primary },
    dates: { flex: 1, paddingRight: gap(12) },
    due: {
      flex: 1.2,
      alignItems: "flex-end",
      backgroundColor: theme.accentWash,
      paddingVertical: gap(10),
      paddingHorizontal: gap(12),
      marginVertical: gap(-4),
      borderRadius: 3,
    },
    dueAmount: { fontSize: z(17), fontWeight: 600, color: theme.accentText, lineHeight: 1.2 },
    table: { marginTop: gap(22) },
    thead: {
      flexDirection: "row",
      paddingBottom: gap(6),
      borderBottomWidth: 1.25,
      borderColor: theme.primary,
    },
    th: { fontSize: z(8), color: theme.muted },
    row: { flexDirection: "row", paddingVertical: gap(7), borderBottomWidth: 0.75, borderColor: theme.hairline },
    desc: { flex: 1, paddingRight: gap(12) },
    detail: { color: theme.muted, fontSize: z(8.5), marginTop: gap(1) },
    note: { color: theme.muted, fontSize: z(7.5), marginTop: gap(2), fontStyle: "italic" },
    qty: { width: z(COL_QTY), textAlign: "right" },
    rate: { width: z(COL_RATE), textAlign: "right" },
    amount: { width: z(COL_AMOUNT), textAlign: "right" },
    empty: { paddingVertical: gap(14), color: theme.muted, fontStyle: "italic" },
    totals: { marginTop: gap(12), marginLeft: "auto", width: z(236) },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: gap(3) },
    grandTotal: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: gap(6),
      paddingTop: gap(8),
      borderTopWidth: 1.25,
      borderColor: theme.primary,
    },
    grandLabel: { fontWeight: 600, fontSize: z(10.5), color: theme.primary },
    grandAmount: { fontWeight: 600, fontSize: z(13), color: theme.primary },
    notes: { marginTop: gap(26), maxWidth: "75%" },
    footer: {
      position: "absolute",
      left: 52,
      right: 52,
      bottom: 30,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 8,
      borderTopWidth: 0.75,
      borderColor: theme.hairline,
    },
    footerText: { fontSize: 8, color: theme.muted },
  });

  return (
    <Document
      title={`Invoice ${invoice.number}`}
      author={profile.name}
      subject={client.name ? `Invoice ${invoice.number} for ${client.name}` : `Invoice ${invoice.number}`}
      creator="Invoice Generator"
      producer="Invoice Generator"
    >
      <BodySize.Provider value={z(BODY_SIZE)}>
        <Page size={pageSize} style={s.page}>
          <Band stops={theme.band} width={PAGE_WIDTH[pageSize] ?? 612} />

          <View style={s.header}>
            <View style={beside ? s.fromBeside : s.from}>
              {logo && profile.logo && <Image src={profile.logo.dataUrl} style={[beside ? s.logoBeside : s.logo, logo]} />}
              <View style={beside ? s.contactBeside : {}}>
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
                <T style={[s.small, { marginTop: gap(1) }]}>
                  <T style={[s.small, s.muted]}>{profile.extraTaxNumberLabel.trim() || "Registration No."} </T>
                  {profile.extraTaxNumber.trim()}
                </T>
              )}
              </View>
            </View>

            <View style={s.titleBlock}>
              <T style={s.title}>Invoice</T>
              <T style={s.number}>{invoice.number}</T>
              {invoice.reference.trim() !== "" && (
                <T style={[s.small, s.muted, { marginTop: gap(2) }]}>Reference {invoice.reference.trim()}</T>
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
              {[client.email, client.phone]
                .map((v) => v.trim())
                .filter(Boolean)
                .map((v, i) => (
                  <T key={`cc${i}`} style={s.muted}>
                    {v}
                  </T>
                ))}
            </View>
            <View style={s.dates}>
              <T style={s.label}>Issued</T>
              <T>{formatDate(invoice.issueDate)}</T>
              <T style={[s.label, { marginTop: gap(8) }]}>Due</T>
              <T>{formatDate(invoice.dueDate)}</T>
              {terms !== "" && <T style={[s.small, s.muted]}>{terms}</T>}
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
              {qtyHeading && (
                <>
                  <T style={[s.th, s.qty]}>{qtyHeading}</T>
                  <T style={[s.th, s.rate]}>Rate</T>
                </>
              )}
              <T style={[s.th, s.amount]}>Amount</T>
            </View>
            {items.length === 0 && !flatInvoice && <T style={s.empty}>No line items yet.</T>}
            {flatInvoice &&
              items.map((item) => (
                <View key={item.id} style={s.row} wrap={false}>
                  <View style={s.desc}>
                    <T>{item.description}</T>
                    {item.detail.trim() !== "" && <T style={s.detail}>{lines(item.detail).join("\n")}</T>}
                  </View>
                  <View style={{ width: z(COL_AMOUNT) }} />
                </View>
              ))}
            {flatInvoice && (
              <View style={s.row} wrap={false}>
                <View style={s.desc}>
                  <T style={{ fontWeight: 600 }}>Flat rate</T>
                  {items.length > 0 && (
                    <T style={s.detail}>{items.length === 1 ? "Covers the item above" : "Covers all items above"}</T>
                  )}
                </View>
                <T style={[s.amount, { fontWeight: 600 }]}>{money(totals.subtotal)}</T>
              </View>
            )}
            {!flatInvoice &&
              items.map((item) => {
                const price = money(roundCents(parseAmount(item.unitPrice) * 100));
                return (
                  <View key={item.id} style={s.row} wrap={false}>
                    <View style={s.desc}>
                      <T>{item.description}</T>
                      {item.detail.trim() !== "" && <T style={s.detail}>{lines(item.detail).join("\n")}</T>}
                      {!item.taxable && taxNames !== "" && <T style={s.note}>No {taxNames} charged</T>}
                    </View>
                    {qtyHeading &&
                      (item.billing === "flat" ? (
                        <>
                          <View style={{ width: z(COL_QTY) }} />
                          <T style={[s.rate, s.muted]}>Flat rate</T>
                        </>
                      ) : (
                        <>
                          <T style={s.qty}>
                            {formatQuantity(item.quantity)}
                            {item.billing === "hourly" && qtyHeading === "Qty" ? " hrs" : ""}
                          </T>
                          <T style={s.rate}>
                            {price}
                            {item.billing === "hourly" && <T style={s.muted}>/hr</T>}
                          </T>
                        </>
                      ))}
                    <T style={s.amount}>{money(lineCents(item))}</T>
                  </View>
                );
              })}
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
              <T style={s.label} minPresenceAhead={gap(36)}>
                Notes
              </T>
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
      </BodySize.Provider>
    </Document>
  );
}
