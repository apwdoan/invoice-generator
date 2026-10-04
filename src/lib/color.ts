type Rgb = [number, number, number];

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function toRgb(hex: string): Rgb {
  const h = isHexColor(hex) ? hex.slice(1) : "23395b";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Linear blend: amount 0 returns a, amount 1 returns b. */
export function mix(a: string, b: string, amount: number): string {
  const ca = toRgb(a);
  const cb = toRgb(b);
  return toHex(ca.map((c, i) => c + (cb[i] - c) * amount) as Rgb);
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

/**
 * The brand colour as used for text on white paper. Pale brand colours are
 * darkened just enough to stay readable; dark ones are returned unchanged.
 */
export function readableOnWhite(hex: string, target = 4.5): string {
  let color = isHexColor(hex) ? hex : "#23395b";
  for (let i = 0; i < 20 && contrastWithWhite(color) < target; i++) {
    color = mix(color, "#000000", 0.08);
  }
  return color;
}
