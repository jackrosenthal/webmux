import { useCallback, useState, useEffect, useMemo } from "react";
import { SplitContainer } from "./SplitContainer";
import { TabBar } from "./TabBar";
import { useSession } from "../hooks/useSession";
import { useShortcuts } from "../hooks/useShortcuts";
import {
  setActiveTab,
  createTab,
  resizePane,
  deleteTab,
  deletePane,
  getConfig,
} from "../services/api";
import type { LayoutSplit } from "../../shared/types";
import type { ShortcutsConfig } from "../../shared/config";

/**
 * TerminalView manages WebSocket connection and session state.
 * Renders the tab bar and terminal for the current focused pane.
 */
export function TerminalView() {
  const { session, wsRef, loading, error } = useSession();
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [shortcutsConfig, setShortcutsConfig] = useState<
    ShortcutsConfig | undefined
  >(undefined);

  // Fetch shortcuts config on mount
  useEffect(() => {
    getConfig().then((config) => {
      setShortcutsConfig(config.shortcuts);
    });
  }, []);

  // Sync focused pane from session state (e.g., when session updates from server)
  useEffect(() => {
    if (session?.focusedPaneId !== undefined) {
      setFocusedPaneId(session.focusedPaneId);
    }
  }, [session?.focusedPaneId]);

  const handlePaneFocus = useCallback(
    (paneId: string) => {
      setFocusedPaneId(paneId);
      // Send focus change to backend
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "focus", paneId }));
      }
    },
    [wsRef]
  );

  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const handleNewTab = useCallback(() => {
    createTab();
  }, []);

  const handleCloseTab = useCallback(() => {
    if (session?.activeTabId) {
      deleteTab(session.activeTabId);
    }
  }, [session?.activeTabId]);

  const handleKillPane = useCallback(() => {
    if (focusedPaneId) {
      deletePane(focusedPaneId);
    }
  }, [focusedPaneId]);

  // Memoize shortcut handlers to avoid unnecessary re-renders
  const shortcutHandlers = useMemo(
    () => ({
      onNewTab: handleNewTab,
      onCloseTab: handleCloseTab,
      onKillPane: handleKillPane,
    }),
    [handleNewTab, handleCloseTab, handleKillPane]
  );

  // Register keyboard shortcuts
  useShortcuts(shortcutsConfig, shortcutHandlers);

  const handleResizeComplete = useCallback(
    (splitNode: LayoutSplit, newSizes: number[]) => {
      // Find the first leaf pane in this split to use as the reference
      const firstChild = splitNode.children[0];
      if (!firstChild) return;

      let paneId: string | null = null;
      if (firstChild.type === "leaf") {
        paneId = firstChild.paneId;
      } else {
        // Recursively find first leaf
        const findFirstLeaf = (
          node: LayoutSplit["children"][number]
        ): string | null => {
          if (node.type === "leaf") return node.paneId;
          for (const child of node.children) {
            const result = findFirstLeaf(child);
            if (result) return result;
          }
          return null;
        };
        paneId = findFirstLeaf(firstChild);
      }

      if (paneId) {
        resizePane(paneId, newSizes);
      }
    },
    []
  );

  if (loading) {
    return <div className="terminal-loading">Connecting...</div>;
  }

  if (error) {
    return <div className="terminal-error">{error}</div>;
  }

  if (!session) {
    return <div className="terminal-loading">No active pane</div>;
  }

  const activeTab = session.tabs.find((tab) => tab.id === session.activeTabId);
  if (!activeTab) {
    return <div className="terminal-loading">No active tab</div>;
  }

  return (
    <div className="main-container">
      <TabBar
        tabs={session.tabs}
        activeTabId={session.activeTabId}
        onTabSelect={handleTabSelect}
        onNewTab={handleNewTab}
      />
      <div className="terminal-area">
        <SplitContainer
          node={activeTab.layout}
          wsRef={wsRef}
          panes={session.panes}
          focusedPaneId={focusedPaneId}
          onPaneFocus={handlePaneFocus}
          onResizeComplete={handleResizeComplete}
        />
      </div>
    </div>
  );
}
