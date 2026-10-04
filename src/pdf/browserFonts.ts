import sansRegular from "../assets/fonts/plex-sans-regular.ttf?url";
import sansItalic from "../assets/fonts/plex-sans-italic.ttf?url";
import sansSemibold from "../assets/fonts/plex-sans-semibold.ttf?url";
import serifRegular from "../assets/fonts/source-serif-regular.ttf?url";
import serifItalic from "../assets/fonts/source-serif-italic.ttf?url";
import serifSemibold from "../assets/fonts/source-serif-semibold.ttf?url";
import monoRegular from "../assets/fonts/plex-mono-regular.ttf?url";
import monoItalic from "../assets/fonts/plex-mono-italic.ttf?url";
import monoSemibold from "../assets/fonts/plex-mono-semibold.ttf?url";
import { registerInvoiceFonts } from "./fonts";

/** Bundled with the app, so PDFs render the same way offline. */
export function registerBundledFonts(): void {
  registerInvoiceFonts({
    sans: { regular: sansRegular, italic: sansItalic, semibold: sansSemibold },
    serif: { regular: serifRegular, italic: serifItalic, semibold: serifSemibold },
    mono: { regular: monoRegular, italic: monoItalic, semibold: monoSemibold },
  });
}
