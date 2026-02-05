/**
 * Pane management API endpoints.
 */

import { Hono } from "hono";
import { ptyManager } from "../pty/manager.js";
import { attachPtyToWebSocket } from "../ws/terminal.js";
import { sessionStore } from "../session/store.js";
import type { SplitDirection } from "../../shared/types.js";

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
 * POST /api/panes/:id/split - Split a pane horizontally or vertically.
 * Creates a new pane next to the specified pane.
 * Body: { direction: "horizontal" | "vertical" }
 */
app.post("/:id/split", async (c) => {
  const paneId = c.req.param("id");
  const body = await c.req.json<{ direction?: string }>();

  // Validate direction
  const direction = body.direction;
  if (direction !== "horizontal" && direction !== "vertical") {
    return c.json({ error: "Invalid direction. Must be 'horizontal' or 'vertical'." }, 400);
  }

  // Split the pane in the session store
  const newPane = sessionStore.splitPane(paneId, direction as SplitDirection);
  if (!newPane) {
    return c.json({ error: "Pane not found" }, 404);
  }

  // Spawn PTY for the new pane
  ptyManager.spawn(newPane.id);
  attachPtyToWebSocket(newPane.id);

  return c.json({ pane: newPane });
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
