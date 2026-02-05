/**
 * Pane management API endpoints.
 * Minimal implementation for Phase 4 - will be expanded in Phase 7.
 */

import { Hono } from "hono";
import { ptyManager } from "../pty/manager.js";
import { attachPtyToWebSocket } from "../ws/terminal.js";

const app = new Hono();

/**
 * POST /api/panes - Create a new pane with a PTY.
 * Returns the new pane ID.
 */
app.post("/", (c) => {
  const paneId = crypto.randomUUID();
  ptyManager.spawn(paneId);
  attachPtyToWebSocket(paneId);
  return c.json({ paneId });
});

/**
 * DELETE /api/panes/:id - Kill a pane and its PTY.
 */
app.delete("/:id", (c) => {
  const paneId = c.req.param("id");
  const killed = ptyManager.kill(paneId);
  if (!killed) {
    return c.json({ error: "Pane not found" }, 404);
  }
  return c.json({ success: true });
});

export const panesRoutes = app;
