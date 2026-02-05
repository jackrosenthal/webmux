import type { Tab } from "../../shared/types";
import type { TerminalTheme } from "../../shared/theme";
import { ThemeSelector } from "./ThemeSelector";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onNewTab: () => void;
  themes: TerminalTheme[];
  selectedThemeName: string | null;
  onThemeChange: (themeName: string) => void;
}

/**
 * TabBar displays tab buttons with active indicator, new tab button,
 * and theme selector.
 */
export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onNewTab,
  themes,
  selectedThemeName,
  onThemeChange,
}: TabBarProps) {
  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${tab.id === activeTabId ? "active" : ""}`}
            onClick={() => onTabSelect(tab.id)}
          >
            {tab.name}
          </button>
        ))}
        <button
          className="tab-button new-tab-button"
          onClick={onNewTab}
          title="New Tab"
        >
          +
        </button>
      </div>
      <div className="tab-bar-right">
        <ThemeSelector
          themes={themes}
          selectedThemeName={selectedThemeName}
          onThemeChange={onThemeChange}
        />
      </div>
    </div>
  );
}
