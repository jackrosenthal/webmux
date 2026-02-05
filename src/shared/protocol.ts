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
 * All possible client-to-server messages.
 */
export type ClientMessage = ClientInputMessage | ClientResizeMessage;

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
 * All possible server-to-client messages.
 */
export type ServerMessage =
  | ServerOutputMessage
  | ServerExitMessage
  | ServerSessionSyncMessage;
