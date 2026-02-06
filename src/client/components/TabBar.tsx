import type { Tab } from "../../shared/types";
import { IconSettings } from "@tabler/icons-react";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onNewTab: () => void;
  onOpenSettings: () => void;
}

/**
 * TabBar displays tab buttons with active indicator, new tab button,
 * and settings button.
 */
export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onNewTab,
  onOpenSettings,
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
        <button
          className="settings-icon-button"
          onClick={onOpenSettings}
          title="Settings"
        >
          <IconSettings size={18} />
        </button>
      </div>
    </div>
  );
}
