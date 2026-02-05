/**
 * Registry for terminal instances.
 * Maps pane IDs to their xterm.js instances for operations like copy/paste.
 */

import type { Terminal } from "@xterm/xterm";

/**
 * Global registry mapping pane IDs to their Terminal instances.
 */
const terminals = new Map<string, Terminal>();

/**
 * Register a terminal instance for a pane.
 */
export function registerTerminal(paneId: string, terminal: Terminal): void {
  terminals.set(paneId, terminal);
}

/**
 * Unregister a terminal instance for a pane.
 */
export function unregisterTerminal(paneId: string): void {
  terminals.delete(paneId);
}

/**
 * Get the terminal instance for a pane.
 */
export function getTerminal(paneId: string): Terminal | undefined {
  return terminals.get(paneId);
}

/**
 * Copy the current selection from a terminal to the clipboard.
 * Returns true if text was copied, false if no selection.
 */
export async function copyFromTerminal(paneId: string): Promise<boolean> {
  const terminal = terminals.get(paneId);
  if (!terminal) return false;

  const selection = terminal.getSelection();
  if (!selection) return false;

  try {
    await navigator.clipboard.writeText(selection);
    return true;
  } catch {
    return false;
  }
}

/**
 * Paste text from the clipboard into a terminal.
 * Returns true if paste was successful.
 */
export async function pasteToTerminal(paneId: string): Promise<boolean> {
  const terminal = terminals.get(paneId);
  if (!terminal) return false;

  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      terminal.paste(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
