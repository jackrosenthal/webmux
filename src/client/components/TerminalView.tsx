import { useCallback } from "react";
import { Terminal } from "./Terminal";
import { TabBar } from "./TabBar";
import { useSession } from "../hooks/useSession";

/**
 * TerminalView manages WebSocket connection and session state.
 * Renders the tab bar and terminal for the current focused pane.
 */
export function TerminalView() {
  const { session, wsRef, loading, error } = useSession();

  const handleTabSelect = useCallback((tabId: string) => {
    // TODO: Implement tab switching via API in step 6.4
    console.log("Tab selected:", tabId);
  }, []);

  const handleNewTab = useCallback(() => {
    // TODO: Implement new tab creation via API in step 6.2
    console.log("New tab requested");
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
