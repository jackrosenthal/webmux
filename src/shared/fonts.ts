/**
 * Curated list of monospace fonts suitable for terminal use.
 * These fonts are available from Google Fonts.
 */

export interface FontOption {
  /** Display name shown in the UI */
  name: string;
  /** Google Fonts URL parameter (font family with optional weight) */
  googleFontsId: string;
  /** CSS font-family value */
  cssFamily: string;
}

/**
 * Curated monospace fonts from Google Fonts.
 * These are suitable for terminal use and support a wide range of characters.
 */
export const MONOSPACE_FONTS: FontOption[] = [
  {
    name: "JetBrains Mono",
    googleFontsId: "JetBrains+Mono",
    cssFamily: "'JetBrains Mono', monospace",
  },
  {
    name: "Fira Code",
    googleFontsId: "Fira+Code",
    cssFamily: "'Fira Code', monospace",
  },
  {
    name: "Source Code Pro",
    googleFontsId: "Source+Code+Pro",
    cssFamily: "'Source Code Pro', monospace",
  },
  {
    name: "IBM Plex Mono",
    googleFontsId: "IBM+Plex+Mono",
    cssFamily: "'IBM Plex Mono', monospace",
  },
  {
    name: "Roboto Mono",
    googleFontsId: "Roboto+Mono",
    cssFamily: "'Roboto Mono', monospace",
  },
  {
    name: "Ubuntu Mono",
    googleFontsId: "Ubuntu+Mono",
    cssFamily: "'Ubuntu Mono', monospace",
  },
  {
    name: "Inconsolata",
    googleFontsId: "Inconsolata",
    cssFamily: "'Inconsolata', monospace",
  },
  {
    name: "Cascadia Code",
    googleFontsId: "Cascadia+Code",
    cssFamily: "'Cascadia Code', monospace",
  },
  {
    name: "Hack",
    googleFontsId: "Hack",
    cssFamily: "'Hack', monospace",
  },
  {
    name: "Anonymous Pro",
    googleFontsId: "Anonymous+Pro",
    cssFamily: "'Anonymous Pro', monospace",
  },
];

/**
 * Default font family to use when none is specified.
 */
export const DEFAULT_FONT_FAMILY = "JetBrains Mono";

/**
 * Gets the FontOption for a given font name.
 * Returns undefined if the font is not in the curated list.
 */
export function getFontOption(fontName: string): FontOption | undefined {
  return MONOSPACE_FONTS.find((f) => f.name === fontName);
}

/**
 * Generates a Google Fonts CSS URL for the given font name.
 * Returns null if the font is not in the curated list.
 */
export function getGoogleFontsUrl(fontName: string): string | null {
  const font = getFontOption(fontName);
  if (!font) {
    return null;
  }
  return `https://fonts.googleapis.com/css2?family=${font.googleFontsId}:wght@400;500;600;700&display=swap`;
}

/**
 * Gets the CSS font-family value for a given font name.
 * Falls back to "monospace" if the font is not in the curated list.
 */
export function getCssFontFamily(fontName: string): string {
  const font = getFontOption(fontName);
  return font?.cssFamily ?? "monospace";
}
