import { useCallback } from "react";
import { Terminal } from "./Terminal";
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

  if (!session || !session.focusedPaneId) {
    return <div className="terminal-loading">No active pane</div>;
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
        <Terminal paneId={session.focusedPaneId} wsRef={wsRef} />
      </div>
    </div>
  );
}
