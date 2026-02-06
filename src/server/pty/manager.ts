import * as fs from "fs";
import * as os from "os";
import type { Subprocess, Terminal } from "bun";

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

/**
 * Wrapper around Bun's Terminal API for PTY management.
 */
export interface BunPty {
  pid: number;
  proc: Subprocess;
  terminal: Terminal;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(callback: (data: string) => void): void;
  onExit(callback: (info: { exitCode: number; signal?: number }) => void): void;
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
 * Manages PTY instances using Bun's Terminal API, tracking them by pane ID.
 * Also maintains a scrollback buffer for each pane for replay on reconnect.
 */
export class PtyManager {
  private ptys: Map<string, BunPty> = new Map();
  private scrollbackBuffers: Map<string, ScrollbackBuffer> = new Map();

  /**
   * Spawns a new PTY for the given pane ID.
   * Returns the PTY instance.
   */
  spawn(paneId: string, cols: number = 80, rows: number = 24): BunPty {
    const shell = getUserShell();
    const home = os.homedir();
    console.log(`[PTY] Spawning shell: ${shell} in ${home} for pane ${paneId} (${cols}x${rows})`);

    // Spawn as interactive login shell
    const shellArgs: string[] = [];
    if (shell.endsWith("bash") || shell.endsWith("zsh")) {
      shellArgs.push("-i", "-l");
    }

    // Callbacks to be set later via onData/onExit
    let dataCallback: ((data: string) => void) | null = null;
    let exitCallback: ((info: { exitCode: number; signal?: number }) => void) | null = null;

    // Ensure proper terminal environment
    const env = {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    } as Record<string, string>;

    const proc = Bun.spawn([shell, ...shellArgs], {
      cwd: home,
      env,
      terminal: {
        cols,
        rows,
        data(_terminal, data) {
          const str = typeof data === "string" ? data : data.toString();
          if (dataCallback) {
            dataCallback(str);
          }
        },
      },
    });

    console.log(`[PTY] Shell spawned with pid ${proc.pid} for pane ${paneId}`);

    // Handle exit
    proc.exited.then((exitCode) => {
      if (exitCallback) {
        exitCallback({ exitCode });
      }
    });

    const bunPty: BunPty = {
      pid: proc.pid,
      proc,
      terminal: proc.terminal!,
      write(data: string) {
        proc.terminal?.write(data);
      },
      resize(newCols: number, newRows: number) {
        proc.terminal?.resize(newCols, newRows);
      },
      kill() {
        proc.terminal?.close();
        proc.kill();
      },
      onData(callback: (data: string) => void) {
        dataCallback = callback;
      },
      onExit(callback: (info: { exitCode: number; signal?: number }) => void) {
        exitCallback = callback;
      },
    };

    this.ptys.set(paneId, bunPty);
    this.scrollbackBuffers.set(paneId, new ScrollbackBuffer());
    return bunPty;
  }

  /**
   * Gets the PTY instance for the given pane ID, or undefined if not found.
   */
  get(paneId: string): BunPty | undefined {
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
