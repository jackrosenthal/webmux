import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { ClientMessage, ServerMessage } from "../../shared/protocol";
import type { TerminalTheme } from "../../shared/theme";
import { registerTerminal, unregisterTerminal } from "../services/terminalRegistry";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  paneId: string;
  wsRef: React.RefObject<WebSocket | null>;
  theme?: TerminalTheme | null | undefined;
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
  if (ws && ws.readyState === WebSocket.OPEN) {
    const message: ClientMessage = {
      type: "resize",
      paneId,
      cols,
      rows,
    };
    ws.send(JSON.stringify(message));
  }
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
export function Terminal({ paneId, wsRef, theme }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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

    // Apply theme if available at creation time
    if (theme) {
      xtermOptions.theme = toXtermTheme(theme);
    }

    const xterm = new XTerm(xtermOptions);

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    xterm.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Register terminal for copy/paste operations
    registerTerminal(paneId, xterm);

    // Send initial size to backend
    sendResize(wsRef.current, paneId, xterm.cols, xterm.rows);

    xterm.onData((data: string) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const message: ClientMessage = {
          type: "input",
          paneId,
          data,
        };
        ws.send(JSON.stringify(message));
      }
    });

    return () => {
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
      const message: ServerMessage = JSON.parse(event.data);

      // Only handle output messages for this pane
      if (message.type === "output" && message.paneId === paneId && xtermRef.current) {
        xtermRef.current.write(message.data);
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => {
      ws.removeEventListener("message", handleMessage);
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
