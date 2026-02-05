/**
 * Keyboard shortcut manager for Webmux.
 * Parses shortcut config format (e.g., "Ctrl+Shift+T") and registers
 * global keydown handlers.
 */

import { useEffect, useRef } from "react";
import type { ShortcutsConfig } from "../../shared/config";

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
 * Parses a shortcut string like "Ctrl+Shift+T" into its components.
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
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ParsedShortcut
): boolean {
  // Normalize the event key for comparison
  let eventKey = event.key;

  // Handle special cases where the key differs based on shift state
  // For example, Shift+| produces "|" as the key
  if (shortcut.key.length === 1) {
    // For single-character shortcuts, compare case-insensitively
    // unless it's a symbol that requires shift
    const shortcutLower = shortcut.key.toLowerCase();
    const eventKeyLower = eventKey.toLowerCase();

    // Special handling for shifted symbols
    if (shortcut.key === "|" && eventKey === "|") {
      eventKey = "|";
    } else if (shortcut.key === "-" && eventKey === "-") {
      eventKey = "-";
    } else if (shortcutLower === eventKeyLower) {
      eventKey = shortcut.key;
    }
  }

  const keyMatches =
    eventKey === shortcut.key ||
    eventKey.toLowerCase() === shortcut.key.toLowerCase();

  return (
    keyMatches &&
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt &&
    event.metaKey === shortcut.meta
  );
}

/**
 * Action handlers for each shortcut type.
 */
export interface ShortcutHandlers {
  onNewTab?: () => void;
  onCloseTab?: () => void;
  onVerticalSplit?: () => void;
  onHorizontalSplit?: () => void;
  onKillPane?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
}

/**
 * ShortcutManager handles parsing shortcuts and dispatching actions.
 */
export class ShortcutManager {
  private shortcuts: Map<string, ParsedShortcut> = new Map();
  private handlers: ShortcutHandlers = {};

  /**
   * Initialize the manager with shortcuts config.
   */
  configure(config: ShortcutsConfig): void {
    this.shortcuts.set("new_tab", parseShortcut(config.new_tab));
    this.shortcuts.set("close_tab", parseShortcut(config.close_tab));
    this.shortcuts.set("vsplit", parseShortcut(config.vsplit));
    this.shortcuts.set("hsplit", parseShortcut(config.hsplit));
    this.shortcuts.set("kill_pane", parseShortcut(config.kill_pane));
    this.shortcuts.set("copy", parseShortcut(config.copy));
    this.shortcuts.set("paste", parseShortcut(config.paste));
  }

  /**
   * Set the handlers for shortcut actions.
   */
  setHandlers(handlers: ShortcutHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Handle a keydown event. Returns true if the event was handled.
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    const newTab = this.shortcuts.get("new_tab");
    if (newTab && matchesShortcut(event, newTab) && this.handlers.onNewTab) {
      event.preventDefault();
      this.handlers.onNewTab();
      return true;
    }

    const closeTab = this.shortcuts.get("close_tab");
    if (
      closeTab &&
      matchesShortcut(event, closeTab) &&
      this.handlers.onCloseTab
    ) {
      event.preventDefault();
      this.handlers.onCloseTab();
      return true;
    }

    const vsplit = this.shortcuts.get("vsplit");
    if (
      vsplit &&
      matchesShortcut(event, vsplit) &&
      this.handlers.onVerticalSplit
    ) {
      event.preventDefault();
      this.handlers.onVerticalSplit();
      return true;
    }

    const hsplit = this.shortcuts.get("hsplit");
    if (
      hsplit &&
      matchesShortcut(event, hsplit) &&
      this.handlers.onHorizontalSplit
    ) {
      event.preventDefault();
      this.handlers.onHorizontalSplit();
      return true;
    }

    const killPane = this.shortcuts.get("kill_pane");
    if (
      killPane &&
      matchesShortcut(event, killPane) &&
      this.handlers.onKillPane
    ) {
      event.preventDefault();
      this.handlers.onKillPane();
      return true;
    }

    const copy = this.shortcuts.get("copy");
    if (copy && matchesShortcut(event, copy) && this.handlers.onCopy) {
      event.preventDefault();
      this.handlers.onCopy();
      return true;
    }

    const paste = this.shortcuts.get("paste");
    if (paste && matchesShortcut(event, paste) && this.handlers.onPaste) {
      event.preventDefault();
      this.handlers.onPaste();
      return true;
    }

    return false;
  }
}

/**
 * Hook that registers global keyboard shortcuts.
 * The shortcuts config must be provided, along with handlers for each action.
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
    };
  }, [config]);
}
