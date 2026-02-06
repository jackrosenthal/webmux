/**
 * Hook for managing terminal theme state.
 * Fetches themes from the server and provides the selected theme.
 * Theme selection is persisted to the server config file.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import type { TerminalTheme } from "../../shared/theme";
import { getConfig, getThemes, updateTheme } from "../services/api";

export interface UseThemeResult {
  /** The currently selected theme, or null if not yet loaded */
  theme: TerminalTheme | null;
  /** All available themes */
  themes: TerminalTheme[];
  /** Whether themes are still loading */
  loading: boolean;
  /** Name of the selected theme from config */
  selectedThemeName: string | null;
  /** Change the current theme */
  setTheme: (themeName: string) => void;
}

/**
 * Fetches themes and configuration, returning the selected theme.
 * Theme selection is persisted to the server config file.
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

        // Use the theme from server config
        setSelectedThemeName(config.appearance.theme);
      } finally {
        setLoading(false);
      }
    }
    loadThemeData();
  }, []);

  const setTheme = useCallback((themeName: string) => {
    setSelectedThemeName(themeName);
    // Persist to server config file (fire and forget, log errors)
    updateTheme(themeName).then((result) => {
      if (!result.success) {
        console.error("Failed to persist theme:", result.error);
      }
    });
  }, []);

  const theme = useMemo(() => {
    if (!selectedThemeName || themes.length === 0) return null;
    return themes.find((t) => t.name === selectedThemeName) ?? themes[0] ?? null;
  }, [themes, selectedThemeName]);

  return { theme, themes, loading, selectedThemeName, setTheme };
}
