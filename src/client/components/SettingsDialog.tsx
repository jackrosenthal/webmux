import { useState } from "react";
import {
  IconPalette,
  IconLock,
  IconKeyboard,
  IconTerminal2,
  IconX,
} from "@tabler/icons-react";

type SettingsTab = "appearance" | "security" | "shortcuts" | "terminal";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAB_CONFIG: { id: SettingsTab; icon: typeof IconPalette; label: string }[] = [
  { id: "appearance", icon: IconPalette, label: "Appearance" },
  { id: "security", icon: IconLock, label: "Security" },
  { id: "shortcuts", icon: IconKeyboard, label: "Shortcuts" },
  { id: "terminal", icon: IconTerminal2, label: "Terminal" },
];

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  if (!isOpen) {
    return null;
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-dialog">
        <div className="settings-header">
          <h2>Settings</h2>
          <button
            className="settings-close-button"
            onClick={onClose}
            title="Close"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="settings-body">
          <div className="settings-sidebar">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                className={`settings-tab-button ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
              >
                <tab.icon size={20} />
              </button>
            ))}
          </div>
          <div className="settings-content">
            <h3 className="settings-content-title">
              {TAB_CONFIG.find((t) => t.id === activeTab)?.label}
            </h3>
            <div className="settings-content-body">
              {activeTab === "appearance" && <AppearanceTab />}
              {activeTab === "security" && <SecurityTab />}
              {activeTab === "shortcuts" && <ShortcutsTab />}
              {activeTab === "terminal" && <TerminalTab />}
            </div>
          </div>
        </div>
        <div className="settings-footer">
          <button className="settings-button settings-button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="settings-button settings-button-primary">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AppearanceTab() {
  return (
    <div className="settings-tab-content">
      <p className="settings-placeholder">Appearance settings coming soon.</p>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="settings-tab-content">
      <p className="settings-placeholder">Security settings coming soon.</p>
    </div>
  );
}

function ShortcutsTab() {
  return (
    <div className="settings-tab-content">
      <p className="settings-placeholder">Shortcut settings coming soon.</p>
    </div>
  );
}

function TerminalTab() {
  return (
    <div className="settings-tab-content">
      <p className="settings-placeholder">Terminal settings coming soon.</p>
    </div>
  );
}
