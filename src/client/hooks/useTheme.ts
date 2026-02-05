/**
 * Hook for managing terminal theme state.
 * Fetches themes from the server and provides the selected theme.
 */

import { useState, useEffect, useMemo } from "react";
import type { TerminalTheme } from "../../shared/theme";
import { getConfig, getThemes } from "../services/api";

export interface UseThemeResult {
  /** The currently selected theme, or null if not yet loaded */
  theme: TerminalTheme | null;
  /** All available themes */
  themes: TerminalTheme[];
  /** Whether themes are still loading */
  loading: boolean;
  /** Name of the selected theme from config */
  selectedThemeName: string | null;
}

/**
 * Fetches themes and configuration, returning the selected theme.
 */
export function useTheme(): UseThemeResult {
  const [themes, setThemes] = useState<TerminalTheme[]>([]);
  const [selectedThemeName, setSelectedThemeName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadThemeData() {
      try {
        const [themesData, config] = await Promise.all([
          getThemes(),
          getConfig(),
        ]);
        setThemes(themesData);
        setSelectedThemeName(config.appearance.theme);
      } finally {
        setLoading(false);
      }
    }
    loadThemeData();
  }, []);

  const theme = useMemo(() => {
    if (!selectedThemeName || themes.length === 0) return null;
    return themes.find((t) => t.name === selectedThemeName) ?? themes[0] ?? null;
  }, [themes, selectedThemeName]);

  return { theme, themes, loading, selectedThemeName };
}
