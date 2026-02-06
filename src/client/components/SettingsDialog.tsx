import { useState, useEffect, useCallback } from "react";
import {
  IconPalette,
  IconLock,
  IconKeyboard,
  IconTerminal2,
  IconX,
} from "@tabler/icons-react";
import type { TerminalTheme } from "../../shared/theme";
import {
  getSettings,
  updateSettings,
  getThemes,
  type ClientSettings,
} from "../services/api";
import { MONOSPACE_FONTS, DEFAULT_FONT_FAMILY } from "../../shared/fonts";

type SettingsTab = "appearance" | "security" | "shortcuts" | "terminal";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange?: () => void;
}

const TAB_CONFIG: { id: SettingsTab; icon: typeof IconPalette; label: string }[] = [
  { id: "appearance", icon: IconPalette, label: "Appearance" },
  { id: "security", icon: IconLock, label: "Security" },
  { id: "shortcuts", icon: IconKeyboard, label: "Shortcuts" },
  { id: "terminal", icon: IconTerminal2, label: "Terminal" },
];

interface AppearanceState {
  theme: string;
  font_family: string;
  font_size: number;
}

interface SecurityState {
  current_password: string;
  new_password: string;
  confirm_password: string;
  token_validity_days: number;
}

export function SettingsDialog({
  isOpen,
  onClose,
  onSettingsChange,
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [themes, setThemes] = useState<TerminalTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local state for appearance tab (before save)
  const [appearanceState, setAppearanceState] = useState<AppearanceState>({
    theme: "",
    font_family: DEFAULT_FONT_FAMILY,
    font_size: 14,
  });

  // Local state for security tab (before save)
  const [securityState, setSecurityState] = useState<SecurityState>({
    current_password: "",
    new_password: "",
    confirm_password: "",
    token_validity_days: 14,
  });

  // Load settings and themes when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [settingsData, themesData] = await Promise.all([
          getSettings(),
          getThemes(),
        ]);
        if (settingsData) {
          setSettings(settingsData);
          setAppearanceState({
            theme: settingsData.appearance.theme,
            font_family: settingsData.appearance.font_family ?? DEFAULT_FONT_FAMILY,
            font_size: settingsData.appearance.font_size ?? 14,
          });
          setSecurityState({
            current_password: "",
            new_password: "",
            confirm_password: "",
            token_validity_days: settingsData.security.token_validity_days,
          });
        }
        setThemes(themesData);
      } catch (err) {
        setError("Failed to load settings");
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isOpen]);

  const handleSave = useCallback(async () => {
    // Validate password fields if changing password
    if (securityState.new_password) {
      if (!securityState.current_password) {
        setError("Current password is required to change password");
        return;
      }
      if (securityState.new_password !== securityState.confirm_password) {
        setError("New passwords do not match");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      // Build security update only if fields have changed
      const securityUpdate: {
        current_password?: string;
        new_password?: string;
        token_validity_days?: number;
      } = {};

      if (securityState.new_password && securityState.current_password) {
        securityUpdate.current_password = securityState.current_password;
        securityUpdate.new_password = securityState.new_password;
      }

      if (settings && securityState.token_validity_days !== settings.security.token_validity_days) {
        securityUpdate.token_validity_days = securityState.token_validity_days;
      }

      const result = await updateSettings({
        appearance: {
          theme: appearanceState.theme,
          font_family: appearanceState.font_family,
          font_size: appearanceState.font_size,
        },
        ...(Object.keys(securityUpdate).length > 0 ? { security: securityUpdate } : {}),
      });
      if (!result.success) {
        setError(result.error ?? "Failed to save settings");
        return;
      }
      if (result.settings) {
        setSettings(result.settings);
      }
      // Clear password fields after successful save
      setSecurityState((prev) => ({
        ...prev,
        current_password: "",
        new_password: "",
        confirm_password: "",
      }));
      onSettingsChange?.();
      onClose();
    } catch (err) {
      setError("Failed to save settings");
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  }, [appearanceState, securityState, settings, onClose, onSettingsChange]);

  const handleCancel = useCallback(() => {
    // Reset to original settings
    if (settings) {
      setAppearanceState({
        theme: settings.appearance.theme,
        font_family: settings.appearance.font_family ?? DEFAULT_FONT_FAMILY,
        font_size: settings.appearance.font_size ?? 14,
      });
      setSecurityState({
        current_password: "",
        new_password: "",
        confirm_password: "",
        token_validity_days: settings.security.token_validity_days,
      });
    }
    setError(null);
    onClose();
  }, [settings, onClose]);

  if (!isOpen) {
    return null;
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }

  return (
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-dialog">
        <div className="settings-header">
          <h2>Settings</h2>
          <button
            className="settings-close-button"
            onClick={handleCancel}
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
              {loading ? (
                <p className="settings-placeholder">Loading...</p>
              ) : (
                <>
                  {activeTab === "appearance" && (
                    <AppearanceTab
                      themes={themes}
                      state={appearanceState}
                      onChange={setAppearanceState}
                    />
                  )}
                  {activeTab === "security" && (
                    <SecurityTab
                      state={securityState}
                      onChange={setSecurityState}
                    />
                  )}
                  {activeTab === "shortcuts" && <ShortcutsTab />}
                  {activeTab === "terminal" && <TerminalTab />}
                </>
              )}
            </div>
            {error && <p className="settings-error">{error}</p>}
          </div>
        </div>
        <div className="settings-footer">
          <button
            className="settings-button settings-button-secondary"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="settings-button settings-button-primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AppearanceTabProps {
  themes: TerminalTheme[];
  state: AppearanceState;
  onChange: (state: AppearanceState) => void;
}

function AppearanceTab({ themes, state, onChange }: AppearanceTabProps) {
  return (
    <div className="settings-tab-content">
      <div className="settings-field">
        <label className="settings-label" htmlFor="theme-select">
          Theme
        </label>
        <select
          id="theme-select"
          className="settings-select"
          value={state.theme}
          onChange={(e) => onChange({ ...state, theme: e.target.value })}
        >
          {themes.map((theme) => (
            <option key={theme.name} value={theme.name}>
              {theme.name}
            </option>
          ))}
        </select>
      </div>
      <div className="settings-field">
        <label className="settings-label" htmlFor="font-family-select">
          Font Family
        </label>
        <select
          id="font-family-select"
          className="settings-select"
          value={state.font_family}
          onChange={(e) => onChange({ ...state, font_family: e.target.value })}
        >
          {MONOSPACE_FONTS.map((font) => (
            <option key={font.name} value={font.name}>
              {font.name}
            </option>
          ))}
        </select>
      </div>
      <div className="settings-field">
        <label className="settings-label" htmlFor="font-size-input">
          Font Size
        </label>
        <div className="settings-input-with-suffix">
          <input
            id="font-size-input"
            type="number"
            className="settings-input settings-input-number"
            value={state.font_size}
            min={8}
            max={32}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value)) {
                onChange({ ...state, font_size: value });
              }
            }}
          />
          <span className="settings-input-suffix">px</span>
        </div>
      </div>
    </div>
  );
}

