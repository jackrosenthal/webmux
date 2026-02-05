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
  const result = sessionStore.createTab();
  if (!result) {
    return c.json({ error: "Session not initialized" }, 500);
  }

  const { tab, pane } = result;

  // Spawn PTY for the new pane
  ptyManager.spawn(pane.id);
  attachPtyToWebSocket(pane.id);

  return c.json({ tab, pane });
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
      ptyManager.spawn(newPaneId);
      attachPtyToWebSocket(newPaneId);
    } else {
      // Kill the existing PTY
      ptyManager.kill(paneId);
    }
  }

  return c.json({ success: true });
});

export const tabsRoutes = app;
