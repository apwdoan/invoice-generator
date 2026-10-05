import { chroma, contrastWithWhite, deltaE, hexToLab, labToRgb, readableOnWhite, rgbToHex, rgbToLab, type Lab } from "./color";
import type { BrandColors } from "./types";

const SAMPLE_LIMIT = 12_000;
const CLUSTERS = 10;
/** Clusters closer than this (in Lab units) look like the same colour and are merged. */
const MERGE_DISTANCE = 11;
/** Colours covering less of the logo than this are left out. */
const MIN_SHARE = 0.025;

interface Cluster {
  lab: Lab;
  count: number;
}

/**
 * Finds the main colours in a logo from raw RGBA pixels. Transparent and
 * near-white pixels are ignored, since they are background rather than brand.
 * Returns hex colours ordered from darkest to lightest.
 */
export function paletteFromPixels(data: Uint8ClampedArray | Uint8Array, maxColors = 6): string[] {
  const pixelCount = data.length / 4;
  const stride = Math.max(1, Math.floor(pixelCount / SAMPLE_LIMIT));
  const samples: Lab[] = [];
  for (let p = 0; p < pixelCount; p += stride) {
    const i = p * 4;
    if (data[i + 3] < 200) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 238 && g > 238 && b > 238) continue;
    samples.push(rgbToLab([r, g, b]));
  }
  if (samples.length === 0) return [];

  // Farthest-point seeding: start from the median-lightness sample, then keep adding the
  // sample farthest from every centre so far. Small but distinct colours (a bright
  // highlight) get a centre of their own instead of being averaged away. Deterministic.
  const byLightness = [...samples].sort((x, y) => x[0] - y[0]);
  const k = Math.min(CLUSTERS, samples.length);
  let centres: Lab[] = [byLightness[Math.floor(byLightness.length / 2)]];
  const nearest = samples.map((s) => deltaE(s, centres[0]));
  while (centres.length < k) {
    let far = 0;
    for (let s = 1; s < samples.length; s++) if (nearest[s] > nearest[far]) far = s;
    if (nearest[far] === 0) break;
    centres.push(samples[far]);
    for (let s = 0; s < samples.length; s++) nearest[s] = Math.min(nearest[s], deltaE(samples[s], samples[far]));
  }
  const assignment = new Int32Array(samples.length);

  for (let iteration = 0; iteration < 24; iteration++) {
    let moved = false;
    for (let s = 0; s < samples.length; s++) {
      let best = 0;
      let bestDistance = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const d = deltaE(samples[s], centres[c]);
        if (d < bestDistance) {
          bestDistance = d;
          best = c;
        }
      }
      if (assignment[s] !== best) {
        assignment[s] = best;
        moved = true;
      }
    }
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let s = 0; s < samples.length; s++) {
      const sum = sums[assignment[s]];
      sum[0] += samples[s][0];
      sum[1] += samples[s][1];
      sum[2] += samples[s][2];
      sum[3]++;
    }
    centres = centres.map((c, i) => (sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : c));
    if (!moved && iteration > 0) break;
  }

  let clusters: Cluster[] = centres.map((lab) => ({ lab, count: 0 }));
  for (let s = 0; s < samples.length; s++) clusters[assignment[s]].count++;
  clusters = clusters.filter((c) => c.count > 0);

  // Merge near-duplicates, largest first, so shading steps of one colour collapse together.
  clusters.sort((a, b) => b.count - a.count);
  const merged: Cluster[] = [];
  for (const cluster of clusters) {
    const target = merged.find((m) => deltaE(m.lab, cluster.lab) < MERGE_DISTANCE);
    if (target) {
      const total = target.count + cluster.count;
      target.lab = target.lab.map((v, i) => (v * target.count + cluster.lab[i] * cluster.count) / total) as Lab;
      target.count = total;
    } else {
      merged.push({ ...cluster });
    }
  }

  // Pick colours that are both common and distinct: start with the most common, then
  // repeatedly add whichever remaining colour scores best on area × distance from those
  // already picked. Several shades of one navy then count once, and a small bright
  // highlight still makes the cut.
  const candidates = merged.filter((c) => c.count / samples.length >= MIN_SHARE).sort((a, b) => b.count - a.count);
  const picked: Cluster[] = candidates.length ? [candidates.shift()!] : [];
  while (picked.length < maxColors && candidates.length) {
    let bestIndex = 0;
    let bestScore = -1;
    candidates.forEach((c, i) => {
      const distance = Math.min(...picked.map((p) => deltaE(p.lab, c.lab)));
      const score = Math.sqrt(c.count / samples.length) * distance;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    });
    picked.push(candidates.splice(bestIndex, 1)[0]);
  }

  return picked.sort((a, b) => a.lab[0] - b.lab[0]).map((c) => rgbToHex(labToRgb(c.lab)));
}

/**
 * Assigns logo colours to invoice roles:
 * - primary: the darkest colour, for the title, totals and rules (needs strong contrast)
 * - accent: the most vivid colour that still reads as text, for the amount due
 * - highlight: the lightest vivid colour, which the top band fades into
 */
export function suggestColors(palette: string[], fallback: BrandColors): BrandColors {
  if (palette.length === 0) return fallback;
  const darkest = [...palette].sort((a, b) => contrastWithWhite(b) - contrastWithWhite(a))[0];
  const primary = readableOnWhite(darkest, 7);
  const primaryLab = hexToLab(primary);

  const others = palette.filter((c) => deltaE(hexToLab(c), primaryLab) > 14);
  const readable = others.filter((c) => contrastWithWhite(c) >= 4.5);
  const accentSource = (readable.length ? readable : others).sort((a, b) => chroma(b) - chroma(a))[0];
  const accent = accentSource ? readableOnWhite(accentSource, 4.5) : primary;

  const accentLab = hexToLab(accent);
  const highlight =
    palette
      .filter((c) => chroma(c) > 25 && hexToLab(c)[0] > accentLab[0] + 8)
      .sort((a, b) => hexToLab(b)[0] - hexToLab(a)[0])[0] ?? accent;

  return { primary, accent, highlight };
}

/** Reads the palette from an image in the browser. */
export async function paletteFromImage(src: string): Promise<string[]> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, 220 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 220) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 220) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  return paletteFromPixels(ctx.getImageData(0, 0, w, h).data);
}
