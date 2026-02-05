/**
 * Session API endpoints.
 * GET /api/session returns the current session state, initializing if needed.
 */

import { Hono } from "hono";
import { sessionStore } from "../session/store.js";
import { ptyManager } from "../pty/manager.js";
import { attachPtyToWebSocket } from "../ws/terminal.js";

const app = new Hono();

/**
 * GET /api/session - Get current session state.
 * Initializes a new session with a single tab/pane on first connect.
 */
app.get("/", (c) => {
  try {
    const { state, newPaneId } = sessionStore.getState();

    // If a new session was created, spawn a PTY for the initial pane
    if (newPaneId) {
      try {
        ptyManager.spawn(newPaneId);
        attachPtyToWebSocket(newPaneId);
      } catch (err) {
        console.error(`Failed to spawn PTY for initial pane ${newPaneId}:`, err);
        return c.json(
          { error: "Failed to spawn terminal process" },
          500
        );
      }
    }

    return c.json(state);
  } catch (err) {
    console.error("Failed to get session state:", err);
    return c.json({ error: "Failed to get session state" }, 500);
  }
});

export const sessionRoutes = app;
