/**
 * Configuration API endpoints.
 * GET /api/config returns client-relevant configuration.
 * PATCH /api/config/theme updates the theme in the config file.
 */

import { Hono } from "hono";
import type { ShortcutsConfig, AppearanceConfig, TerminalConfig } from "../../shared/config.js";
import { saveTheme } from "../config/loader.js";

/**
 * Client-facing configuration (excludes sensitive server settings).
 */
export interface ClientConfig {
  shortcuts: ShortcutsConfig;
  appearance: AppearanceConfig;
  terminal: TerminalConfig;
}

/**
 * Creates config routes with the given application config.
 * @param appearance - Mutable appearance config object (will be updated on theme change)
 */
export function createConfigRoutes(
  shortcuts: ShortcutsConfig,
  appearance: AppearanceConfig,
  terminal: TerminalConfig
) {
  const app = new Hono();

  /**
   * GET /api/config - Get client-relevant configuration.
   */
  app.get("/", (c) => {
    const clientConfig: ClientConfig = {
      shortcuts,
      appearance,
      terminal,
    };
    return c.json(clientConfig);
  });

  /**
   * PATCH /api/config/theme - Update the theme in the config file.
   */
  app.patch("/theme", async (c) => {
    try {
      const body = await c.req.json<{ theme?: string }>();
      const themeName = body.theme;

      if (!themeName || typeof themeName !== "string") {
        return c.json({ error: "Missing or invalid 'theme' field" }, 400);
      }

      // Save to config file
      await saveTheme(themeName);

      // Update in-memory config so subsequent GET requests return the new value
      appearance.theme = themeName;

      return c.json({ success: true, theme: themeName });
    } catch (err) {
      console.error("Failed to save theme:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: `Failed to save theme: ${message}` }, 500);
    }
  });

  return app;
}
