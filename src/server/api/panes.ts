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
 * Updates the layout tree, collapsing split nodes as needed.
 * If this was the last pane in a tab, deletes the tab.
 * If this was the last tab, creates a new tab with a fresh pane.
 */
app.delete("/:id", (c) => {
  const paneId = c.req.param("id");
  const paneIds = sessionStore.deletePane(paneId);

  if (paneIds.length === 0) {
    return c.json({ error: "Pane not found" }, 404);
  }

  // Process pane IDs: kill existing PTYs, spawn for new panes (prefixed with +)
  for (const id of paneIds) {
    if (id.startsWith("+")) {
      // New pane created because this was the last pane in the last tab
      const newPaneId = id.slice(1);
      ptyManager.spawn(newPaneId);
      attachPtyToWebSocket(newPaneId);
    } else {
      // Kill the existing PTY
      ptyManager.kill(id);
    }
  }

  return c.json({ success: true });
});

export const panesRoutes = app;
