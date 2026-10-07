import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import App from "./App";
import { applyCachedAppearance } from "./lib/appearance";
import { registerBundledFonts } from "./pdf/browserFonts";
import "./styles.css";

registerBundledFonts();
applyCachedAppearance();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
