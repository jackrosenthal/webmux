/**
 * Hook for managing settings state with WebSocket synchronization.
 * Fetches settings from the server and subscribes to real-time updates.
 * Provides optimistic updates with error rollback.
 */

import { useCallback, useEffect, useState, useRef } from "react";
import type { ShortcutsConfig, TerminalConfig } from "../../shared/config";
import type { ServerMessage } from "../../shared/protocol";
import {
  getSettings,
  updateSettings,
  type ClientSettings,
  type SettingsUpdate,
} from "../services/api";

interface UseSettingsResult {
  /** Current settings, or null if not yet loaded */
  settings: ClientSettings | null;
  /** Whether settings are currently loading */
  loading: boolean;
  /** Error message if settings failed to load or update */
  error: string | null;
  /** Whether an update is currently in progress */
  updating: boolean;
  /** Update settings with optimistic updates */
  update: (updates: SettingsUpdate) => Promise<boolean>;
  /** Reload settings from the server */
  reload: () => Promise<void>;
}

/**
 * Hook that manages settings state with WebSocket synchronization.
 * Fetches settings on mount and subscribes to WebSocket for real-time updates.
 * Provides optimistic updates that rollback on error.
 *
 * @param wsRef - Reference to the WebSocket connection for listening to settings sync
 */
export function useSettings(
  wsRef: React.RefObject<WebSocket | null>
): UseSettingsResult {
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const mountedRef = useRef(true);

  // Load settings on mount
  useEffect(() => {
    mountedRef.current = true;

    async function loadSettings() {
      try {
        const data = await getSettings();
        if (mountedRef.current) {
          setSettings(data);
          setLoading(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Subscribe to WebSocket settings sync messages
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    function handleMessage(event: MessageEvent) {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        if (message.type === "settingsSync" && mountedRef.current) {
          setSettings(message.settings);
          setError(null);
        }
      } catch {
        // Ignore non-JSON messages or parse errors
      }
    }

    ws.addEventListener("message", handleMessage);

    return () => {
      ws.removeEventListener("message", handleMessage);
    };
  }, [wsRef]);

  // Reload settings from server
  const reload = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSettings();
      if (mountedRef.current) {
        setSettings(data);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
        setLoading(false);
      }
    }
  }, []);

  // Update settings with optimistic updates
  const update = useCallback(
    async (updates: SettingsUpdate): Promise<boolean> => {
      if (!mountedRef.current || !settings) return false;

      // Store previous state for rollback
      const previousSettings = settings;

      // Apply optimistic update
      const optimisticSettings: ClientSettings = {
        appearance: {
          ...settings.appearance,
          ...updates.appearance,
        },
        security: {
          ...settings.security,
          ...(updates.security?.token_validity_days !== undefined
            ? { token_validity_days: updates.security.token_validity_days }
            : {}),
        },
        shortcuts: {
          ...settings.shortcuts,
          ...updates.shortcuts,
        } as ShortcutsConfig,
        terminal: {
          ...settings.terminal,
          ...updates.terminal,
        } as TerminalConfig,
      };

      setSettings(optimisticSettings);
      setUpdating(true);
      setError(null);

      try {
        const result = await updateSettings(updates);
        if (!mountedRef.current) return false;

        if (!result.success) {
          // Rollback on error
          setSettings(previousSettings);
          setError(result.error ?? "Failed to update settings");
          setUpdating(false);
          return false;
        }

        // Server will broadcast the update via WebSocket, but we can also use
        // the response to ensure local state is accurate
        if (result.settings) {
          setSettings(result.settings);
        }
        setUpdating(false);
        return true;
      } catch (err) {
        if (mountedRef.current) {
          // Rollback on error
          setSettings(previousSettings);
          setError(err instanceof Error ? err.message : "Failed to update settings");
          setUpdating(false);
        }
        return false;
      }
    },
    [settings]
  );

  return {
    settings,
    loading,
    error,
    updating,
    update,
    reload,
  };
}
