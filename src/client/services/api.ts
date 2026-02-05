/**
 * REST API client for Webmux.
 */

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
