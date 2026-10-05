import { paletteFromPixels } from "./palette";
import type { Logo } from "./types";

/** Longest side kept for logos. Plenty for print at the sizes an invoice uses, and keeps PDFs small. */
const MAX_SIDE = 900;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image. Try a PNG, JPG or SVG."));
    img.src = src;
  });
}

/**
 * Bounding box of the logo's visible ink: pixels that are neither transparent
 * nor near-white. This trims both transparent padding and the white margins of
 * logos exported on a white background.
 */
function inkBounds(data: Uint8ClampedArray, w: number, h: number) {
  let top = h;
  let left = w;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const visible = data[i + 3] > 8;
      const nearWhite = data[i] > 246 && data[i + 1] > 246 && data[i + 2] > 246;
      if (visible && !nearWhite) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  // Keep a hair of margin so anti-aliased edges are not clipped.
  const pad = 2;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(w - 1, right + pad);
  bottom = Math.min(h - 1, bottom + pad);
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

/** True when the image has an opaque, near-white border, i.e. it was exported on a white background. */
function hasWhiteBackground(data: Uint8ClampedArray, w: number, h: number): boolean {
  let border = 0;
  let white = 0;
  const check = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    border++;
    if (data[i + 3] > 250 && Math.min(data[i], data[i + 1], data[i + 2]) > 235) white++;
  };
  for (let x = 0; x < w; x += 3) {
    check(x, 0);
    check(x, h - 1);
  }
  for (let y = 0; y < h; y += 3) {
    check(0, y);
    check(w - 1, y);
  }
  return border > 0 && white / border > 0.9;
}

/**
 * Pushes off-white background pixels to pure white so the logo's box does not
 * show against the paper. Ramps between 226 and 246 to keep edges smooth.
 */
function whitenBackground(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const low = Math.min(data[i], data[i + 1], data[i + 2]);
    if (low < 226) continue;
    const t = Math.min(1, (low - 226) / 20);
    data[i] += (255 - data[i]) * t;
    data[i + 1] += (255 - data[i + 1]) * t;
    data[i + 2] += (255 - data[i + 2]) * t;
  }
}

/**
 * Normalises any browser-readable image (PNG, JPG, SVG, WebP, GIF) into a PNG
 * or JPEG data URL that react-pdf can embed: scaled to at most 900px, white
 * backgrounds cleaned up, margins trimmed, and its main colours extracted for
 * the colour pickers.
 */
export async function readLogo(file: File): Promise<Logo> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
    const naturalW = img.naturalWidth || 600;
    const naturalH = img.naturalHeight || 200;
    // Vector logos are rasterised at full size; bitmaps are only ever scaled down.
    const scale = isSvg ? MAX_SIDE / Math.max(naturalW, naturalH) : Math.min(1, MAX_SIDE / Math.max(naturalW, naturalH));
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not prepare the logo.");
    ctx.drawImage(img, 0, 0, w, h);

    const image = ctx.getImageData(0, 0, w, h);
    if (hasWhiteBackground(image.data, w, h)) {
      whitenBackground(image.data);
      ctx.putImageData(image, 0, 0);
    }
    const box = inkBounds(image.data, w, h);
    let out = canvas;
    if (box && (box.w < w || box.h < h)) {
      out = document.createElement("canvas");
      out.width = box.w;
      out.height = box.h;
      out.getContext("2d")?.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    }

    const outCtx = out.getContext("2d", { willReadFrequently: true });
    const palette = outCtx ? paletteFromPixels(outCtx.getImageData(0, 0, out.width, out.height).data) : [];
    const opaque = file.type === "image/jpeg";
    const dataUrl = opaque ? out.toDataURL("image/jpeg", 0.92) : out.toDataURL("image/png");
    return { dataUrl, width: out.width, height: out.height, palette };
  } finally {
    URL.revokeObjectURL(url);
  }
}
