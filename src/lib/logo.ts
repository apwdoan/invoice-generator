import type { Logo } from "./types";

const MAX_SIDE = 1200;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image. Try a PNG, JPG or SVG."));
    img.src = src;
  });
}

/** Bounding box of pixels that are not fully transparent, so the logo sizes by its visible ink. */
function opaqueBounds(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const { data } = ctx.getImageData(0, 0, w, h);
  let top = h;
  let left = w;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

/**
 * Normalises any browser-readable image (PNG, JPG, SVG, WebP, GIF) into a PNG
 * or JPEG data URL that react-pdf can embed, scaled to at most 1200px and with
 * transparent margins trimmed.
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

    const opaque = file.type === "image/jpeg";
    const box = opaque ? null : opaqueBounds(ctx, w, h);
    let out = canvas;
    if (box && (box.w < w || box.h < h)) {
      out = document.createElement("canvas");
      out.width = box.w;
      out.height = box.h;
      out.getContext("2d")?.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    }
    const dataUrl = opaque ? out.toDataURL("image/jpeg", 0.92) : out.toDataURL("image/png");
    return { dataUrl, width: out.width, height: out.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
