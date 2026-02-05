import { Terminal } from "./Terminal";
import { useSession } from "../hooks/useSession";

/**
 * TerminalView manages WebSocket connection and session state.
 * Renders the terminal for the current focused pane.
 */
export function TerminalView() {
  const { session, wsRef, loading, error } = useSession();

  if (loading) {
    return <div className="terminal-loading">Connecting...</div>;
  }

  if (error) {
    return <div className="terminal-error">{error}</div>;
  }

  if (!session || !session.focusedPaneId) {
    return <div className="terminal-loading">No active pane</div>;
  }

  return <Terminal paneId={session.focusedPaneId} wsRef={wsRef} />;
}
