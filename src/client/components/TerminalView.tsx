import { useCallback, useState, useEffect, useMemo } from "react";
import { SplitContainer } from "./SplitContainer";
import { TabBar } from "./TabBar";
import { SettingsDialog } from "./SettingsDialog";
import { useSession } from "../hooks/useSession";
import { useShortcuts } from "../hooks/useShortcuts";
import { useTheme } from "../hooks/useTheme";
import { useToast } from "./Toast";
import {
  setActiveTab,
  createTab,
  resizePane,
  deletePane,
  splitPane,
  getConfig,
} from "../services/api";
import { copyFromTerminal, pasteToTerminal } from "../services/terminalRegistry";
import type { LayoutSplit } from "../../shared/types";
import type { ShortcutsConfig, TerminalConfig, AppearanceConfig } from "../../shared/config";
import { DEFAULT_CONFIG } from "../../shared/config";

/**
 * TerminalView manages WebSocket connection and session state.
 * Renders the tab bar and terminal for the current focused pane.
 */
export function TerminalView() {
  const { session, wsRef, loading, error, connectionStatus } = useSession();
  const { theme, reloadTheme } = useTheme();
  const { showToast } = useToast();
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [shortcutsConfig, setShortcutsConfig] = useState<
    ShortcutsConfig | undefined
  >(undefined);
  const [terminalConfig, setTerminalConfig] = useState<TerminalConfig>(
    DEFAULT_CONFIG.terminal
  );
  const [appearanceConfig, setAppearanceConfig] = useState<AppearanceConfig>(
    DEFAULT_CONFIG.appearance
  );
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Fetch config on mount
  useEffect(() => {
    getConfig()
      .then((config) => {
        setShortcutsConfig(config.shortcuts);
        setTerminalConfig(config.terminal);
        setAppearanceConfig(config.appearance);
      })
      .catch((err) => {
        console.error("Failed to load config:", err);
        // Config loading already has fallback defaults, no need to show error
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
        try {
          wsRef.current.send(JSON.stringify({ type: "focus", paneId }));
        } catch (err) {
          console.error("Failed to send focus message:", err);
        }
      }
    },
    [wsRef]
  );

  const handleTabSelect = useCallback(
    async (tabId: string) => {
      const result = await setActiveTab(tabId);
      if (!result.success && result.error) {
        showToast(result.error);
      }
    },
    [showToast]
  );

  const handleNewTab = useCallback(async () => {
    const result = await createTab();
    if (!result.success && result.error) {
      showToast(result.error);
    }
  }, [showToast]);

  const handleKillPane = useCallback(async () => {
    if (focusedPaneId) {
      const result = await deletePane(focusedPaneId);
      if (!result.success && result.error) {
        showToast(result.error);
      }
    }
  }, [focusedPaneId, showToast]);

  const handlePaneClose = useCallback(
    async (paneId: string) => {
      const result = await deletePane(paneId);
      if (!result.success && result.error) {
        showToast(result.error);
      }
    },
    [showToast]
  );

  const handlePaneSplit = useCallback(
    async (paneId: string, direction: "horizontal" | "vertical") => {
      const result = await splitPane(paneId, direction);
      if (!result.success && result.error) {
        showToast(result.error);
      }
    },
    [showToast]
  );

  const handleVerticalSplit = useCallback(async () => {
    if (focusedPaneId) {
      const result = await splitPane(focusedPaneId, "vertical");
      if (!result.success && result.error) {
        showToast(result.error);
      }
    }
  }, [focusedPaneId, showToast]);

  const handleHorizontalSplit = useCallback(async () => {
    if (focusedPaneId) {
      const result = await splitPane(focusedPaneId, "horizontal");
      if (!result.success && result.error) {
        showToast(result.error);
      }
    }
  }, [focusedPaneId, showToast]);

  const handleCopy = useCallback(() => {
    if (focusedPaneId) {
      copyFromTerminal(focusedPaneId);
    }
  }, [focusedPaneId]);

  const handlePaste = useCallback(() => {
    if (focusedPaneId) {
      pasteToTerminal(focusedPaneId);
    }
  }, [focusedPaneId]);

  // Memoize shortcut handlers to avoid unnecessary re-renders
  const shortcutHandlers = useMemo(
    () => ({
      onNewTab: handleNewTab,
      onKillPane: handleKillPane,
      onVerticalSplit: handleVerticalSplit,
      onHorizontalSplit: handleHorizontalSplit,
      onCopy: handleCopy,
      onPaste: handlePaste,
    }),
    [handleNewTab, handleKillPane, handleVerticalSplit, handleHorizontalSplit, handleCopy, handlePaste]
  );

  // Register keyboard shortcuts
  useShortcuts(shortcutsConfig, shortcutHandlers);

  const handleResizeComplete = useCallback(
    async (splitNode: LayoutSplit, newSizes: number[]) => {
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
        const result = await resizePane(paneId, newSizes);
        if (!result.success && result.error) {
          // Resize errors are usually transient, log but don't show toast
          console.error("Resize failed:", result.error);
        }
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

  const handleOpenSettings = useCallback(() => {
    setSettingsDialogOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsDialogOpen(false);
  }, []);

  const handleSettingsChange = useCallback(() => {
    // Reload config to pick up changes from settings dialog
    reloadTheme();
    getConfig()
      .then((config) => {
        setShortcutsConfig(config.shortcuts);
        setTerminalConfig(config.terminal);
        setAppearanceConfig(config.appearance);
      })
      .catch((err) => {
        console.error("Failed to reload config:", err);
      });
  }, [reloadTheme]);

  return (
    <div className="main-container">
      <TabBar
        tabs={session.tabs}
        activeTabId={session.activeTabId}
        onTabSelect={handleTabSelect}
        onNewTab={handleNewTab}
        onOpenSettings={handleOpenSettings}
      />
      <div className="terminal-area">
        <SplitContainer
          node={activeTab.layout}
          wsRef={wsRef}
          panes={session.panes}
          focusedPaneId={focusedPaneId}
          onPaneFocus={handlePaneFocus}
          onResizeComplete={handleResizeComplete}
          onPaneClose={handlePaneClose}
          onPaneSplit={handlePaneSplit}
          theme={theme}
          scrollbackLines={terminalConfig.scrollback_lines}
          shortcutsConfig={shortcutsConfig}
          fontFamily={appearanceConfig.font_family}
          fontSize={appearanceConfig.font_size}
        />
      </div>
      {connectionStatus === "reconnecting" && (
        <div className="reconnecting-overlay">
          <div className="reconnecting-indicator">
            <div className="reconnecting-spinner" />
            <span>Reconnecting...</span>
          </div>
        </div>
      )}
      <SettingsDialog
        isOpen={settingsDialogOpen}
        onClose={handleCloseSettings}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
}
