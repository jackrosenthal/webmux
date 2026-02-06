/**
 * Keyboard shortcut manager for Webmux.
 * Uses a leader key system (like tmux) for most shortcuts.
 * Press leader (default: Ctrl+B), then the action key.
 */

import { useEffect, useRef } from "react";
import type { ShortcutsConfig } from "../../shared/config";

/**
 * Check if a key event represents a single character (not a modifier or special key).
 * Used to determine when a compose sequence is complete.
 */
function isCharacterKey(event: KeyboardEvent): boolean {
  // Single character means it's an actual typed character, not a modifier
  return event.key.length === 1;
}

/**
 * Global flag indicating whether leader mode is currently active.
 * Used by Terminal component to pass through keys to the shortcut handler.
 */
let leaderModeActive = false;

/**
 * Returns true if leader mode is currently active.
 * Exported for use by Terminal component.
 */
export function isLeaderModeActive(): boolean {
  return leaderModeActive;
}

/**
 * Parsed representation of a keyboard shortcut.
 */
export interface ParsedShortcut {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/**
 * Parses a shortcut string like "Ctrl+b" into its components.
 * Supports modifiers: Ctrl, Shift, Alt, Meta (or Cmd on Mac).
 */
export function parseShortcut(shortcutStr: string): ParsedShortcut {
  const parts = shortcutStr.split("+").map((p) => p.trim());
  const result: ParsedShortcut = {
    key: "",
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
  };

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") {
      result.ctrl = true;
    } else if (lower === "shift") {
      result.shift = true;
    } else if (lower === "alt" || lower === "option") {
      result.alt = true;
    } else if (lower === "meta" || lower === "cmd" || lower === "command") {
      result.meta = true;
    } else {
      // The final non-modifier part is the key
      result.key = part;
    }
  }

  return result;
}

/**
 * Checks if a keyboard event matches a parsed shortcut.
 * For the key, we compare event.key directly (case-insensitive for letters).
 * Modifier states (Ctrl, Shift, Alt, Meta) must match exactly.
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ParsedShortcut
): boolean {
  const keyMatches =
    event.key === shortcut.key ||
    event.key.toLowerCase() === shortcut.key.toLowerCase();

  return (
    keyMatches &&
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt &&
    event.metaKey === shortcut.meta
  );
}

/**
 * Checks if a key event matches a simple key (no modifiers required).
 * Used for action keys after leader is pressed.
 */
function matchesKey(event: KeyboardEvent, key: string): boolean {
  // For action keys, we only care about the key itself, not modifiers
  // (except we ignore events with Ctrl/Alt/Meta to avoid conflicts)
  if (event.ctrlKey || event.altKey || event.metaKey) {
    return false;
  }
  return event.key === key || event.key.toLowerCase() === key.toLowerCase();
}

/**
 * Action handlers for each shortcut type.
 */
export interface ShortcutHandlers {
  onNewTab?: () => void;
  onVerticalSplit?: () => void;
  onHorizontalSplit?: () => void;
  onKillPane?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
}

/**
 * ShortcutManager handles leader-based shortcuts and direct shortcuts.
 *
 * Leader-based shortcuts: Press leader key, then action key within timeout.
 * Direct shortcuts: Copy/paste use direct key combinations.
 */
export class ShortcutManager {
  private leader: ParsedShortcut | null = null;
  private actionKeys: Map<string, string> = new Map();
  private directShortcuts: Map<string, ParsedShortcut> = new Map();
  private handlers: ShortcutHandlers = {};
  private leaderActive = false;

  /**
   * Initialize the manager with shortcuts config.
   */
  configure(config: ShortcutsConfig): void {
    // Parse leader key
    this.leader = parseShortcut(config.leader);

    // Action keys (used after leader)
    this.actionKeys.set("new_tab", config.new_tab);
    this.actionKeys.set("vsplit", config.vsplit);
    this.actionKeys.set("hsplit", config.hsplit);
    this.actionKeys.set("kill_pane", config.kill_pane);

    // Direct shortcuts (not leader-based)
    this.directShortcuts.set("copy", parseShortcut(config.copy));
    this.directShortcuts.set("paste", parseShortcut(config.paste));
  }

  /**
   * Set the handlers for shortcut actions.
   */
  setHandlers(handlers: ShortcutHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Cancel leader mode.
   */
  private cancelLeader(): void {
    this.leaderActive = false;
    leaderModeActive = false;
  }

  /**
   * Activate leader mode.
   */
  private activateLeader(): void {
    this.leaderActive = true;
    leaderModeActive = true;
  }

  /**
   * Handle a keydown event. Returns true if the event was handled.
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    // Check direct shortcuts first (copy/paste)
    const copy = this.directShortcuts.get("copy");
    if (copy && matchesShortcut(event, copy) && this.handlers.onCopy) {
      event.preventDefault();
      this.handlers.onCopy();
      return true;
    }

    const paste = this.directShortcuts.get("paste");
    if (paste && matchesShortcut(event, paste) && this.handlers.onPaste) {
      event.preventDefault();
      this.handlers.onPaste();
      return true;
    }

    // If leader mode is active, check for action keys
    if (this.leaderActive) {
      // Only process character keys (single char), not modifiers or special keys
      // This allows compose sequences (e.g., AltGr+key) to complete
      if (!isCharacterKey(event)) {
        return false;
      }

      const newTabKey = this.actionKeys.get("new_tab");
      if (newTabKey && matchesKey(event, newTabKey) && this.handlers.onNewTab) {
        event.preventDefault();
        this.cancelLeader();
        this.handlers.onNewTab();
        return true;
      }

      const vsplitKey = this.actionKeys.get("vsplit");
      if (vsplitKey && matchesKey(event, vsplitKey) && this.handlers.onVerticalSplit) {
        event.preventDefault();
        this.cancelLeader();
        this.handlers.onVerticalSplit();
        return true;
      }

      const hsplitKey = this.actionKeys.get("hsplit");
      if (hsplitKey && matchesKey(event, hsplitKey) && this.handlers.onHorizontalSplit) {
        event.preventDefault();
        this.cancelLeader();
        this.handlers.onHorizontalSplit();
        return true;
      }

      const killPaneKey = this.actionKeys.get("kill_pane");
      if (killPaneKey && matchesKey(event, killPaneKey) && this.handlers.onKillPane) {
        event.preventDefault();
        this.cancelLeader();
        this.handlers.onKillPane();
        return true;
      }

      // Non-matching character key cancels leader mode
      this.cancelLeader();
      return false;
    }

    // Check for leader key
    if (this.leader && matchesShortcut(event, this.leader)) {
      event.preventDefault();
      this.activateLeader();
      return true;
    }

    return false;
  }

  /**
   * Clean up timeouts.
   */
  dispose(): void {
    this.cancelLeader();
  }
}

/**
 * Hook that registers global keyboard shortcuts using leader key system.
 */
export function useShortcuts(
  config: ShortcutsConfig | undefined,
  handlers: ShortcutHandlers
): void {
  const managerRef = useRef<ShortcutManager | null>(null);

  // Create manager once
  if (!managerRef.current) {
    managerRef.current = new ShortcutManager();
  }

  // Update configuration when it changes
  useEffect(() => {
    if (config && managerRef.current) {
      managerRef.current.configure(config);
    }
  }, [config]);

  // Update handlers when they change
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setHandlers(handlers);
    }
  }, [handlers]);

  // Register global keydown listener
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !config) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      manager.handleKeyDown(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      manager.dispose();
    };
  }, [config]);
}
