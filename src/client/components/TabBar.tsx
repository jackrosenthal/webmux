import type { Tab } from "../../shared/types";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onNewTab: () => void;
}

/**
 * TabBar displays tab buttons with active indicator and a new tab button.
 */
export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onNewTab,
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
    </div>
  );
}
