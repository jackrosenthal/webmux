/**
 * Theme types shared between server and client.
 * Compatible with xterm.js ITheme interface.
 */

/**
 * A terminal color theme compatible with xterm.js.
 */
export interface TerminalTheme {
  name: string;
  foreground: string;
  background: string;
  cursor: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/**
 * Raw theme format from Gogh themes JSON.
 */
export interface GoghTheme {
  name: string;
  author: string;
  variant: string;
  color_01: string;
  color_02: string;
  color_03: string;
  color_04: string;
  color_05: string;
  color_06: string;
  color_07: string;
  color_08: string;
  color_09: string;
  color_10: string;
  color_11: string;
  color_12: string;
  color_13: string;
  color_14: string;
  color_15: string;
  color_16: string;
  background: string;
  foreground: string;
  cursor: string;
  hash: string;
}

/**
 * Transforms a Gogh theme to xterm.js compatible format.
 */
export function goghToXterm(gogh: GoghTheme): TerminalTheme {
  return {
    name: gogh.name,
    foreground: gogh.foreground,
    background: gogh.background,
    cursor: gogh.cursor,
    // Standard colors (color_01-08)
    black: gogh.color_01,
    red: gogh.color_02,
    green: gogh.color_03,
    yellow: gogh.color_04,
    blue: gogh.color_05,
    magenta: gogh.color_06,
    cyan: gogh.color_07,
    white: gogh.color_08,
    // Bright colors (color_09-16)
    brightBlack: gogh.color_09,
    brightRed: gogh.color_10,
    brightGreen: gogh.color_11,
    brightYellow: gogh.color_12,
    brightBlue: gogh.color_13,
    brightMagenta: gogh.color_14,
    brightCyan: gogh.color_15,
    brightWhite: gogh.color_16,
  };
}
