export type RegistrationCheck = "empty" | "valid" | "missing-program" | "invalid";

/** Canadian GST/HST numbers: a 9-digit business number, the RT program code and a 4-digit reference. */
const GST_HST = /^(\d{9})\s*RT\s*(\d{4})$/i;

export function checkGstNumber(value: string): RegistrationCheck {
  const v = value.trim();
  if (!v) return "empty";
  if (GST_HST.test(v)) return "valid";
  if (/^\d{9}$/.test(v.replace(/\s/g, ""))) return "missing-program";
  return "invalid";
}

/** Tidies "123456789rt0001" into "123456789 RT0001". Anything else is left as typed. */
export function formatGstNumber(value: string): string {
  const m = GST_HST.exec(value.trim());
  return m ? `${m[1]} RT${m[2]}` : value.trim();
}

/** Only check the format when the label says this is a Canadian GST/HST number. */
export function looksLikeGstLabel(label: string): boolean {
  return /\b(GST|HST)\b/i.test(label);
}
