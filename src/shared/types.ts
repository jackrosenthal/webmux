/**
 * Session state types shared between server and client.
 * Defines the structure for tabs, panes, and the layout tree.
 */

/**
 * Represents a single terminal pane.
 */
export interface Pane {
  id: string;
  /** Title displayed in the pane title bar (from OSC escape sequences or shell name) */
  title: string;
  /** Unix timestamp when the pane was created */
  createdAt: number;
}

/**
 * Layout node types for the split tree.
 */
export type SplitDirection = "horizontal" | "vertical";

/**
 * A leaf node in the layout tree, representing a single pane.
 */
export interface LayoutLeaf {
  type: "leaf";
  paneId: string;
}

/**
 * A split node in the layout tree, containing two or more children.
 * Children are arranged either horizontally (side by side) or vertically (stacked).
 */
export interface LayoutSplit {
  type: "split";
  direction: SplitDirection;
  /** Children of this split node */
  children: LayoutNode[];
  /** Sizes of each child as fractions (must sum to 1.0) */
  sizes: number[];
}

/**
 * A node in the layout tree, either a leaf (pane) or a split (container).
 */
export type LayoutNode = LayoutLeaf | LayoutSplit;

/**
 * Represents a tab containing one or more terminal panes.
 */
export interface Tab {
  id: string;
  /** Display name for the tab (defaults to first pane's title) */
  name: string;
  /** Root of the layout tree for this tab */
  layout: LayoutNode;
  /** Unix timestamp when the tab was created */
  createdAt: number;
}

/**
 * The complete session state.
 */
export interface SessionState {
  /** All tabs in the session */
  tabs: Tab[];
  /** ID of the currently active tab */
  activeTabId: string;
  /** All panes indexed by ID for quick lookup */
  panes: Record<string, Pane>;
  /** ID of the currently focused pane (receives keyboard input) */
  focusedPaneId: string | null;
}

/**
 * Generates a unique ID for panes and tabs.
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
