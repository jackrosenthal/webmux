/**
 * Tab management API endpoints.
 * POST /api/tabs creates a new tab with a single pane.
 * DELETE /api/tabs/:id closes a tab and kills its PTYs.
 */

import { Hono } from "hono";
import { sessionStore } from "../session/store.js";
import { ptyManager } from "../pty/manager.js";
import { attachPtyToWebSocket } from "../ws/terminal.js";

const app = new Hono();

/**
 * POST /api/tabs - Create a new tab with a single pane.
 * Spawns a PTY for the new pane.
 * Returns the new tab and pane info.
 */
app.post("/", (c) => {
  try {
    const result = sessionStore.createTab();
    if (!result) {
      return c.json({ error: "Session not initialized" }, 500);
    }

    const { tab, pane } = result;

    // Spawn PTY for the new pane
    try {
      ptyManager.spawn(pane.id);
      attachPtyToWebSocket(pane.id);
    } catch (err) {
      console.error(`Failed to spawn PTY for new tab pane ${pane.id}:`, err);
      return c.json({ error: "Failed to spawn terminal process" }, 500);
    }

    return c.json({ tab, pane });
  } catch (err) {
    console.error("Failed to create tab:", err);
    return c.json({ error: "Failed to create tab" }, 500);
  }
});

/**
 * PATCH /api/tabs/:id/activate - Set the active tab.
 * Updates the session to focus this tab and its first pane.
 */
app.patch("/:id/activate", (c) => {
  const tabId = c.req.param("id");
  const success = sessionStore.setActiveTab(tabId);

  if (!success) {
    return c.json({ error: "Tab not found" }, 404);
  }

  return c.json({ success: true });
});

/**
 * DELETE /api/tabs/:id - Close a tab.
 * Kills all PTYs in the tab.
 * If this was the last tab, creates a new empty tab.
 */
app.delete("/:id", (c) => {
  try {
    const tabId = c.req.param("id");
    const paneIds = sessionStore.deleteTab(tabId);

    if (paneIds.length === 0) {
      return c.json({ error: "Tab not found" }, 404);
    }

    // Process pane IDs: kill existing PTYs, spawn for new panes (prefixed with +)
    for (const paneId of paneIds) {
      if (paneId.startsWith("+")) {
        // New pane created because this was the last tab
        const newPaneId = paneId.slice(1);
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
          ptyManager.kill(paneId);
        } catch (err) {
          console.error(`Failed to kill PTY ${paneId}:`, err);
          // Continue with other panes even if one fails to kill
        }
      }
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to delete tab:", err);
    return c.json({ error: "Failed to delete tab" }, 500);
  }
});

export const tabsRoutes = app;
