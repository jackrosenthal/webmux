/**
 * Theme API endpoints.
 * GET /api/themes returns all available themes.
 */

import { Hono } from "hono";
import type { TerminalTheme } from "../../shared/theme.js";

/**
 * Creates theme routes with the given loaded themes.
 */
export function createThemeRoutes(themes: TerminalTheme[]) {
  const app = new Hono();

  /**
   * GET /api/themes - Get all available themes.
   */
  app.get("/", (c) => {
    return c.json(themes);
  });

  return app;
}
