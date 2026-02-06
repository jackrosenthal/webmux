/**
 * REST API client for Webmux.
 */

import type { ShortcutsConfig, AppearanceConfig, TerminalConfig } from "../../shared/config";
import type { TerminalTheme } from "../../shared/theme";

/**
 * Custom error class for API errors with additional context.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly serverError?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Parses an error response body if possible.
 */
async function parseErrorBody(response: Response): Promise<string | undefined> {
  try {
    const data = await response.json();
    if (typeof data.error === "string") {
      return data.error;
    }
  } catch {
    // Ignore parse errors
  }
  return undefined;
}

interface LoginResponse {
  success?: boolean;
  error?: string;
}

interface VerifyResponse {
  authenticated: boolean;
}

/**
 * Attempt to log in with the given password.
 * On success, the server sets an HTTP-only cookie with the JWT.
 */
export async function login(password: string): Promise<LoginResponse> {
  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const serverError = await parseErrorBody(response);
      return { success: false, error: serverError ?? "Login failed" };
    }
    return response.json();
  } catch (err) {
    console.error("Login request failed:", err);
    return { success: false, error: "Network error. Please try again." };
  }
}

/**
 * Check if the current session is authenticated.
 */
export async function verifyAuth(): Promise<boolean> {
  try {
    const response = await fetch("/auth/verify");
    if (!response.ok) {
      return false;
    }
    const data: VerifyResponse = await response.json();
    return data.authenticated;
  } catch (err) {
    console.error("Auth verification failed:", err);
    return false;
  }
}

/**
 * Log out and clear the auth cookie.
 */
export async function logout(): Promise<void> {
  try {
    await fetch("/auth/logout", { method: "POST" });
  } catch (err) {
    console.error("Logout request failed:", err);
  }
}

interface CreatePaneResponse {
  paneId: string;
}

/**
 * Create a new pane with a PTY.
 * @throws {ApiError} if the request fails
 */
export async function createPane(): Promise<string> {
  try {
    const response = await fetch("/api/panes", { method: "POST" });
    if (!response.ok) {
      const serverError = await parseErrorBody(response);
      throw new ApiError(
        serverError ?? "Failed to create pane",
        response.status,
        serverError
      );
    }
    const data: CreatePaneResponse = await response.json();
    return data.paneId;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("Create pane request failed:", err);
    throw new ApiError("Network error. Failed to create pane.");
  }
}

/**
 * Result type for API operations that may fail.
 */
export interface ApiResult {
  success: boolean;
  error?: string;
}

/**
 * Set the active tab.
 */
export async function setActiveTab(tabId: string): Promise<ApiResult> {
  try {
    const response = await fetch(`/api/tabs/${tabId}/activate`, {
      method: "PATCH",
    });
    if (!response.ok) {
      const serverError = await parseErrorBody(response);
      return { success: false, error: serverError ?? "Failed to switch tab" };
    }
    return { success: true };
  } catch (err) {
    console.error("Set active tab request failed:", err);
    return { success: false, error: "Network error. Failed to switch tab." };
  }
}

/**
 * Create a new tab with a single pane.
 */
export async function createTab(): Promise<ApiResult> {
  try {
    const response = await fetch("/api/tabs", { method: "POST" });
    if (!response.ok) {
      const serverError = await parseErrorBody(response);
      return { success: false, error: serverError ?? "Failed to create tab" };
    }
    return { success: true };
  } catch (err) {
    console.error("Create tab request failed:", err);
    return { success: false, error: "Network error. Failed to create tab." };
  }
}

/**
 * Update the split sizes for a pane's parent split.
 * The sizes array must match the number of children in the split.
 */
export async function resizePane(
  paneId: string,
  sizes: number[]
): Promise<ApiResult> {
  try {
    const response = await fetch(`/api/panes/${paneId}/resize`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sizes }),
    });
    if (!response.ok) {
      const serverError = await parseErrorBody(response);
      return { success: false, error: serverError ?? "Failed to resize pane" };
    }
    return { success: true };
  } catch (err) {
    console.error("Resize pane request failed:", err);
    return { success: false, error: "Network error. Failed to resize pane." };
  }
}

/**
 * Delete a pane and its associated PTY.
 */
