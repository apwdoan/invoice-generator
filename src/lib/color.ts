export type Rgb = [number, number, number];
export type Lab = [number, number, number];

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function hexToRgb(hex: string, fallback = "#23395b"): Rgb {
  const h = (isHexColor(hex) ? hex : fallback).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

export function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Linear blend: amount 0 returns a, amount 1 returns b. */
export function mix(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((c, i) => c + (cb[i] - c) * amount) as Rgb);
}

function linear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

/** Darkens a colour just enough to reach the target contrast on white paper. Dark colours come back unchanged. */
export function readableOnWhite(hex: string, target = 4.5): string {
  let color = isHexColor(hex) ? hex : "#23395B";
  for (let i = 0; i < 40 && contrastWithWhite(color) < target; i++) {
    color = mix(color, "#000000", 0.06);
  }
  return color;
}

/** CIE L*a*b* (D65), where distances roughly match how different colours look. */
export function rgbToLab([r, g, b]: Rgb): Lab {
  const [lr, lg, lb] = [r, g, b].map(linear);
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labToRgb([l, a, b]: Lab): Rgb {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const x = inv(fx) * 0.95047;
  const y = inv(fy);
  const z = inv(fz) * 1.08883;
  const lr = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const lg = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const lb = x * 0.0557 + y * -0.204 + z * 1.057;
  const gamma = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  return [gamma(lr), gamma(lg), gamma(lb)];
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex));
}

/** Colourfulness (Lab chroma). Greys are near 0; vivid blues reach 100+. */
export function chroma(hex: string): number {
  const [, a, b] = hexToLab(hex);
  return Math.hypot(a, b);
}

export function deltaE(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

type OkLab = [number, number, number];

function toOkLab(hex: string): OkLab {
  const [r, g, b] = hexToRgb(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOkLab([L, a, b]: OkLab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const gamma = (c: number) => {
    const v = Math.max(0, Math.min(1, c));
    return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  };
  return rgbToHex([
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]);
}

/**
 * A quiet text colour in the same hue family as `hex`: low chroma, mid lightness,
 * readable on white. Navy gives a slate blue; green gives a grey-green.
 * Uses OKLCH because it keeps blues blue as they lighten (CIELAB drifts to purple).
 */
export function mutedFrom(hex: string): string {
  const [, a, b] = toOkLab(hex);
  const c = Math.hypot(a, b);
  const keep = c > 0 ? Math.min(c, 0.055) / c : 0;
  return readableOnWhite(fromOkLab([0.52, a * keep, b * keep]), 4.8);
}

/**
 * A very light wash of a colour for backgrounds, keeping its hue. Chroma is
 * scaled down with the colour's own, so near-greys give a neutral wash rather
 * than an exaggerated tint.
 */
export function tintOf(hex: string, lightness = 0.965): string {
  const [, a, b] = toOkLab(hex);
  const c = Math.hypot(a, b);
  const keep = c > 0 ? Math.min(c * 0.25, 0.022) / c : 0;
  return fromOkLab([lightness, a * keep, b * keep]);
}
