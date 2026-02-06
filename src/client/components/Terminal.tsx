import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import type { ClientMessage, ServerMessage } from "../../shared/protocol";
import type { TerminalTheme } from "../../shared/theme";
import type { ShortcutsConfig } from "../../shared/config";
import { parseShortcut, matchesShortcut, isLeaderModeActive } from "../hooks/useShortcuts";
import { registerTerminal, unregisterTerminal } from "../services/terminalRegistry";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  paneId: string;
  wsRef: React.RefObject<WebSocket | null>;
  theme?: TerminalTheme | null | undefined;
  scrollbackLines?: number | undefined;
  shortcutsConfig?: ShortcutsConfig | undefined;
}

/**
 * Safely sends a message over WebSocket, catching and logging errors.
 */
function safeSend(ws: WebSocket | null, message: ClientMessage): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }
  try {
    ws.send(JSON.stringify(message));
  } catch (err) {
    console.error("Failed to send WebSocket message:", err);
  }
}

/**
 * Sends a resize message to the backend to update PTY dimensions.
 */
function sendResize(
  ws: WebSocket | null,
  paneId: string,
  cols: number,
  rows: number
): void {
  safeSend(ws, {
    type: "resize",
    paneId,
    cols,
    rows,
  });
}

/**
 * Sends a subscribe message to request scrollback replay and live output.
 */
function sendSubscribe(ws: WebSocket | null, paneId: string): void {
  safeSend(ws, {
    type: "subscribe",
    paneId,
  });
}

/**
 * Sends an unsubscribe message when component unmounts (e.g., tab switch).
 */
function sendUnsubscribe(ws: WebSocket | null, paneId: string): void {
  safeSend(ws, {
    type: "unsubscribe",
    paneId,
  });
}

/**
 * Converts TerminalTheme to xterm.js ITheme format (excludes name).
 */
function toXtermTheme(theme: TerminalTheme): Omit<TerminalTheme, "name"> {
  const { name: _, ...xtermTheme } = theme;
  return xtermTheme;
}

/**
 * Terminal component that renders an xterm.js terminal and connects to
 * the backend via WebSocket for input/output.
 */
export function Terminal({ paneId, wsRef, theme, scrollbackLines, shortcutsConfig }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const shortcutsConfigRef = useRef<ShortcutsConfig | undefined>(shortcutsConfig);

  // Keep ref updated with latest config
  useEffect(() => {
    shortcutsConfigRef.current = shortcutsConfig;
  }, [shortcutsConfig]);

  const handleResize = useCallback(() => {
    const fitAddon = fitAddonRef.current;
    const xterm = xtermRef.current;
    if (!fitAddon || !xterm) return;

    fitAddon.fit();
    sendResize(wsRef.current, paneId, xterm.cols, xterm.rows);
  }, [paneId, wsRef]);

  useEffect(() => {
    if (!containerRef.current) return;

    const xtermOptions: ConstructorParameters<typeof XTerm>[0] = {
      cursorBlink: true,
      fontFamily: "monospace",
      fontSize: 14,
    };

    // Apply scrollback if configured
    if (scrollbackLines !== undefined) {
      xtermOptions.scrollback = scrollbackLines;
    }

    // Apply theme if available at creation time
    if (theme) {
      xtermOptions.theme = toXtermTheme(theme);
    }

    const xterm = new XTerm(xtermOptions);

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    const webLinksAddon = new WebLinksAddon();
    xterm.loadAddon(webLinksAddon);

    xterm.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Allow leader key and shortcuts to bubble up to window
    xterm.attachCustomKeyEventHandler((event) => {
      // Only handle keydown, not keyup
      if (event.type !== "keydown") {
        return true;
      }

      // When leader mode is active, pass ALL keys to the shortcut handler
      if (isLeaderModeActive()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }

      // Let Ctrl+Shift combinations pass through (for copy/paste)
      if (event.ctrlKey && event.shiftKey) {
        return false;
      }

      // Let leader key pass through
      const config = shortcutsConfigRef.current;
      if (config?.leader) {
        const leader = parseShortcut(config.leader);
        if (matchesShortcut(event, leader)) {
          return false;
        }
      }

      // Let xterm handle all other keys
      return true;
    });

    // Register terminal for copy/paste operations
    registerTerminal(paneId, xterm);

    // Send initial size to backend
    sendResize(wsRef.current, paneId, xterm.cols, xterm.rows);

    xterm.onData((data: string) => {
      // Don't send input while in leader mode
      if (isLeaderModeActive()) {
        return;
      }
      safeSend(wsRef.current, {
        type: "input",
        paneId,
        data,
      });
    });

    // Capture ws for cleanup
    const ws = wsRef.current;

    return () => {
      // Unsubscribe from pane so server knows to replay scrollback on next subscribe
      sendUnsubscribe(ws, paneId);
      unregisterTerminal(paneId);
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
    // Note: theme is intentionally not in deps - we handle theme changes separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId, wsRef]);

  // Apply theme changes dynamically
  useEffect(() => {
    if (xtermRef.current && theme) {
      xtermRef.current.options.theme = toXtermTheme(theme);
    }
  }, [theme]);

  // Auto-resize terminal when container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        // Only handle output messages for this pane
        if (message.type === "output" && message.paneId === paneId && xtermRef.current) {
          xtermRef.current.write(message.data);
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => {
      ws.removeEventListener("message", handleMessage);
    };
  }, [paneId, wsRef]);

  // Subscribe to the pane to receive scrollback replay and live output
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) {
      return;
    }

    // If WebSocket is already open, subscribe immediately
    if (ws.readyState === WebSocket.OPEN) {
      sendSubscribe(ws, paneId);
    }

    // Also subscribe when WebSocket opens (handles reconnect case)
    const handleOpen = () => {
      sendSubscribe(ws, paneId);
    };

    ws.addEventListener("open", handleOpen);
    return () => {
      ws.removeEventListener("open", handleOpen);
    };
  }, [paneId, wsRef]);

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
