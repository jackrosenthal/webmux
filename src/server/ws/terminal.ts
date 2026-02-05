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
    client.send(messageStr);
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
    return;
  }

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
  }
}

/**
 * Sets up PTY output listeners to forward data to WebSocket clients.
 * Call this when a PTY is spawned to wire up the output.
 * Also parses OSC escape sequences to extract and update pane titles.
 */
export function attachPtyToWebSocket(paneId: string): void {
  const pty = ptyManager.get(paneId);
  if (!pty) return;

  const oscParser = new OscTitleParser();

  pty.onData((data: string) => {
    // Parse OSC escape sequences for title changes
    const title = oscParser.process(data);
    if (title !== null) {
      sessionStore.setPaneTitle(paneId, title);
    }

    broadcastToPane(paneId, {
      type: "output",
      paneId,
      data,
    });
  });

  pty.onExit(({ exitCode }: { exitCode: number }) => {
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
      // Verify the JWT token
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

    close(ws: ServerWebSocket<WebSocketData>) {
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
      client.send(messageStr);
    }
  }
}
