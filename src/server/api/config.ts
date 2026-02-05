/**
 * Configuration API endpoints.
 * GET /api/config returns client-relevant configuration.
 */

import { Hono } from "hono";
import type { ShortcutsConfig } from "../../shared/config.js";

/**
 * Client-facing configuration (excludes sensitive server settings).
 */
export interface ClientConfig {
  shortcuts: ShortcutsConfig;
}

/**
 * Creates config routes with the given application config.
 */
export function createConfigRoutes(shortcuts: ShortcutsConfig) {
  const app = new Hono();

  /**
   * GET /api/config - Get client-relevant configuration.
   */
  app.get("/", (c) => {
    const clientConfig: ClientConfig = {
      shortcuts,
    };
    return c.json(clientConfig);
  });

  return app;
}
