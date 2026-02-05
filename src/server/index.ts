import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import path from "path";
import type { Server } from "bun";
import type { WebSocketData } from "./ws/terminal.js";
import { loadConfig } from "./config/loader.js";
import { createAuthRoutes, generateJwtSecret } from "./auth/routes.js";
import { createAuthMiddleware } from "./auth/middleware.js";
import {
  createWebSocketHandlers,
  authenticateWebSocket,
} from "./ws/terminal.js";
import type { WebmuxConfig } from "../shared/config.js";
import { panesRoutes } from "./api/panes.js";
import { sessionRoutes } from "./api/session.js";

const app = new Hono();

const distDir = path.resolve(import.meta.dirname, "../../dist/client");

// Load configuration
const config: WebmuxConfig = await loadConfig();

// Generate JWT secret for this server instance
const jwtSecret = generateJwtSecret();

// Create auth middleware for protected routes
const authMiddleware = createAuthMiddleware(jwtSecret);

// Mount auth routes
app.route("/auth", createAuthRoutes(config, jwtSecret));

// Protect /api/* routes with auth middleware
// Note: /ws/* is handled separately via WebSocket upgrade
app.use("/api/*", authMiddleware);

// API routes
app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/session", sessionRoutes);
app.route("/api/panes", panesRoutes);

// Serve static files from Vite build output
app.use("/*", serveStatic({ root: distDir }));

// Fallback to index.html for SPA routing
app.get("*", serveStatic({ root: distDir, path: "index.html" }));

const port = config.server.port;

console.log(`Webmux server listening on http://localhost:${port}`);

// Create WebSocket handlers
const wsHandlers = createWebSocketHandlers(jwtSecret);

export default {
  port,
  async fetch(req: Request, server: Server<WebSocketData>): Promise<Response> {
    const url = new URL(req.url);

    // Handle WebSocket upgrade for /ws/terminal
    if (url.pathname === "/ws/terminal") {
      const authenticated = await authenticateWebSocket(req, jwtSecret);
      if (!authenticated) {
        return new Response("Unauthorized", { status: 401 });
      }

      const upgraded = server.upgrade(req, {
        data: { authenticated: true },
      });

      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 500 });
      }

      // Return undefined is not valid, but Bun expects no response for upgrades
      // The upgrade was successful, Bun handles it from here
      return undefined as unknown as Response;
    }

    // Handle all other requests with Hono
    return app.fetch(req, { server });
  },
  websocket: wsHandlers,
};