export async function deletePane(paneId: string): Promise<ApiResult> {
  try {
    const response = await fetch(`/api/panes/${paneId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const serverError = await parseErrorBody(response);
      return { success: false, error: serverError ?? "Failed to close pane" };
    }
    return { success: true };
  } catch (err) {
    console.error("Delete pane request failed:", err);
    return { success: false, error: "Network error. Failed to close pane." };
  }
}

/**
 * Split a pane horizontally or vertically.
 * @param paneId - The pane to split
 * @param direction - "horizontal" or "vertical"
 */
export async function splitPane(
  paneId: string,
  direction: "horizontal" | "vertical"
): Promise<ApiResult> {
  try {
    const response = await fetch(`/api/panes/${paneId}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    if (!response.ok) {
      const serverError = await parseErrorBody(response);
      return { success: false, error: serverError ?? "Failed to split pane" };
    }
    return { success: true };
  } catch (err) {
    console.error("Split pane request failed:", err);
    return { success: false, error: "Network error. Failed to split pane." };
  }
}

/**
 * Delete a tab and all its panes.
 */
export async function deleteTab(tabId: string): Promise<ApiResult> {
  try {
    const response = await fetch(`/api/tabs/${tabId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const serverError = await parseErrorBody(response);
      return { success: false, error: serverError ?? "Failed to close tab" };
    }
    return { success: true };
  } catch (err) {
    console.error("Delete tab request failed:", err);
    return { success: false, error: "Network error. Failed to close tab." };
  }
}

/**
 * Client configuration returned from /api/config.
 */
interface ClientConfig {
  shortcuts: ShortcutsConfig;
  appearance: AppearanceConfig;
  terminal: TerminalConfig;
}

/**
 * Default config to use when fetch fails.
 */
const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  shortcuts: {
    leader: "Ctrl+b",
    new_tab: "n",
    vsplit: "|",
    hsplit: "-",
    kill_pane: "x",
    copy: "Ctrl+Shift+C",
    paste: "Ctrl+Shift+V",
  },
  appearance: {
    theme: "Dracula",
    font_family: "JetBrains Mono",
    font_size: 14,
  },
  terminal: {
    scrollback_lines: 100000,
  },
};

/**
 * Fetch client configuration from the server.
 * Returns default config if fetch fails.
 */
export async function getConfig(): Promise<ClientConfig> {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) {
      console.error("Failed to fetch config:", response.status);
      return DEFAULT_CLIENT_CONFIG;
    }
    return response.json();
  } catch (err) {
    console.error("Config request failed:", err);
    return DEFAULT_CLIENT_CONFIG;
  }
}

/**
 * Fetch all available terminal themes.
 * Returns empty array if fetch fails.
 */
export async function getThemes(): Promise<TerminalTheme[]> {
  try {
    const response = await fetch("/api/themes");
    if (!response.ok) {
      console.error("Failed to fetch themes:", response.status);
      return [];
    }
    return response.json();
  } catch (err) {
    console.error("Themes request failed:", err);
    return [];
  }
}

/**
 * Update the theme in the server config file.
 * This persists the theme selection across sessions.
 */
export async function updateTheme(themeName: string): Promise<ApiResult> {
  try {
    const response = await fetch("/api/config/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: themeName }),
    });
    if (!response.ok) {
      const serverError = await parseErrorBody(response);
      return { success: false, error: serverError ?? "Failed to update theme" };
    }
    return { success: true };
  } catch (err) {
    console.error("Update theme request failed:", err);
    return { success: false, error: "Network error. Failed to update theme." };
  }
}

/**
 * Settings exposed to the client from /api/settings.
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
 * Partial settings for PATCH /api/settings requests.
 */
export interface SettingsUpdate {
  appearance?: Partial<AppearanceConfig>;
  security?: {
    current_password?: string;
    new_password?: string;
    token_validity_days?: number;
  };
  shortcuts?: Partial<ShortcutsConfig>;
  terminal?: Partial<TerminalConfig>;
}

/**
 * Fetch current settings from the server.
 */
export async function getSettings(): Promise<ClientSettings | null> {
  try {
    const response = await fetch("/api/settings");
    if (!response.ok) {
      console.error("Failed to fetch settings:", response.status);
      return null;
    }
    return response.json();
  } catch (err) {
    console.error("Settings request failed:", err);
    return null;
  }
}

/**
 * Update settings on the server.
 */
export async function updateSettings(
  updates: SettingsUpdate
): Promise<ApiResult & { settings?: ClientSettings }> {
  try {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const serverError = await parseErrorBody(response);
      return { success: false, error: serverError ?? "Failed to update settings" };
    }
    const settings = await response.json();
    return { success: true, settings };
  } catch (err) {
    console.error("Update settings request failed:", err);
    return { success: false, error: "Network error. Failed to update settings." };
  }
}
