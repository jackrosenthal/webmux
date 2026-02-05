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
  try {
    const paneId = crypto.randomUUID();
    try {
      ptyManager.spawn(paneId);
      attachPtyToWebSocket(paneId);
    } catch (err) {
      console.error(`Failed to spawn PTY for pane ${paneId}:`, err);
      return c.json({ error: "Failed to spawn terminal process" }, 500);
    }
    return c.json({ paneId });
  } catch (err) {
    console.error("Failed to create pane:", err);
    return c.json({ error: "Failed to create pane" }, 500);
  }
});

/**
 * POST /api/panes/:id/split - Split a pane horizontally or vertically.
 * Creates a new pane next to the specified pane.
 * Body: { direction: "horizontal" | "vertical" }
 */
app.post("/:id/split", async (c) => {
  try {
    const paneId = c.req.param("id");

    let body: { direction?: string };
    try {
      body = await c.req.json<{ direction?: string }>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

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
    try {
      ptyManager.spawn(newPane.id);
      attachPtyToWebSocket(newPane.id);
    } catch (err) {
      console.error(`Failed to spawn PTY for split pane ${newPane.id}:`, err);
      return c.json({ error: "Failed to spawn terminal process" }, 500);
    }

    return c.json({ pane: newPane });
  } catch (err) {
    console.error("Failed to split pane:", err);
    return c.json({ error: "Failed to split pane" }, 500);
  }
});

/**
 * PATCH /api/panes/:id/resize - Update split ratios for the pane's parent split.
 * Body: { sizes: number[] } - new sizes for all children in the split
 */
app.patch("/:id/resize", async (c) => {
  try {
    const paneId = c.req.param("id");

    let body: { sizes?: unknown };
    try {
      body = await c.req.json<{ sizes?: unknown }>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    // Validate sizes
    if (!Array.isArray(body.sizes)) {
      return c.json({ error: "sizes must be an array" }, 400);
    }

    const sizes = body.sizes as number[];
    if (!sizes.every((s) => typeof s === "number" && s >= 0)) {
      return c.json({ error: "sizes must be an array of non-negative numbers" }, 400);
    }

    const updated = sessionStore.updateSplitSizes(paneId, sizes);
    if (!updated) {
      return c.json({ error: "Pane not found or not in a split" }, 404);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to resize pane:", err);
    return c.json({ error: "Failed to resize pane" }, 500);
  }
});

/**
 * DELETE /api/panes/:id - Kill a pane and its PTY.
 * Updates the layout tree, collapsing split nodes as needed.
 * If this was the last pane in a tab, deletes the tab.
 * If this was the last tab, creates a new tab with a fresh pane.
 */
app.delete("/:id", (c) => {
  try {
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
        try {
          ptyManager.spawn(newPaneId);
          attachPtyToWebSocket(newPaneId);
        } catch (err) {
          console.error(`Failed to spawn PTY for replacement pane ${newPaneId}:`, err);
          return c.json({ error: "Failed to spawn terminal process" }, 500);
        }
      } else {
        // Kill the existing PTY
        try {
          ptyManager.kill(id);
        } catch (err) {
          console.error(`Failed to kill PTY ${id}:`, err);
          // Continue with other panes even if one fails to kill
        }
      }
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to delete pane:", err);
    return c.json({ error: "Failed to delete pane" }, 500);
  }
});

export const panesRoutes = app;
