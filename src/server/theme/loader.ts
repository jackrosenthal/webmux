/**
 * Theme loader for Webmux.
 * Loads bundled Gogh themes and merges with user themes from
 * ~/.config/webmux/themes/*.json
 */

import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";
import type { TerminalTheme } from "../../shared/theme.js";

// Import bundled themes with { type: "file" } so Bun embeds them in the binary.
// TypeScript's resolveJsonModule types this as JSON content, but Bun's
// { type: "file" } import attribute returns a path string at runtime.
import bundledThemesImport from "../../../themes/gogh.json" with { type: "file" };
const bundledThemesPath = bundledThemesImport as unknown as string;

function getUserThemesDir(): string {
  return path.join(os.homedir(), ".config", "webmux", "themes");
}

/**
 * Validates that an object has the required theme properties.
 */
function isValidTheme(obj: unknown): obj is TerminalTheme {
  if (typeof obj !== "object" || obj === null) return false;
  const theme = obj as Record<string, unknown>;
  const requiredKeys = [
    "name",
    "foreground",
    "background",
    "cursor",
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "brightBlack",
    "brightRed",
    "brightGreen",
    "brightYellow",
    "brightBlue",
    "brightMagenta",
    "brightCyan",
    "brightWhite",
  ];
  return requiredKeys.every(
    (key) => key in theme && typeof theme[key] === "string"
  );
}

/**
 * Loads bundled themes from themes/gogh.json.
 * Uses the embedded path from the import attribute for compiled binary support.
 */
async function loadBundledThemes(): Promise<TerminalTheme[]> {
  try {
    const content = await Bun.file(bundledThemesPath).text();
    const themes = JSON.parse(content) as unknown[];
    return themes.filter(isValidTheme);
  } catch (err) {
    console.warn("Failed to load bundled themes:", err);
    return [];
  }
}

/**
 * Loads a single user theme from a JSON file.
 * Returns null if the file is invalid.
 */
async function loadUserThemeFile(
  filePath: string
): Promise<TerminalTheme | TerminalTheme[] | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as unknown;

    // Support both single theme and array of themes
    if (Array.isArray(parsed)) {
      return parsed.filter(isValidTheme);
    }
    if (isValidTheme(parsed)) {
      return parsed;
    }
    console.warn(`Invalid theme format in ${filePath}`);
    return null;
  } catch (err) {
    console.warn(`Failed to load theme from ${filePath}:`, err);
    return null;
  }
}

/**
 * Loads user themes from ~/.config/webmux/themes/*.json.
 */
async function loadUserThemes(): Promise<TerminalTheme[]> {
  const themesDir = getUserThemesDir();
  if (!existsSync(themesDir)) {
    return [];
  }

  const files = await readdir(themesDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const themes: TerminalTheme[] = [];
  for (const file of jsonFiles) {
    const filePath = path.join(themesDir, file);
    const result = await loadUserThemeFile(filePath);
    if (result) {
      if (Array.isArray(result)) {
        themes.push(...result);
      } else {
        themes.push(result);
      }
    }
  }
  return themes;
}

/**
 * Loads all themes: bundled themes merged with user themes.
 * User themes with the same name as bundled themes will override them.
 */
export async function loadAllThemes(): Promise<TerminalTheme[]> {
  const bundled = await loadBundledThemes();
  const user = await loadUserThemes();

  // Create a map for deduplication, user themes override bundled
  const themeMap = new Map<string, TerminalTheme>();
  for (const theme of bundled) {
    themeMap.set(theme.name, theme);
  }
  for (const theme of user) {
    themeMap.set(theme.name, theme);
  }

  // Return sorted by name
  return Array.from(themeMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
