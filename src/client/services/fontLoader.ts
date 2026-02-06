/**
 * Dynamic font loader for Google Fonts.
 * Loads fonts on-demand and caches them to avoid duplicate requests.
 */

import { getGoogleFontsUrl, getCssFontFamily } from "../../shared/fonts";

/** Set of font names that have been loaded */
const loadedFonts = new Set<string>();

/** Map of font name to link element for cleanup */
const fontLinkElements = new Map<string, HTMLLinkElement>();

/**
 * Loads a font from Google Fonts CDN.
 * If the font is already loaded, this is a no-op.
 * If the font is not in the curated list, falls back to system monospace.
 *
 * @param fontName - The font name to load (e.g., "JetBrains Mono")
 * @returns Promise that resolves when the font is loaded
 */
export async function loadFont(fontName: string): Promise<void> {
  // Already loaded
  if (loadedFonts.has(fontName)) {
    return;
  }

  const url = getGoogleFontsUrl(fontName);
  if (!url) {
    // Not a curated font, skip loading
    console.warn(`Font "${fontName}" is not in the curated list, using system monospace`);
    return;
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;

    link.onload = () => {
      loadedFonts.add(fontName);
      fontLinkElements.set(fontName, link);
      resolve();
    };

    link.onerror = () => {
      console.error(`Failed to load font: ${fontName}`);
      reject(new Error(`Failed to load font: ${fontName}`));
    };

    document.head.appendChild(link);
  });
}

/**
 * Gets the CSS font-family value for a font name.
 * Re-exported for convenience.
 */
export { getCssFontFamily };

/**
 * Preloads a font without blocking.
 * Errors are logged but don't reject.
 */
export function preloadFont(fontName: string): void {
  loadFont(fontName).catch(() => {
    // Errors are logged in loadFont, no need to re-log
  });
}
