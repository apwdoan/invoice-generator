# Invoice Generator

A desktop app for making branded invoices and exporting them as PDFs. Built with Tauri 2, React and TypeScript.

- **Branding:** upload your logo (PNG, JPG or SVG) and the invoice takes its colours from it. Business name, contact details and three typefaces. It starts neutral, so any brand fits.
- **GST/HST number:** printed under your contact details, with a format check for Canadian numbers (`123456789 RT0001`). An optional second registration number covers QST or PST.
- **Taxes:** presets for every province and territory, or any custom combination. Items can be marked as not taxable (reimbursed expenses, for example).
- **Live preview:** the preview is the real PDF drawn with pdf.js, so what you see is exactly what gets exported.
- **PDF export:** native save dialog, then Open or Show in folder. Letter or A4.
- **Tax estimate:** how much of each invoice to set aside for income tax and CPP/QPP, and how much GST/HST to remit, for every province and territory.
- **Light and dark:** the app follows your system's theme, or the button in the top bar sets Light or Dark. The invoice and its preview stay white, as they print.
- **Remembers things:** branding, numbering, saved clients, the current draft and the tax estimate's inputs are saved automatically.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer and [Rust](https://rustup.rs) 1.90 or newer (`rustup update` brings an older install up to date). On macOS, also install the Xcode command line tools (`xcode-select --install`). On Windows, the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) page covers the build tools; WebView2 is already on Windows 10 and 11.

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

## Releases

`.github/workflows/release.yml` builds everything on GitHub and publishes it under Releases:

| System | Installers | Standalone binary |
| --- | --- | --- |
| macOS | `.dmg`, one universal app for Apple silicon and Intel | None: the `.app` in the `.dmg` is the app |
| Windows | `-setup.exe` and `.msi` | `invoice-generator_<version>_windows_x64.exe`, runs without installing |
| Linux | `.AppImage`, `.deb` and `.rpm` | `invoice-generator_<version>_linux_x64`, needs WebKitGTK 4.1 |

To make a release:

1. Set the new version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, and commit.
2. Tag and push it: `git tag v0.2.0 && git push origin v0.2.0`. You can also start it from the Actions tab with **Run workflow**, which builds whatever version is on that branch and creates the tag when it publishes. Untick **Publish** there to stop at a draft, for a test run.

The workflow checks that the three version numbers match each other and the tag, typechecks, and runs the tests. It then uploads each build to a draft release and publishes it once all five builds have succeeded, with GitHub's generated notes. If a build fails, the draft stays unpublished; re-running the workflow replaces its files and publishes it when everything passes. A version that is already published is refused, so bump it first.

The standalone binaries are built separately with `--no-bundle`, so they aren't marked as coming from an installer.

The builds aren't code-signed unless you add certificates, so macOS asks people to allow the app once in Privacy & Security, and Windows SmartScreen shows a warning. To sign and notarize the Mac app, add these repository secrets (Settings > Secrets and variables > Actions) and the workflow picks them up: `APPLE_CERTIFICATE` (the .p12 exported from Keychain Access, base64-encoded), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, and for notarization `APPLE_ID`, `APPLE_PASSWORD` (an app-specific password) and `APPLE_TEAM_ID`. Tauri's [signing guides](https://v2.tauri.app/distribute/sign/macos/) cover getting them, and Windows signing.

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

## Tax estimate

The Tax estimate tab works out a sole proprietor's year from expected revenue and expenses, plus any employment income, RRSP/FHSA deductions, tax deducted at work and instalments already paid. It shows:

- **The share of each invoice to set aside** for income tax and CPP/QPP: the tax the business adds, divided by revenue. With a job as well, only the extra tax from the business counts. The current invoice gets a line saying exactly how much to move to savings when it's paid, including the sales tax on it.
- **The tax on the next $1,000** of revenue, so you can see where the brackets and CPP maximums fall.
- **A full breakdown:** CPP or QPP on both halves (with CPP2), the deductible and credit portions, federal tax, provincial tax with Ontario's surtax and Health Premium and the BC and Ontario tax reductions, and in Québec the abatement, QPIP, the deduction for workers and the Health Services Fund.
- **GST/HST to remit** under the regular method (less input tax credits) or the Quick Method (service-business remittance rate and the 1% credit, with the amount kept added to income), and a warning once revenue passes the $30,000 small supplier limit.
- **Instalments and due dates.**

It is an estimate. Other credits and deductions (tuition, medical, donations, dependants), refundable benefits, low-income reductions outside BC and Ontario, PST and QST, and Québec's prescription drug insurance premium are left out, and employment income is assumed to come from one employer.

The rates are in `src/lib/taxRates.ts`, one table per year, with sources listed at the top. The 2026 table comes from CRA's payroll formulas (T4127, July 2026 edition, which includes BC's, Newfoundland and Labrador's and PEI's mid-year changes), Finances Québec's 2026 parameters, and CRA guide RC4058 for Quick Method rates. To add a year, copy the table, update the figures and add it to `TAX_YEARS`; the year picker shows it automatically.

`npm test` checks the calculations against EY's published 2026 combined rate tables for each province and against worked examples (CPP shared between a job and a business, Québec, the Quick Method).

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
  components/             Invoice, Branding and Tax estimate forms, line items, PDF preview, tax summary
  lib/
    palette.ts            Finds a logo's main colours and assigns them to roles
    color.ts              Contrast, CIELAB and OKLCH helpers
    money.ts              Integer-cent arithmetic and currency formatting
    state.ts              Defaults, tax presets, numbering, loading older saves
    native.ts             The bridge to Rust (with browser fallbacks)
    registration.ts       GST/HST number checks
    logo.ts               Normalises uploaded logos for embedding
    taxRates.ts           Tax rates and thresholds by year, with sources
    taxEstimate.ts        Income tax, CPP/QPP and GST/HST calculations
    taxSettings.ts        Turns the Tax estimate form into calculator input
  pdf/
    InvoiceDocument.tsx   The invoice layout (@react-pdf/renderer)
    theme.ts              Turns the three brand colours into the invoice's full colour set
    fonts.ts              Typeface registration
  assets/fonts/           Bundled TTFs (IBM Plex Sans, Source Serif 4, IBM Plex Mono)
src-tauri/
  src/lib.rs              Commands: load_state, save_state, export_pdf, open/reveal
  tauri.conf.json         Window, CSP and bundle settings
scripts/sample-pdf.tsx    Renders a sample invoice without the app
scripts/tax.test.ts       Checks the tax estimate (npm test)
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
