/**
 * WebSocket handler for terminal I/O.
 * Multiplexes terminal data for multiple panes over a single WebSocket connection.
 */

import type { ServerWebSocket } from "bun";
import { verify } from "hono/jwt";
import { ptyManager } from "../pty/manager.js";
import type { ClientMessage, ServerMessage } from "../../shared/protocol.js";
import { AUTH_COOKIE_NAME } from "../auth/middleware.js";
import { OscTitleParser } from "../pty/osc-parser.js";
import { sessionStore } from "../session/store.js";

/**
 * Data attached to each WebSocket connection.
 */
export interface WebSocketData {
  authenticated: boolean;
}

/**
 * Tracks all connected WebSocket clients.
 */
const connectedClients = new Set<ServerWebSocket<WebSocketData>>();

/**
 * Maps pane IDs to their subscribed WebSocket clients.
 */
const paneSubscribers = new Map<string, Set<ServerWebSocket<WebSocketData>>>();

/**
 * Parses cookies from a Cookie header string.
 */
function parseCookies(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name) {
      cookies.set(name, valueParts.join("="));
    }
  }
  return cookies;
}

/**
 * Authenticates a WebSocket upgrade request by verifying the JWT cookie.
 */
export async function authenticateWebSocket(
  req: Request,
  jwtSecret: string
): Promise<boolean> {
  const cookieHeader = req.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const token = cookies.get(AUTH_COOKIE_NAME);

  if (!token) {
    return false;
  }

  try {
    const payload = await verify(token, jwtSecret, "HS256");
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Handles the WebSocket upgrade for terminal connections.
 */
export function handleUpgrade(
  server: ReturnType<typeof Bun.serve>,
  req: Request,
  jwtSecret: string
): Response | undefined {
  const url = new URL(req.url);
  if (url.pathname !== "/ws/terminal") {
    return undefined;
  }

  // Authenticate the request - this is async, but we need to check synchronously
  // So we do a synchronous cookie check here and full verification in open()
  const cookieHeader = req.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const token = cookies.get(AUTH_COOKIE_NAME);

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Upgrade the connection
  const upgraded = server.upgrade(req, {
    data: {
      authenticated: false,
      jwtSecret,
      token,
    } as WebSocketData & { jwtSecret: string; token: string },
  });

  if (!upgraded) {
    return new Response("WebSocket upgrade failed", { status: 500 });
  }

  return undefined;
}

/**
 * Broadcasts a message to all clients subscribed to a pane.
 */
function broadcastToPane(paneId: string, message: ServerMessage): void {
  const subscribers = paneSubscribers.get(paneId);
  if (!subscribers) return;

  const messageStr = JSON.stringify(message);
  for (const client of subscribers) {
    try {
      client.send(messageStr);
    } catch (err) {
      console.error(`Failed to send message to client for pane ${paneId}:`, err);
    }
  }
}

/**
 * Subscribes a client to PTY output for a pane.
 */
function subscribeToPty(
  ws: ServerWebSocket<WebSocketData>,
  paneId: string
): void {
  let subscribers = paneSubscribers.get(paneId);
  if (!subscribers) {
    subscribers = new Set();
    paneSubscribers.set(paneId, subscribers);
  }
  subscribers.add(ws);
}

/**
 * Unsubscribes a client from a pane.
 * Exported for use when panes are deleted.
 */
export function unsubscribeFromPane(
  ws: ServerWebSocket<WebSocketData>,
  paneId: string
): void {
  const subscribers = paneSubscribers.get(paneId);
  if (subscribers) {
    subscribers.delete(ws);
    if (subscribers.size === 0) {
      paneSubscribers.delete(paneId);
    }
  }
}

/**
 * Unsubscribes a client from all panes.
 */
function unsubscribeFromAllPanes(ws: ServerWebSocket<WebSocketData>): void {
  for (const [paneId, subscribers] of paneSubscribers) {
    subscribers.delete(ws);
    if (subscribers.size === 0) {
      paneSubscribers.delete(paneId);
    }
  }
}

/**
 * Sends an error message to a WebSocket client.
 */
function sendError(ws: ServerWebSocket<WebSocketData>, error: string): void {
  try {
    const errorMessage: ServerMessage = { type: "error", error };
    ws.send(JSON.stringify(errorMessage));
  } catch (err) {
    console.error("Failed to send error message to client:", err);
  }
}

/**
 * Handles incoming WebSocket messages.
 */
function handleMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: string
): void {
  let parsed: ClientMessage;
  try {
    parsed = JSON.parse(message) as ClientMessage;
  } catch {
    console.error("Invalid WebSocket message:", message);
    sendError(ws, "Invalid message format");
    return;
  }

  console.log(`[WS] Received message: ${parsed.type}, paneId: ${"paneId" in parsed ? parsed.paneId : "N/A"}`);

  try {
    switch (parsed.type) {
      case "input": {
        const pty = ptyManager.get(parsed.paneId);
        if (pty) {
          pty.write(parsed.data);
        }
        // Subscribe the client to this pane's output if not already
        subscribeToPty(ws, parsed.paneId);
        break;
      }

      case "resize": {
        ptyManager.resize(parsed.paneId, parsed.cols, parsed.rows);
        break;
      }

      case "focus": {
        // Update the global focused pane in session state
        sessionStore.setFocusedPane(parsed.paneId);
        break;
      }

      case "subscribe": {
        // Subscribe the client to the pane and send buffered scrollback
        const subscribers = paneSubscribers.get(parsed.paneId);
        const alreadySubscribed = subscribers?.has(ws) ?? false;

        console.log(`[WS] Subscribe: paneId=${parsed.paneId}, alreadySubscribed=${alreadySubscribed}, ptyExists=${!!ptyManager.get(parsed.paneId)}`);

        subscribeToPty(ws, parsed.paneId);

        // Only send scrollback if this is a new subscription
        if (!alreadySubscribed) {
          const scrollback = ptyManager.getScrollback(parsed.paneId);
          console.log(`[WS] Scrollback for ${parsed.paneId}: ${scrollback.length} bytes`);
          if (scrollback) {
            const replayMessage: ServerMessage = {
              type: "output",
              paneId: parsed.paneId,
              data: scrollback,
            };
            try {
              ws.send(JSON.stringify(replayMessage));
            } catch (err) {
              console.error(`Failed to send scrollback to client for pane ${parsed.paneId}:`, err);
            }
          }
        }
        break;
      }

      case "unsubscribe": {
        // Unsubscribe the client from the pane (e.g., when terminal component unmounts)
        console.log(`[WS] Unsubscribe: paneId=${parsed.paneId}`);
        unsubscribeFromPane(ws, parsed.paneId);
        break;
      }
    }
  } catch (err) {
    console.error("Error handling WebSocket message:", err);
    sendError(ws, "Internal server error");
  }
}

/**
 * Sets up PTY output listeners to forward data to WebSocket clients.
 * Call this when a PTY is spawned to wire up the output.
 * Also parses OSC escape sequences to extract and update pane titles.
 * Buffers output for scrollback replay on reconnect.
 */
export function attachPtyToWebSocket(paneId: string): void {
  const pty = ptyManager.get(paneId);
  if (!pty) {
    console.error(`[PTY] attachPtyToWebSocket: No PTY found for pane ${paneId}`);
    return;
  }

  console.log(`[PTY] Attaching WebSocket handler for pane ${paneId}`);
  const oscParser = new OscTitleParser();

  // Set up data callback using BunPty's onData method
  pty.onData((data: string) => {
    try {
      console.log(`[PTY] Output for ${paneId}: ${data.length} bytes`);
      // Buffer output for scrollback replay
      ptyManager.appendToScrollback(paneId, data);

      // Parse OSC escape sequences for title changes
      try {
        const title = oscParser.process(data);
        if (title !== null) {
          sessionStore.setPaneTitle(paneId, title);
        }
      } catch (err) {
        console.error(`Failed to parse OSC sequence for pane ${paneId}:`, err);
      }

      const subscriberCount = paneSubscribers.get(paneId)?.size ?? 0;
      console.log(`[PTY] Broadcasting to ${subscriberCount} subscribers for pane ${paneId}`);
      broadcastToPane(paneId, {
        type: "output",
        paneId,
        data,
      });
    } catch (err) {
      console.error(`Error processing PTY output for pane ${paneId}:`, err);
    }
  });

  // Set up exit callback using BunPty's onExit method
  pty.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
    console.log(`[PTY] Process exited for pane ${paneId}: exitCode=${exitCode}, signal=${signal}`);
    broadcastToPane(paneId, {
      type: "exit",
      paneId,
      exitCode,
    });
  });
}

