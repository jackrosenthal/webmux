import type { TerminalTheme } from "../../shared/theme";

interface ThemeSelectorProps {
  themes: TerminalTheme[];
  selectedThemeName: string | null;
  onThemeChange: (themeName: string) => void;
}

/**
 * Dropdown selector for terminal color themes.
 */
export function ThemeSelector({
  themes,
  selectedThemeName,
  onThemeChange,
}: ThemeSelectorProps) {
  return (
    <select
      className="theme-selector"
      value={selectedThemeName ?? ""}
      onChange={(e) => onThemeChange(e.target.value)}
    >
      {themes.map((theme) => (
        <option key={theme.name} value={theme.name}>
          {theme.name}
        </option>
      ))}
    </select>
  );
}
