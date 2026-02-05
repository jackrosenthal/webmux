/**
 * Hook for managing terminal theme state.
 * Fetches themes from the server and provides the selected theme.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import type { TerminalTheme } from "../../shared/theme";
import { getConfig, getThemes } from "../services/api";

const THEME_STORAGE_KEY = "webmux:theme";

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
 * Theme selection is persisted to localStorage for client-side persistence.
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

        // Check localStorage first, fall back to config
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme && themesData.some((t) => t.name === storedTheme)) {
          setSelectedThemeName(storedTheme);
        } else {
          setSelectedThemeName(config.appearance.theme);
        }
      } finally {
        setLoading(false);
      }
    }
    loadThemeData();
  }, []);

  const setTheme = useCallback((themeName: string) => {
    setSelectedThemeName(themeName);
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
  }, []);

  const theme = useMemo(() => {
    if (!selectedThemeName || themes.length === 0) return null;
    return themes.find((t) => t.name === selectedThemeName) ?? themes[0] ?? null;
  }, [themes, selectedThemeName]);

  return { theme, themes, loading, selectedThemeName, setTheme };
}
