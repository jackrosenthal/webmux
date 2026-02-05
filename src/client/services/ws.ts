/**
 * WebSocket client for terminal I/O.
 */

/**
 * Creates a WebSocket connection to the terminal endpoint.
 * The auth cookie is automatically sent by the browser.
 */
export function createTerminalWebSocket(): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/ws/terminal`;
  return new WebSocket(url);
}
