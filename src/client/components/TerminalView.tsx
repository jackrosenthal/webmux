import { useCallback } from "react";
import { SplitContainer } from "./SplitContainer";
import { TabBar } from "./TabBar";
import { useSession } from "../hooks/useSession";
import { setActiveTab, createTab } from "../services/api";

/**
 * TerminalView manages WebSocket connection and session state.
 * Renders the tab bar and terminal for the current focused pane.
 */
export function TerminalView() {
  const { session, wsRef, loading, error } = useSession();

  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const handleNewTab = useCallback(() => {
    createTab();
  }, []);

  if (loading) {
    return <div className="terminal-loading">Connecting...</div>;
  }

  if (error) {
    return <div className="terminal-error">{error}</div>;
  }

  if (!session) {
    return <div className="terminal-loading">No active pane</div>;
  }

  const activeTab = session.tabs.find((tab) => tab.id === session.activeTabId);
  if (!activeTab) {
    return <div className="terminal-loading">No active tab</div>;
  }

  return (
    <div className="main-container">
      <TabBar
        tabs={session.tabs}
        activeTabId={session.activeTabId}
        onTabSelect={handleTabSelect}
        onNewTab={handleNewTab}
      />
      <div className="terminal-area">
        <SplitContainer node={activeTab.layout} wsRef={wsRef} />
      </div>
    </div>
  );
}