interface SecurityTabProps {
  state: SecurityState;
  onChange: (state: SecurityState) => void;
}

function SecurityTab({ state, onChange }: SecurityTabProps) {
  return (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h4 className="settings-section-title">Change Password</h4>
        <div className="settings-field">
          <label className="settings-label" htmlFor="current-password-input">
            Current Password
          </label>
          <input
            id="current-password-input"
            type="password"
            className="settings-input"
            value={state.current_password}
            autoComplete="current-password"
            onChange={(e) =>
              onChange({ ...state, current_password: e.target.value })
            }
          />
        </div>
        <div className="settings-field">
          <label className="settings-label" htmlFor="new-password-input">
            New Password
          </label>
          <input
            id="new-password-input"
            type="password"
            className="settings-input"
            value={state.new_password}
            autoComplete="new-password"
            onChange={(e) =>
              onChange({ ...state, new_password: e.target.value })
            }
          />
        </div>
        <div className="settings-field">
          <label className="settings-label" htmlFor="confirm-password-input">
            Confirm New Password
          </label>
          <input
            id="confirm-password-input"
            type="password"
            className="settings-input"
            value={state.confirm_password}
            autoComplete="new-password"
            onChange={(e) =>
              onChange({ ...state, confirm_password: e.target.value })
            }
          />
        </div>
      </div>
      <div className="settings-section">
        <h4 className="settings-section-title">Token Settings</h4>
        <div className="settings-field">
          <label className="settings-label" htmlFor="token-validity-input">
            Token Validity
          </label>
          <div className="settings-input-with-suffix">
            <input
              id="token-validity-input"
              type="number"
              className="settings-input settings-input-number"
              value={state.token_validity_days}
              min={1}
              max={365}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                  onChange({ ...state, token_validity_days: value });
                }
              }}
            />
            <span className="settings-input-suffix">days</span>
          </div>
        </div>
      </div>
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
