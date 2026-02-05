#!/usr/bin/env bun
/**
 * Fetches Gogh terminal themes and transforms them to xterm.js format.
 * Run with: bun scripts/fetch-gogh-themes.ts
 * Output: themes/gogh.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GoghTheme, TerminalTheme } from "../src/shared/theme";
import { goghToXterm } from "../src/shared/theme";

const GOGH_THEMES_URL =
  "https://raw.githubusercontent.com/Gogh-Co/Gogh/master/data/themes.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "themes", "gogh.json");

async function fetchGoghThemes(): Promise<GoghTheme[]> {
  console.log("Fetching Gogh themes from GitHub...");
  const response = await fetch(GOGH_THEMES_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch themes: ${response.status} ${response.statusText}`);
  }
  const themes = (await response.json()) as GoghTheme[];
  console.log(`Fetched ${themes.length} themes`);
  return themes;
}

function transformThemes(goghThemes: GoghTheme[]): TerminalTheme[] {
  console.log("Transforming themes to xterm.js format...");
  return goghThemes.map(goghToXterm);
}

async function main(): Promise<void> {
  const goghThemes = await fetchGoghThemes();
  const xtermThemes = transformThemes(goghThemes);

  // Ensure themes directory exists
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });

  // Write transformed themes
  await writeFile(OUTPUT_PATH, JSON.stringify(xtermThemes, null, 2));
  console.log(`Wrote ${xtermThemes.length} themes to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
