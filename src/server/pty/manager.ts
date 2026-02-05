import * as nodePty from "node-pty";
import * as fs from "fs";
import * as os from "os";

/**
 * Maximum size of the scrollback buffer per pane in bytes.
 * This limits memory usage while still providing reasonable replay capability.
 */
const SCROLLBACK_BUFFER_SIZE = 1024 * 1024; // 1MB per pane

/**
 * Detects the user's login shell from /etc/passwd.
 * Falls back to /bin/sh if the user's entry cannot be found.
 */
export function getUserShell(): string {
  const username = os.userInfo().username;
  try {
    const passwdContent = fs.readFileSync("/etc/passwd", "utf-8");
    for (const line of passwdContent.split("\n")) {
      const fields = line.split(":");
      if (fields[0] === username && fields.length >= 7) {
        const shell = fields[6];
        if (shell) {
          return shell;
        }
      }
    }
  } catch {
    // Fall through to default
  }
  return "/bin/sh";
}

export interface PtyInstance {
  pty: nodePty.IPty;
  paneId: string;
}

/**
 * Ring buffer for storing recent terminal output.
 * When full, new data overwrites the oldest data.
 */
class ScrollbackBuffer {
  private buffer: string[] = [];
  private totalSize = 0;
  private readonly maxSize: number;

  constructor(maxSize: number = SCROLLBACK_BUFFER_SIZE) {
    this.maxSize = maxSize;
  }

  /**
   * Appends data to the buffer, discarding oldest entries if necessary.
   */
  append(data: string): void {
    const dataSize = data.length;

    // If single chunk exceeds max size, truncate from beginning
    if (dataSize > this.maxSize) {
      this.buffer = [data.slice(-this.maxSize)];
      this.totalSize = this.maxSize;
      return;
    }

    this.buffer.push(data);
    this.totalSize += dataSize;

    // Remove oldest entries until we're under the limit
    while (this.totalSize > this.maxSize && this.buffer.length > 0) {
      const removed = this.buffer.shift()!;
      this.totalSize -= removed.length;
    }
  }

  /**
   * Returns all buffered data as a single string.
   */
  getContents(): string {
    return this.buffer.join("");
  }

  /**
   * Clears the buffer.
   */
  clear(): void {
    this.buffer = [];
    this.totalSize = 0;
  }
}

/**
 * Manages PTY instances, tracking them by pane ID.
 * Also maintains a scrollback buffer for each pane for replay on reconnect.
 */
export class PtyManager {
  private ptys: Map<string, nodePty.IPty> = new Map();
  private scrollbackBuffers: Map<string, ScrollbackBuffer> = new Map();

  /**
   * Spawns a new PTY for the given pane ID.
   * Returns the PTY instance.
   */
  spawn(paneId: string, cols: number = 80, rows: number = 24): nodePty.IPty {
    const shell = getUserShell();
    const pty = nodePty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: os.homedir(),
      env: process.env as Record<string, string>,
    });
    this.ptys.set(paneId, pty);
    this.scrollbackBuffers.set(paneId, new ScrollbackBuffer());
    return pty;
  }

  /**
   * Gets the PTY instance for the given pane ID, or undefined if not found.
   */
  get(paneId: string): nodePty.IPty | undefined {
    return this.ptys.get(paneId);
  }

  /**
   * Appends data to the scrollback buffer for a pane.
   */
  appendToScrollback(paneId: string, data: string): void {
    const buffer = this.scrollbackBuffers.get(paneId);
    if (buffer) {
      buffer.append(data);
    }
  }

  /**
   * Gets the scrollback buffer contents for a pane.
   * Returns empty string if no buffer exists.
   */
  getScrollback(paneId: string): string {
    const buffer = this.scrollbackBuffers.get(paneId);
    return buffer ? buffer.getContents() : "";
  }

  /**
   * Kills and removes the PTY for the given pane ID.
   * Returns true if a PTY was found and killed, false otherwise.
   */
  kill(paneId: string): boolean {
    const pty = this.ptys.get(paneId);
    if (pty) {
      pty.kill();
      this.ptys.delete(paneId);
      this.scrollbackBuffers.delete(paneId);
      return true;
    }
    return false;
  }

  /**
   * Resizes the PTY for the given pane ID.
   * Returns true if the PTY was found and resized, false otherwise.
   */
  resize(paneId: string, cols: number, rows: number): boolean {
    const pty = this.ptys.get(paneId);
    if (pty) {
      pty.resize(cols, rows);
      return true;
    }
    return false;
  }

  /**
   * Returns all active pane IDs.
   */
  getAllPaneIds(): string[] {
    return Array.from(this.ptys.keys());
  }

  /**
   * Kills all PTYs and clears the manager.
   */
  killAll(): void {
    for (const pty of this.ptys.values()) {
      pty.kill();
    }
    this.ptys.clear();
    this.scrollbackBuffers.clear();
  }
}

// Singleton instance for the application
export const ptyManager = new PtyManager();
