/**
 * REST API client for Webmux.
 */

import type { ShortcutsConfig, AppearanceConfig, TerminalConfig } from "../../shared/config";
import type { TerminalTheme } from "../../shared/theme";

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
  const response = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return response.json();
}

/**
 * Check if the current session is authenticated.
 */
export async function verifyAuth(): Promise<boolean> {
  const response = await fetch("/auth/verify");
  if (!response.ok) {
    return false;
  }
  const data: VerifyResponse = await response.json();
  return data.authenticated;
}

/**
 * Log out and clear the auth cookie.
 */
export async function logout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST" });
}

interface CreatePaneResponse {
  paneId: string;
}

/**
 * Create a new pane with a PTY.
 */
export async function createPane(): Promise<string> {
  const response = await fetch("/api/panes", { method: "POST" });
  const data: CreatePaneResponse = await response.json();
  return data.paneId;
}

/**
 * Set the active tab.
 */
export async function setActiveTab(tabId: string): Promise<boolean> {
  const response = await fetch(`/api/tabs/${tabId}/activate`, {
    method: "PATCH",
  });
  return response.ok;
}

/**
 * Create a new tab with a single pane.
 */
export async function createTab(): Promise<boolean> {
  const response = await fetch("/api/tabs", { method: "POST" });
  return response.ok;
}

/**
 * Update the split sizes for a pane's parent split.
 * The sizes array must match the number of children in the split.
 */
export async function resizePane(
  paneId: string,
  sizes: number[]
): Promise<boolean> {
  const response = await fetch(`/api/panes/${paneId}/resize`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sizes }),
  });
  return response.ok;
}

/**
 * Delete a pane and its associated PTY.
 */
export async function deletePane(paneId: string): Promise<boolean> {
  const response = await fetch(`/api/panes/${paneId}`, {
    method: "DELETE",
  });
  return response.ok;
}

/**
 * Split a pane horizontally or vertically.
 * @param paneId - The pane to split
 * @param direction - "horizontal" or "vertical"
 */
export async function splitPane(
  paneId: string,
  direction: "horizontal" | "vertical"
): Promise<boolean> {
  const response = await fetch(`/api/panes/${paneId}/split`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction }),
  });
  return response.ok;
}

/**
 * Delete a tab and all its panes.
 */
export async function deleteTab(tabId: string): Promise<boolean> {
  const response = await fetch(`/api/tabs/${tabId}`, {
    method: "DELETE",
  });
  return response.ok;
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
 * Fetch client configuration from the server.
 */
export async function getConfig(): Promise<ClientConfig> {
  const response = await fetch("/api/config");
  return response.json();
}

/**
 * Fetch all available terminal themes.
 */
export async function getThemes(): Promise<TerminalTheme[]> {
  const response = await fetch("/api/themes");
  return response.json();
}
