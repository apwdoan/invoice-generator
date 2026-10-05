# Invoice Generator

A desktop app for making branded invoices and exporting them as PDFs. Built with Tauri 2, React and TypeScript.

- **Branding:** upload your logo (PNG, JPG or SVG) and the invoice takes its colours from it. Business name, contact details and three typefaces. It starts neutral, so any brand fits.
- **GST/HST number:** printed under your contact details, with a format check for Canadian numbers (`123456789 RT0001`). An optional second registration number covers QST or PST.
- **Taxes:** presets for every province and territory, or any custom combination. Items can be marked as not taxable (reimbursed expenses, for example).
- **Live preview:** the preview is the real PDF drawn with pdf.js, so what you see is exactly what gets exported.
- **PDF export:** native save dialog, then Open or Show in folder. Letter or A4.
- **Remembers things:** branding, numbering, saved clients and the current draft are saved automatically.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer and [Rust](https://rustup.rs). On macOS, also install the Xcode command line tools (`xcode-select --install`). On Windows, the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) page covers the build tools; WebView2 is already on Windows 10 and 11.

```sh
npm install
npm run tauri dev
```

The first run compiles the Rust side, which takes a few minutes. After that, changes to the interface reload instantly.

To build an installer (`.dmg`/`.app` on macOS, `.msi`/`.exe` on Windows):

```sh
npm run tauri build
```

The result is in `src-tauri/target/release/bundle/`.

`npm run dev` also works in an ordinary browser for interface work. In that mode it saves to localStorage and downloads the PDF instead of showing a save dialog.

## Logo and colours

The app starts unbranded: no logo, no business name, and neutral charcoal colours. Add your logo in Branding and the invoice takes its colours from it:

1. The logo is trimmed (transparent or white margins), an off-white background is cleaned up, and it is sized for its shape: stacked or square logos print taller than wide wordmarks.
2. Its main colours are found by clustering the pixels (`src/lib/palette.ts`) and shown as a strip in Branding → Colours.
3. They are assigned to three roles and applied straight away:
   - **Main**, the darkest colour: title, totals, rules, and body text when dark enough
   - **Accent**, the most vivid colour that still reads as text: the amount due and the start of the top band
   - **Highlight**, the lightest vivid colour: where the top band fades to

You can change any of them afterwards; "Use logo colours" puts the extracted ones back. Removing the logo returns to the neutral colours, unless you had changed them by hand.

Every other colour on the invoice is derived from those three by `src/pdf/theme.ts`, which also keeps text readable if a colour is pale: a light main or accent colour is darkened for text, and only the decorative band uses colours at full strength.

Square or stacked logos sit beside your contact details; wide ones sit above them.

## Where your data lives

Everything is in one JSON file in the app's data folder:

| System | Location |
| --- | --- |
| macOS | `~/Library/Application Support/com.abstraction.invoicegenerator/state.json` |
| Windows | `%APPDATA%\com.abstraction.invoicegenerator\state.json` |
| Linux | `~/.local/share/com.abstraction.invoicegenerator/state.json` |

Saves are atomic (write to a temp file, then rename). If the file is ever unreadable, it is moved aside as `state.unreadable-<time>.json` rather than overwritten.

## How it fits together

```
src/
  App.tsx                 Layout, autosave, preview and export flow
  components/             Invoice and Branding forms, line items, taxes, PDF preview
  lib/
    palette.ts            Finds a logo's main colours and assigns them to roles
    color.ts              Contrast, CIELAB and OKLCH helpers
    money.ts              Integer-cent arithmetic and currency formatting
    state.ts              Defaults, tax presets, numbering, loading older saves
    native.ts             The bridge to Rust (with browser fallbacks)
    registration.ts       GST/HST number checks
    logo.ts               Normalises uploaded logos for embedding
  pdf/
    InvoiceDocument.tsx   The invoice layout (@react-pdf/renderer)
    theme.ts              Turns the three brand colours into the invoice's full colour set
    fonts.ts              Typeface registration
  assets/fonts/           Bundled TTFs (IBM Plex Sans, Source Serif 4, IBM Plex Mono)
src-tauri/
  src/lib.rs              Commands: load_state, save_state, export_pdf, open/reveal
  tauri.conf.json         Window, CSP and bundle settings
scripts/sample-pdf.tsx    Renders a sample invoice without the app
```

The PDF is generated in the webview with `@react-pdf/renderer`, then sent to Rust as raw bytes. Rust shows the save dialog and writes the file, so the webview has no general file system access. Open and Show in folder only work on files exported during the current session.

Money is calculated in integer cents. Tax is calculated on the subtotal of taxable items and rounded half away from zero.

## Checking layout changes quickly

```sh
npm run sample-pdf -- --font=serif --size=A4 --items=20
npm run sample-pdf -- --logo=path/to/logo.png --colors=#01183F,#015CE7,#08E9FC
```

This writes `sample-invoice.pdf` using the same layout code as the app.

## Notes

- Tax presets use the CRA's published rates (Nova Scotia's HST is 14% since April 1, 2025). Which taxes apply depends on the place of supply, so check unusual cases with your accountant.
- The invoice fonts cover the Latin-1 character set, which includes French accents. Characters outside it (for example Polish or Vietnamese letters) will not render in the PDF.
- Fonts are licensed under the SIL Open Font License; see `src/assets/fonts/`.
- The app icon is a placeholder. Replace `app-icon.png` and run `npx tauri icon app-icon.png -o src-tauri/icons` to regenerate the icon set.
