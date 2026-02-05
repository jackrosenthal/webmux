import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import path from "path";

const app = new Hono();

const distDir = path.resolve(import.meta.dirname, "../../dist/client");

// API routes placeholder
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Serve static files from Vite build output
app.use("/*", serveStatic({ root: distDir }));

// Fallback to index.html for SPA routing
app.get("*", serveStatic({ root: distDir, path: "index.html" }));

const port = parseInt(process.env.WEBMUX_PORT ?? "8002", 10);

console.log(`Webmux server listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
