/**
 * Hook for managing session state with WebSocket synchronization.
 * Fetches initial state from the API and subscribes to real-time updates.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionState } from "../../shared/types";
import type { ServerMessage } from "../../shared/protocol";
import { createTerminalWebSocket } from "../services/ws";

interface UseSessionResult {
  /** Current session state, or null if not yet loaded */
  session: SessionState | null;
  /** WebSocket reference for terminal I/O */
  wsRef: React.RefObject<WebSocket | null>;
  /** Whether the session is currently loading */
  loading: boolean;
  /** Error message if session failed to load */
  error: string | null;
}

/**
 * Fetches the current session state from the API.
 */
async function fetchSession(): Promise<SessionState> {
  const response = await fetch("/api/session");
  if (!response.ok) {
    throw new Error(`Failed to fetch session: ${response.status}`);
  }
  return response.json();
}

/**
 * Hook that manages session state and WebSocket connection.
 * Fetches initial state and subscribes to real-time session updates.
 */
export function useSession(): UseSessionResult {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: ServerMessage = JSON.parse(event.data);
      if (message.type === "sessionSync") {
        setSession(message.state);
      }
    } catch {
      // Ignore non-JSON messages or parse errors
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Create WebSocket connection
    const ws = createTerminalWebSocket();
    wsRef.current = ws;

    ws.addEventListener("message", handleMessage);

    ws.addEventListener("open", async () => {
      try {
        const state = await fetchSession();
        if (mounted) {
          setSession(state);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load session");
          setLoading(false);
        }
      }
    });

    ws.addEventListener("error", () => {
      if (mounted) {
        setError("WebSocket connection error");
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      ws.removeEventListener("message", handleMessage);
      ws.close();
      wsRef.current = null;
    };
  }, [handleMessage]);

  return { session, wsRef, loading, error };
}
