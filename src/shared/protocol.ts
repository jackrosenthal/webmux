/**
 * WebSocket message protocol definitions for terminal I/O.
 * All messages are JSON-encoded with a type discriminator.
 */

/**
 * Message from client to server: terminal input data.
 */
export interface ClientInputMessage {
  type: "input";
  paneId: string;
  data: string;
}

/**
 * Message from client to server: resize terminal.
 */
export interface ClientResizeMessage {
  type: "resize";
  paneId: string;
  cols: number;
  rows: number;
}

/**
 * Message from client to server: focus changed.
 * Informs the backend which pane this client is currently focused on.
 */
export interface ClientFocusMessage {
  type: "focus";
  paneId: string;
}

/**
 * Message from client to server: subscribe to pane output.
 * Requests to receive terminal output for a pane.
 * The server will replay any buffered scrollback before sending live output.
 */
export interface ClientSubscribeMessage {
  type: "subscribe";
  paneId: string;
}

/**
 * Message from client to server: unsubscribe from pane output.
 * Sent when a terminal component unmounts (e.g., tab switch).
 */
export interface ClientUnsubscribeMessage {
  type: "unsubscribe";
  paneId: string;
}

/**
 * All possible client-to-server messages.
 */
export type ClientMessage =
  | ClientInputMessage
  | ClientResizeMessage
  | ClientFocusMessage
  | ClientSubscribeMessage
  | ClientUnsubscribeMessage;

/**
 * Message from server to client: terminal output data.
 */
export interface ServerOutputMessage {
  type: "output";
  paneId: string;
  data: string;
}

/**
 * Message from server to client: pane exited.
 */
export interface ServerExitMessage {
  type: "exit";
  paneId: string;
  exitCode: number;
}

/**
 * Message from server to client: session state sync.
 * Sent when the session state changes (tab/pane added, deleted, etc.).
 */
export interface ServerSessionSyncMessage {
  type: "sessionSync";
  state: import("./types").SessionState;
}

/**
 * Message from server to client: error notification.
 * Sent when an error occurs processing a client message.
 */
export interface ServerErrorMessage {
  type: "error";
  error: string;
}

/**
 * Settings exposed to the client (same as ClientSettings in api/settings.ts).
 */
export interface ClientSettingsData {
  appearance: import("./config").AppearanceConfig;
  security: {
    token_validity_days: number;
    has_password: boolean;
  };
  shortcuts: import("./config").ShortcutsConfig;
  terminal: import("./config").TerminalConfig;
}

/**
 * Message from server to client: settings sync.
 * Sent when settings are updated to broadcast to all connected clients.
 */
export interface ServerSettingsSyncMessage {
  type: "settingsSync";
  settings: ClientSettingsData;
}

/**
 * All possible server-to-client messages.
 */
export type ServerMessage =
  | ServerOutputMessage
  | ServerExitMessage
  | ServerSessionSyncMessage
  | ServerErrorMessage
  | ServerSettingsSyncMessage;
