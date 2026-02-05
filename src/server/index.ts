import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import path from "path";
import { loadConfig } from "./config/loader.js";
import { createAuthRoutes, generateJwtSecret } from "./auth/routes.js";
import type { WebmuxConfig } from "../shared/config.js";

const app = new Hono();

const distDir = path.resolve(import.meta.dirname, "../../dist/client");

// Load configuration
const config: WebmuxConfig = await loadConfig();

// Generate JWT secret for this server instance
const jwtSecret = generateJwtSecret();

// Mount auth routes
app.route("/auth", createAuthRoutes(config, jwtSecret));

// API routes placeholder
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Serve static files from Vite build output
app.use("/*", serveStatic({ root: distDir }));

// Fallback to index.html for SPA routing
app.get("*", serveStatic({ root: distDir, path: "index.html" }));

const port = config.server.port;

console.log(`Webmux server listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
