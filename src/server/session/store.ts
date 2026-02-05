/**
 * In-memory session store for webmux.
 * Maintains the current session state and notifies listeners on changes.
 */

import {
  type SessionState,
  type Tab,
  type Pane,
  type LayoutNode,
  generateId,
} from "../../shared/types";
import { getUserShell } from "../pty/manager";

/**
 * Callback type for session state change listeners.
 */
export type SessionChangeListener = (state: SessionState) => void;

/**
 * Creates a new pane with default values.
 */
function createPane(): Pane {
  const shell = getUserShell();
  const shellName = shell.split("/").pop() ?? "shell";
  return {
    id: generateId(),
    title: shellName,
    createdAt: Date.now(),
  };
}

/**
 * Creates a new tab with a single pane.
 */
function createTab(pane: Pane): Tab {
  return {
    id: generateId(),
    name: pane.title,
    layout: { type: "leaf", paneId: pane.id },
    createdAt: Date.now(),
  };
}

/**
 * Manages the in-memory session state.
 * Provides methods to query and mutate state, and notifies listeners on changes.
 */
export class SessionStore {
  private state: SessionState | null = null;
  private listeners: Set<SessionChangeListener> = new Set();

  /**
   * Gets the current session state.
   * Initializes a new session with a single tab/pane if none exists.
   * Returns the initial pane ID if a new session was created.
   */
  getState(): { state: SessionState; newPaneId: string | null } {
    if (this.state) {
      return { state: this.state, newPaneId: null };
    }

    // Initialize new session
    const pane = createPane();
    const tab = createTab(pane);

    this.state = {
      tabs: [tab],
      activeTabId: tab.id,
      panes: { [pane.id]: pane },
      focusedPaneId: pane.id,
    };

    return { state: this.state, newPaneId: pane.id };
  }

