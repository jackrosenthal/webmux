import { useEffect, useRef, useState } from "react";
import { Terminal } from "./Terminal";
import { createPane } from "../services/api";
import { createTerminalWebSocket } from "../services/ws";

/**
 * TerminalView manages WebSocket connection and pane lifecycle.
 * For Phase 4, this creates a single pane on mount.
 */
export function TerminalView() {
  const [paneId, setPaneId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = createTerminalWebSocket();
    wsRef.current = ws;

    ws.addEventListener("open", async () => {
      const id = await createPane();
      setPaneId(id);
    });

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  if (!paneId) {
    return <div className="terminal-loading">Connecting...</div>;
  }

  return <Terminal paneId={paneId} wsRef={wsRef} />;
}