/**
 * WebSocket handlers for Bun's native WebSocket support.
 */
export function createWebSocketHandlers(jwtSecret: string) {
  return {
    async open(
      ws: ServerWebSocket<WebSocketData & { jwtSecret?: string; token?: string }>
    ) {
      console.log(`[WS] Connection opened, authenticated=${ws.data.authenticated}`);
      // If already authenticated by the HTTP upgrade handler, just register the client
      if (ws.data.authenticated) {
        connectedClients.add(ws as ServerWebSocket<WebSocketData>);
        console.log(`[WS] Client added, total connected: ${connectedClients.size}`);
        return;
      }

      // Verify the JWT token (fallback path if token was passed via data)
      const token = ws.data.token;
      if (!token) {
        ws.close(1008, "Unauthorized");
        return;
      }

      try {
        const payload = await verify(token, jwtSecret, "HS256");
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          ws.close(1008, "Token expired");
          return;
        }
      } catch {
        ws.close(1008, "Invalid token");
        return;
      }

      ws.data.authenticated = true;
      connectedClients.add(ws as ServerWebSocket<WebSocketData>);
    },

    message(
      ws: ServerWebSocket<WebSocketData>,
      message: string | Buffer
    ) {
      if (!ws.data.authenticated) {
        ws.close(1008, "Not authenticated");
        return;
      }

      const messageStr =
        typeof message === "string" ? message : message.toString();
      handleMessage(ws, messageStr);
    },

    close(ws: ServerWebSocket<WebSocketData>, code: number, reason: string) {
      console.log(`[WS] Connection closed, code=${code}, reason=${reason}`);
      connectedClients.delete(ws);
      unsubscribeFromAllPanes(ws);
    },
  };
}

/**
 * Gets the number of connected clients.
 */
export function getConnectedClientCount(): number {
  return connectedClients.size;
}

/**
 * Broadcasts a message to all connected authenticated clients.
 * Used for session state sync.
 */
export function broadcastToAll(message: ServerMessage): void {
  const messageStr = JSON.stringify(message);
  for (const client of connectedClients) {
    if (client.data.authenticated) {
      try {
        client.send(messageStr);
      } catch (err) {
        console.error("Failed to broadcast message to client:", err);
      }
    }
  }
}
