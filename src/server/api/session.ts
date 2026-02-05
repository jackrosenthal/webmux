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
  const { state, newPaneId } = sessionStore.getState();

  // If a new session was created, spawn a PTY for the initial pane
  if (newPaneId) {
    ptyManager.spawn(newPaneId);
    attachPtyToWebSocket(newPaneId);
  }

  return c.json(state);
});

export const sessionRoutes = app;
