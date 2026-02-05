import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { ClientMessage, ServerMessage } from "../../shared/protocol";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  paneId: string;
  wsRef: React.RefObject<WebSocket | null>;
}

/**
 * Terminal component that renders an xterm.js terminal and connects to
 * the backend via WebSocket for input/output.
 */
export function Terminal({ paneId, wsRef }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: "monospace",
      fontSize: 14,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    xterm.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

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
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [paneId, wsRef]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const message: ServerMessage = JSON.parse(event.data);
      if (message.paneId !== paneId) return;

      if (message.type === "output" && xtermRef.current) {
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