  /**
   * Adds a listener for session state changes.
   * Returns a function to remove the listener.
   */
  subscribe(listener: SessionChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifies all listeners of a state change.
   */
  private notify(): void {
    if (!this.state) return;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /**
   * Gets a pane by ID.
   */
  getPane(paneId: string): Pane | undefined {
    return this.state?.panes[paneId];
  }

  /**
   * Gets a tab by ID.
   */
  getTab(tabId: string): Tab | undefined {
    return this.state?.tabs.find((t) => t.id === tabId);
  }

  /**
   * Gets the currently active tab.
   */
  getActiveTab(): Tab | undefined {
    if (!this.state) return undefined;
    return this.state.tabs.find((t) => t.id === this.state!.activeTabId);
  }

  /**
   * Sets the active tab and focuses its first pane.
   */
  setActiveTab(tabId: string): boolean {
    if (!this.state) return false;
    const tab = this.state.tabs.find((t) => t.id === tabId);
    if (!tab) return false;

    this.state.activeTabId = tabId;
    this.state.focusedPaneId = this.getFirstPaneId(tab.layout);
    this.notify();
    return true;
  }

  /**
   * Sets the focused pane.
   */
  setFocusedPane(paneId: string | null): boolean {
    if (!this.state) return false;
    if (paneId !== null && !this.state.panes[paneId]) return false;

    this.state.focusedPaneId = paneId;
    this.notify();
    return true;
  }

  /**
   * Updates a pane's title.
   */
  setPaneTitle(paneId: string, title: string): boolean {
    if (!this.state) return false;
    const pane = this.state.panes[paneId];
    if (!pane) return false;

    pane.title = title;
    this.notify();
    return true;
  }

  /**
   * Creates a new tab with a single pane.
   * Returns the new tab and pane, or null if session not initialized.
   */
  createTab(): { tab: Tab; pane: Pane } | null {
    if (!this.state) return null;

    const pane = createPane();
    const tab = createTab(pane);

    this.state.tabs.push(tab);
    this.state.panes[pane.id] = pane;
    this.state.activeTabId = tab.id;
    this.state.focusedPaneId = pane.id;

    this.notify();
    return { tab, pane };
  }

  /**
   * Deletes a tab and all its panes.
   * Returns the IDs of panes that were deleted.
   * If this was the last tab, creates a new empty tab.
   */
  deleteTab(tabId: string): string[] {
    if (!this.state) return [];

    const tabIndex = this.state.tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return [];

    const tab = this.state.tabs[tabIndex]!;
    const paneIds = this.collectPaneIds(tab.layout);

    // Delete all panes in this tab
    for (const paneId of paneIds) {
      delete this.state.panes[paneId];
    }

    // Remove the tab
    this.state.tabs.splice(tabIndex, 1);

    // Handle empty tabs case
    if (this.state.tabs.length === 0) {
      const pane = createPane();
      const newTab = createTab(pane);
      this.state.tabs.push(newTab);
      this.state.panes[pane.id] = pane;
      this.state.activeTabId = newTab.id;
      this.state.focusedPaneId = pane.id;
      // The new pane needs a PTY spawned - caller must handle this
      paneIds.push(`+${pane.id}`); // Prefix with + to indicate new pane
    } else if (this.state.activeTabId === tabId) {
      // Switch to adjacent tab
      const newIndex = Math.min(tabIndex, this.state.tabs.length - 1);
      const adjacentTab = this.state.tabs[newIndex]!;
      this.state.activeTabId = adjacentTab.id;
      this.state.focusedPaneId = this.getFirstPaneId(adjacentTab.layout);
    }

    this.notify();
    return paneIds;
  }

  /**
   * Collects all pane IDs from a layout node.
   */
  private collectPaneIds(node: LayoutNode): string[] {
    if (node.type === "leaf") {
      return [node.paneId];
    }
    return node.children.flatMap((child) => this.collectPaneIds(child));
  }

  /**
   * Gets the first pane ID from a layout node.
   */
  private getFirstPaneId(node: LayoutNode): string {
    if (node.type === "leaf") {
      return node.paneId;
    }
    // Split nodes always have at least one child
    return this.getFirstPaneId(node.children[0]!);
  }

  /**
   * Creates a new pane by splitting an existing pane.
   * Returns the new pane, or null if the source pane doesn't exist.
   */
  splitPane(
    paneId: string,
    direction: "horizontal" | "vertical"
  ): Pane | null {
    if (!this.state) return null;
    if (!this.state.panes[paneId]) return null;

    // Find the tab containing this pane
    const tab = this.state.tabs.find((t) =>
      this.collectPaneIds(t.layout).includes(paneId)
    );
    if (!tab) return null;

    const newPane = createPane();
    this.state.panes[newPane.id] = newPane;

    // Update the layout tree
    tab.layout = this.insertSplit(tab.layout, paneId, newPane.id, direction);
    this.state.focusedPaneId = newPane.id;

    this.notify();
    return newPane;
  }

  /**
   * Inserts a split into the layout tree at the specified pane.
   */
  private insertSplit(
    node: LayoutNode,
    targetPaneId: string,
    newPaneId: string,
    direction: "horizontal" | "vertical"
  ): LayoutNode {
    if (node.type === "leaf") {
      if (node.paneId === targetPaneId) {
        // Replace this leaf with a split containing both panes
        return {
          type: "split",
          direction,
          children: [
            { type: "leaf", paneId: targetPaneId },
            { type: "leaf", paneId: newPaneId },
          ],
          sizes: [0.5, 0.5],
        };
      }
      return node;
    }

    // Recurse into children
    return {
      ...node,
      children: node.children.map((child) =>
        this.insertSplit(child, targetPaneId, newPaneId, direction)
      ),
    };
  }

  /**
   * Deletes a pane and updates the layout tree.
   * Returns an array of pane IDs affected:
   * - The deleted pane ID
   * - If this was the last pane in a tab (but not the last tab), the tab is deleted
   * - If this was the last pane in the last tab, a new tab/pane is created
   *   and the new pane ID is returned prefixed with "+"
   * Returns empty array if the pane was not found.
   */
  deletePane(paneId: string): string[] {
    if (!this.state) return [];
    if (!this.state.panes[paneId]) return [];

    // Find the tab containing this pane
    const tab = this.state.tabs.find((t) =>
      this.collectPaneIds(t.layout).includes(paneId)
    );
    if (!tab) return [];

    // Check if this is the only pane in the tab
    const allPaneIds = this.collectPaneIds(tab.layout);
    if (allPaneIds.length === 1) {
      // Delete the entire tab instead (which handles last-tab case)
      return this.deleteTab(tab.id);
    }

    // Remove the pane from the layout
    tab.layout = this.removePane(tab.layout, paneId)!;
    delete this.state.panes[paneId];

    // Update focus if needed
    if (this.state.focusedPaneId === paneId) {
      this.state.focusedPaneId = this.getFirstPaneId(tab.layout);
    }

    this.notify();
    return [paneId];
  }

  /**
   * Removes a pane from the layout tree, collapsing splits as needed.
   */
  private removePane(node: LayoutNode, paneId: string): LayoutNode | null {
    if (node.type === "leaf") {
      return node.paneId === paneId ? null : node;
    }

    // Filter out the removed pane and recursively process children
    const newChildren: LayoutNode[] = [];
    const newSizes: number[] = [];
    let removedSize = 0;

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      const size = node.sizes[i] ?? 0;
      const result = this.removePane(child, paneId);
      if (result) {
        newChildren.push(result);
        newSizes.push(size);
      } else {
        removedSize += size;
      }
    }

    // No children left
    if (newChildren.length === 0) {
      return null;
    }

    // Only one child left - collapse the split
    if (newChildren.length === 1) {
      return newChildren[0] ?? null;
    }

    // Redistribute the removed size among remaining children
    const sizeSum = newSizes.reduce((a, b) => a + b, 0);
    const normalizedSizes = newSizes.map((s) => s / sizeSum);

    return {
      ...node,
      children: newChildren,
      sizes: normalizedSizes,
    };
  }

  /**
   * Updates the sizes of children in a split.
   */
  updateSplitSizes(paneId: string, sizes: number[]): boolean {
    if (!this.state) return false;

    // Find the tab containing this pane
    const tab = this.state.tabs.find((t) =>
      this.collectPaneIds(t.layout).includes(paneId)
    );
    if (!tab) return false;

    // Find the parent split of this pane and update its sizes
    const updated = this.updateSizesInTree(tab.layout, paneId, sizes);
    if (updated) {
      this.notify();
    }
    return updated;
  }

  /**
   * Recursively finds and updates sizes for the split containing a pane.
   */
  private updateSizesInTree(
    node: LayoutNode,
    paneId: string,
    sizes: number[]
  ): boolean {
    if (node.type === "leaf") return false;

    // Check if this split contains the target pane as a direct child
    const childIndex = node.children.findIndex(
      (child) => child.type === "leaf" && child.paneId === paneId
    );

    if (childIndex !== -1 && sizes.length === node.children.length) {
      node.sizes = sizes;
      return true;
    }

    // Recurse into children
    for (const child of node.children) {
      if (this.updateSizesInTree(child, paneId, sizes)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets all pane IDs in the current session.
   */
  getAllPaneIds(): string[] {
    if (!this.state) return [];
    return Object.keys(this.state.panes);
  }
}

// Singleton instance for the application
export const sessionStore = new SessionStore();
