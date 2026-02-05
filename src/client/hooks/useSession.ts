/**
 * Hook for managing session state with WebSocket synchronization.
 * Fetches initial state from the API and subscribes to real-time updates.
 * Handles disconnection gracefully with auto-reconnect and exponential backoff.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionState } from "../../shared/types";
import type { ServerMessage } from "../../shared/protocol";
import { createTerminalWebSocket } from "../services/ws";

/** WebSocket connection status */
export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

interface UseSessionResult {
  /** Current session state, or null if not yet loaded */
  session: SessionState | null;
  /** WebSocket reference for terminal I/O */
  wsRef: React.RefObject<WebSocket | null>;
  /** Whether the session is currently loading */
  loading: boolean;
  /** Error message if session failed to load */
  error: string | null;
  /** Current WebSocket connection status */
  connectionStatus: ConnectionStatus;
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

/** Reconnection configuration */
const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 30000;
const RECONNECT_BACKOFF_MULTIPLIER = 1.5;

/**
 * Hook that manages session state and WebSocket connection.
 * Fetches initial state and subscribes to real-time session updates.
 * Automatically reconnects with exponential backoff on disconnection.
 */
export function useSession(): UseSessionResult {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const mountedRef = useRef(true);
  // Track if we've ever successfully connected (for deciding reconnect vs initial failure)
  const hasConnectedRef = useRef(false);

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

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const ws = createTerminalWebSocket();
    wsRef.current = ws;

    ws.addEventListener("message", handleMessage);

    ws.addEventListener("open", async () => {
      if (!mountedRef.current) return;

      // Mark that we've successfully connected at least once
      hasConnectedRef.current = true;
      // Reset reconnect delay on successful connection
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
      setConnectionStatus("connected");

      try {
        const state = await fetchSession();
        if (mountedRef.current) {
          setSession(state);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to load session");
          setLoading(false);
        }
      }
    });

    ws.addEventListener("error", () => {
      // Error will be followed by close event, so we handle reconnection there
    });

    ws.addEventListener("close", () => {
      if (!mountedRef.current) return;

      wsRef.current = null;

      // Attempt reconnection if we've ever connected successfully
      if (hasConnectedRef.current) {
        setConnectionStatus("reconnecting");

        // Schedule reconnection with exponential backoff
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * RECONNECT_BACKOFF_MULTIPLIER,
          MAX_RECONNECT_DELAY_MS
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, delay);
      } else {
        // Initial connection failed
        setConnectionStatus("disconnected");
        setError("Failed to connect to server");
        setLoading(false);
      }
    });
  }, [handleMessage]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { session, wsRef, loading, error, connectionStatus };
}
