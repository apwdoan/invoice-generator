import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/** Pages never render wider than this many CSS pixels per PDF point. */
const MAX_ZOOM = 1.45;

interface Props {
  /** The exact PDF that Export would save. */
  bytes: Uint8Array | null;
  onPageCount: (count: number) => void;
  onError: (message: string) => void;
}

/**
 * Draws the real PDF with pdf.js rather than an HTML imitation of it, so the
 * preview cannot drift from what gets exported. New renders are drawn off-screen
 * and swapped in whole, which keeps typing from flickering the page.
 */
export function PdfPreview({ bytes, onPageCount, onError }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      // Round so tiny layout shifts do not trigger a re-render.
      setWidth(Math.floor(entry.contentRect.width / 8) * 8);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!bytes || width <= 0 || !pages.current) return;
    let cancelled = false;
    // pdf.js takes ownership of the buffer it is given, so hand it a copy.
    const task = getDocument({ data: bytes.slice() });

    (async () => {
      const doc = await task.promise;
      const sheets: HTMLElement[] = [];
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const cssScale = Math.min(width / base.width, MAX_ZOOM);
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: cssScale * dpr });

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.round(base.width * cssScale)}px`;
        canvas.style.height = `${Math.round(base.height * cssScale)}px`;
        await page.render({ canvas, viewport }).promise;

        const sheet = document.createElement("div");
        sheet.className = "sheet";
        sheet.setAttribute("role", "img");
        sheet.setAttribute("aria-label", `Invoice preview, page ${n} of ${doc.numPages}`);
        sheet.appendChild(canvas);
        sheets.push(sheet);
      }
      if (!cancelled && pages.current) {
        pages.current.replaceChildren(...sheets);
        onPageCount(doc.numPages);
      }
    })().catch((err: unknown) => {
      if (!cancelled) onError(err instanceof Error ? err.message : String(err));
    });

    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [bytes, width, onPageCount, onError]);

  return (
    <div className="preview-frame" ref={frame}>
      <div className="preview-pages" ref={pages} />
    </div>
  );
}
