/**
 * Settings API endpoints.
 * GET /api/settings returns current settings (appearance, security, shortcuts, terminal).
 * PATCH /api/settings accepts partial updates and writes to config.toml.
 */

import { Hono } from "hono";
import type {
  ShortcutsConfig,
  AppearanceConfig,
  TerminalConfig,
  AuthConfig,
} from "../../shared/config.js";
import { saveSettings } from "../config/loader.js";

/**
 * Settings exposed to the client.
 * Note: password is not exposed, only whether a password is set.
 */
export interface ClientSettings {
  appearance: AppearanceConfig;
  security: {
    token_validity_days: number;
    has_password: boolean;
  };
  shortcuts: ShortcutsConfig;
  terminal: TerminalConfig;
}

/**
 * Partial settings for PATCH requests.
 */
export interface SettingsUpdate {
  appearance?: Partial<AppearanceConfig>;
  security?: {
    password?: string;
    token_validity_days?: number;
  };
  shortcuts?: Partial<ShortcutsConfig>;
  terminal?: Partial<TerminalConfig>;
}

/**
 * Creates settings routes with the given application config.
 * Config objects are mutable and will be updated on PATCH requests.
 */
export function createSettingsRoutes(
  appearance: AppearanceConfig,
  auth: AuthConfig,
  shortcuts: ShortcutsConfig,
  terminal: TerminalConfig
) {
  const app = new Hono();

  /**
   * GET /api/settings - Get current settings.
   */
  app.get("/", (c) => {
    const settings: ClientSettings = {
      appearance,
      security: {
        token_validity_days: auth.token_validity_days,
        has_password: !!auth.password,
      },
      shortcuts,
      terminal,
    };
    return c.json(settings);
  });

  /**
   * PATCH /api/settings - Update settings (partial).
   * Writes changes to config.toml and updates in-memory config.
   */
  app.patch("/", async (c) => {
    try {
      const updates = await c.req.json<SettingsUpdate>();

      // Validate and apply appearance updates
      if (updates.appearance) {
        if (updates.appearance.theme !== undefined) {
          if (typeof updates.appearance.theme !== "string") {
            return c.json({ error: "appearance.theme must be a string" }, 400);
          }
          appearance.theme = updates.appearance.theme;
        }
        if (updates.appearance.font_family !== undefined) {
          if (typeof updates.appearance.font_family !== "string") {
            return c.json({ error: "appearance.font_family must be a string" }, 400);
          }
          appearance.font_family = updates.appearance.font_family;
        }
        if (updates.appearance.font_size !== undefined) {
          const fontSize = updates.appearance.font_size;
          if (typeof fontSize !== "number" || fontSize < 8 || fontSize > 32) {
            return c.json(
              { error: "appearance.font_size must be a number between 8 and 32" },
              400
            );
          }
          appearance.font_size = fontSize;
        }
      }

      // Validate and apply security updates
      if (updates.security) {
        if (updates.security.token_validity_days !== undefined) {
          const days = updates.security.token_validity_days;
          if (typeof days !== "number" || days < 1) {
            return c.json(
              { error: "security.token_validity_days must be a positive number" },
              400
            );
          }
          auth.token_validity_days = days;
        }
        if (updates.security.password !== undefined) {
          if (typeof updates.security.password !== "string" || !updates.security.password) {
            return c.json({ error: "security.password must be a non-empty string" }, 400);
          }
          auth.password = updates.security.password;
        }
      }

      // Validate and apply shortcuts updates
      if (updates.shortcuts) {
        const shortcutKeys: (keyof ShortcutsConfig)[] = [
          "leader",
          "new_tab",
          "vsplit",
          "hsplit",
          "kill_pane",
          "copy",
          "paste",
        ];
        for (const key of shortcutKeys) {
          if (updates.shortcuts[key] !== undefined) {
            if (typeof updates.shortcuts[key] !== "string") {
              return c.json({ error: `shortcuts.${key} must be a string` }, 400);
            }
            shortcuts[key] = updates.shortcuts[key] as string;
          }
        }
      }

      // Validate and apply terminal updates
      if (updates.terminal) {
        if (updates.terminal.scrollback_lines !== undefined) {
          const lines = updates.terminal.scrollback_lines;
          if (typeof lines !== "number" || lines < 0) {
            return c.json(
              { error: "terminal.scrollback_lines must be a non-negative number" },
              400
            );
          }
          terminal.scrollback_lines = lines;
        }
      }

      // Save all settings to config file
      await saveSettings({
        appearance,
        auth: {
          token_validity_days: auth.token_validity_days,
          // Only include password if it was updated
          ...(updates.security?.password ? { password: auth.password } : {}),
        },
        shortcuts,
        terminal,
      });

      // Return updated settings
      const settings: ClientSettings = {
        appearance,
        security: {
          token_validity_days: auth.token_validity_days,
          has_password: !!auth.password,
        },
        shortcuts,
        terminal,
      };
      return c.json(settings);
    } catch (err) {
      console.error("Failed to update settings:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: `Failed to update settings: ${message}` }, 500);
    }
  });

  return app;
}
