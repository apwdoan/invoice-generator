import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppearanceButton } from "./components/AppearanceButton";
import { BrandingForm } from "./components/BrandingForm";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { InvoiceForm } from "./components/InvoiceForm";
import { PdfPreview } from "./components/PdfPreview";
import { TaxForm } from "./components/TaxForm";
import { TaxSummary } from "./components/TaxSummary";
import { applyAppearance } from "./lib/appearance";
import { computeTotals, formatMoney } from "./lib/money";
import { exportPdf, fileNameOf, inDesktopApp, loadState, openExported, revealExported, safeFileName, saveState } from "./lib/native";
import { hydrate, initialState, newInvoice, rememberClient } from "./lib/state";
import { TAX_YEARS } from "./lib/taxRates";
import { estimateFor } from "./lib/taxSettings";
import type { AppState, BusinessProfile, Invoice, PageSize, Settings, TaxSettings } from "./lib/types";
import { renderInvoicePdf } from "./pdf/render";

type Tab = "invoice" | "branding" | "tax";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type Notice = { kind: "exported"; path: string } | { kind: "error"; message: string };

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>("invoice");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const loaded = useRef(false);
  const editorScroll = useRef<HTMLDivElement>(null);

  // Load saved data once.
  useEffect(() => {
    loadState()
      .then((json) => setState(json ? hydrate(JSON.parse(json)) : initialState()))
      .catch((err) => {
        setState(initialState());
        setNotice({ kind: "error", message: `Saved data could not be loaded: ${errorText(err)}` });
      });
  }, []);

  // Autosave shortly after each change.
  useEffect(() => {
    if (!state) return;
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    setSaveStatus("saving");
    const timer = setTimeout(() => {
      saveState(JSON.stringify(state))
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
    }, 300);
    return () => clearTimeout(timer);
  }, [state]);

  // Apply the light, dark or system theme whenever the setting changes.
  const appearance = state?.settings.appearance;
  useEffect(() => {
    if (appearance) applyAppearance(appearance);
  }, [appearance]);

  // Re-render the PDF preview after edits settle.
  const profile = state?.profile;
  const invoice = state?.invoice;
  const pageSize = state?.settings.pageSize;
  useEffect(() => {
    if (!profile || !invoice || !pageSize) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      renderInvoicePdf({ profile, invoice, pageSize })
        .then((bytes) => {
          if (cancelled) return;
          setPreviewBytes(bytes);
          setPreviewError(null);
        })
        .catch((err) => !cancelled && setPreviewError(errorText(err)));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [profile, invoice, pageSize]);

  const updateInvoice = useCallback((next: Invoice) => setState((s) => (s ? { ...s, invoice: next } : s)), []);
  const updateProfile = useCallback(
    (patch: Partial<BusinessProfile>) => setState((s) => (s ? { ...s, profile: { ...s.profile, ...patch } } : s)),
    [],
  );
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setState((s) => (s ? { ...s, settings: { ...s.settings, ...patch } } : s)),
    [],
  );
  const updateTax = useCallback(
    (patch: Partial<TaxSettings>) => setState((s) => (s ? { ...s, tax: { ...s.tax, ...patch } } : s)),
    [],
  );
  const onPreviewError = useCallback((message: string) => setPreviewError(message), []);

  const totals = useMemo(() => (invoice ? computeTotals(invoice) : null), [invoice]);
  const taxSettings = state?.tax;
  const estimate = useMemo(() => (taxSettings ? estimateFor(taxSettings) : null), [taxSettings]);

  const handleExport = useCallback(async () => {
    if (!state || exporting) return;
    setExporting(true);
    setNotice(null);
    try {
      const bytes = await renderInvoicePdf({
        profile: state.profile,
        invoice: state.invoice,
        pageSize: state.settings.pageSize,
      });
      const name = safeFileName(`${state.invoice.number} ${state.invoice.client.name}`);
      const path = await exportPdf(bytes, name);
      if (path) {
        setNotice({ kind: "exported", path });
        setState((s) => (s ? { ...s, clients: rememberClient(s.clients, s.invoice.client) } : s));
      }
    } catch (err) {
      setNotice({ kind: "error", message: `The PDF was not saved: ${errorText(err)}` });
    } finally {
      setExporting(false);
    }
  }, [state, exporting]);

  // Cmd/Ctrl+E exports.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        void handleExport();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleExport]);

  const runFileAction = (action: (path: string) => Promise<void>, path: string) => {
    action(path).catch((err) => setNotice({ kind: "error", message: `Could not open ${fileNameOf(path)}: ${errorText(err)}` }));
  };

  const startNewInvoice = () => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        invoice: newInvoice(s.profile, s.settings, s.invoice),
        settings: { ...s.settings, nextNumber: s.settings.nextNumber + 1 },
      };
    });
    setConfirmNew(false);
    setNotice(null);
    setTab("invoice");
    editorScroll.current?.scrollTo({ top: 0 });
  };

  if (!state || !totals || !estimate) {
    return <div className="loading">Opening your invoices</div>;
  }

  const shortcut = navigator.platform.toLowerCase().includes("mac") ? "⌘E" : "Ctrl+E";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.png" alt="" width={22} height={22} />
          <span>Invoice Generator</span>
        </div>
        <div className="current">
          <span className="current-number">{state.invoice.number || "Untitled"}</span>
          <span className="current-total">
            {formatMoney(totals.total, state.invoice.currency)} {state.invoice.currency}
          </span>
        </div>
        <div className="topbar-actions">
          <span className={`save-status save-${saveStatus}`} aria-live="polite">
            {saveStatus === "saving" && "Saving"}
            {saveStatus === "saved" && "All changes saved"}
            {saveStatus === "error" && "Changes not saved"}
          </span>
          <AppearanceButton value={state.settings.appearance} onChange={(next) => updateSettings({ appearance: next })} />
          <button type="button" className="button" onClick={() => setConfirmNew(true)}>
            New invoice
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => void handleExport()}
            disabled={exporting}
            title={`Export PDF (${shortcut})`}
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="editor">
          <div className="tabs" role="tablist" aria-label="Editor">
            <button type="button" role="tab" aria-selected={tab === "invoice"} onClick={() => setTab("invoice")}>
              Invoice
            </button>
            <button type="button" role="tab" aria-selected={tab === "branding"} onClick={() => setTab("branding")}>
              Branding
            </button>
            <button type="button" role="tab" aria-selected={tab === "tax"} onClick={() => setTab("tax")}>
              Tax estimate
            </button>
          </div>
          <div className="editor-scroll" ref={editorScroll}>
            {tab === "tax" ? (
              <TaxForm settings={state.tax} estimate={estimate} onChange={updateTax} />
            ) : tab === "invoice" ? (
              <InvoiceForm
                invoice={state.invoice}
                clients={state.clients}
                hasTaxNumber={state.profile.taxNumber.trim() !== ""}
                onChange={updateInvoice}
                onForgetClient={(name) =>
                  setState((s) => (s ? { ...s, clients: s.clients.filter((c) => c.name !== name) } : s))
                }
                onOpenBranding={() => {
                  setTab("branding");
                  // Wait for the Branding form to mount, then take the user straight to the field.
                  requestAnimationFrame(() => {
                    const field = document.getElementById("gst-number");
                    field?.scrollIntoView({ block: "center" });
                    field?.focus({ preventScroll: true });
                  });
                }}
              />
            ) : (
              <BrandingForm
                profile={state.profile}
                settings={state.settings}
                onProfile={updateProfile}
                onSettings={updateSettings}
              />
            )}
          </div>
        </aside>

        <section className="desk" aria-label={tab === "tax" ? "Tax estimate" : "Preview"}>
          {tab === "tax" && (
            <div className="desk-view">
              <div className="desk-toolbar">
                <span className="page-count">
                  {estimate.year} estimate for {TAX_YEARS[estimate.year].provinces[estimate.province].name}
                </span>
              </div>
              <TaxSummary estimate={estimate} invoice={state.invoice} totals={totals} />
            </div>
          )}
          {/* Kept mounted while hidden, so the preview is already drawn when you come back. */}
          <div className="desk-view" hidden={tab === "tax"}>
            <div className="desk-toolbar">
              <span className="page-count">
                {pageCount} {pageCount === 1 ? "page" : "pages"}
              </span>
              <div className="segmented" role="radiogroup" aria-label="Paper size">
                {(["LETTER", "A4"] as PageSize[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    role="radio"
                    aria-checked={state.settings.pageSize === size}
                    onClick={() => updateSettings({ pageSize: size })}
                  >
                    {size === "LETTER" ? "Letter" : "A4"}
                  </button>
                ))}
              </div>
            </div>
            {previewError && <p className="preview-error">The preview could not be drawn: {previewError}</p>}
            <PdfPreview bytes={previewBytes} onPageCount={setPageCount} onError={onPreviewError} />
          </div>

          {notice && (
            <div className={`notice notice-${notice.kind}`} role="status">
              {notice.kind === "exported" ? (
                <>
                  <span>
                    Exported <strong>{fileNameOf(notice.path)}</strong>
                  </span>
                  {inDesktopApp && (
                    <>
                      <button type="button" className="text-button" onClick={() => runFileAction(openExported, notice.path)}>
                        Open
                      </button>
                      <button type="button" className="text-button" onClick={() => runFileAction(revealExported, notice.path)}>
                        Show in folder
                      </button>
                    </>
                  )}
                </>
              ) : (
                <span>{notice.message}</span>
              )}
              <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => setNotice(null)}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M3.5 3.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
        </section>
      </main>

      <ConfirmDialog
        open={confirmNew}
        title="Start a new invoice?"
        confirmLabel="Start new invoice"
        onConfirm={startNewInvoice}
        onCancel={() => setConfirmNew(false)}
      >
        <p>
          {state.invoice.number} will be cleared from the editor, so export it first if you still need it. Your branding and
          saved clients stay as they are.
        </p>
      </ConfirmDialog>
    </div>
  );
}
