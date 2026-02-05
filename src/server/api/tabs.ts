/**
 * Tab management API endpoints.
 * POST /api/tabs creates a new tab with a single pane.
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

export const tabsRoutes = app;
