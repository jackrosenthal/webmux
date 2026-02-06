/**
 * Configuration loader for Webmux.
 * Loads TOML config from ~/.config/webmux/config.toml with fallback defaults.
 * Supports environment variable overrides:
 *   - WEBMUX_CONFIG: Path to config file (default: ~/.config/webmux/config.toml)
 *   - WEBMUX_PORT: Server port (overrides config file)
 */

import { parse } from "smol-toml";
import { readFile, writeFile, mkdir, chmod } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";
import type {
  WebmuxConfig,
  ServerConfig,
  AuthConfig,
  TerminalConfig,
  ShortcutsConfig,
  AppearanceConfig,
} from "../../shared/config.js";
import { DEFAULT_CONFIG } from "../../shared/config.js";

function getConfigPath(): string {
  return (
    process.env.WEBMUX_CONFIG ??
    path.join(os.homedir(), ".config", "webmux", "config.toml")
  );
}

function deepMerge<T extends object>(defaults: T, overrides: Partial<T>): T {
  const result = { ...defaults };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const value = overrides[key];
    if (
      value !== undefined &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof defaults[key] === "object" &&
      defaults[key] !== null
    ) {
      result[key] = deepMerge(
        defaults[key] as object,
        value as object
      ) as T[keyof T];
    } else if (value !== undefined) {
      result[key] = value as T[keyof T];
    }
  }
  return result;
}

interface RawConfig {
  server?: Partial<ServerConfig>;
  auth?: Partial<AuthConfig>;
  terminal?: Partial<TerminalConfig>;
  shortcuts?: Partial<ShortcutsConfig>;
  appearance?: Partial<AppearanceConfig>;
}

function applyEnvOverrides(config: WebmuxConfig): void {
  const portEnv = process.env.WEBMUX_PORT;
  if (portEnv !== undefined) {
    const port = parseInt(portEnv, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(
        `Error: WEBMUX_PORT must be a valid port number (1-65535), got: ${portEnv}`
      );
      process.exit(1);
    }
    config.server.port = port;
  }
}

function validateConfig(config: WebmuxConfig): void {
  if (!config.auth.password) {
    console.error(`Error: No password configured.

Please set a password in your config file:
  ${getConfigPath()}

Example config:
  [auth]
  password = "your-secure-password"

The config file should have restrictive permissions (chmod 600).`);
    process.exit(1);
  }
}

const DEFAULT_CONFIG_TEMPLATE = `# Webmux Configuration
# See SPEC.md for full documentation.

[server]
port = 8002

[auth]
# REQUIRED: Set a password to access webmux.
# Uncomment and set the password below, then restart the server.
#
# You can use either a plain text password:
#   password = "your-secure-password"
#
# Or an argon2 hash for better security (generate with: webmux --hash-password):
#   password = "$argon2id$v=19$m=19456,t=2,p=1$..."
#
# password = "your-secure-password"
token_validity_days = 14

[terminal]
scrollback_lines = 100000

[shortcuts]
# Leader key (like tmux prefix). Press leader, then action key.
leader = "Ctrl+b"
new_tab = "n"
vsplit = "|"
hsplit = "-"
kill_pane = "x"
# Copy/paste are direct shortcuts (no leader needed)
copy = "Ctrl+Shift+C"
paste = "Ctrl+Shift+V"

[appearance]
theme = "Dracula"
`;

async function createDefaultConfig(configPath: string): Promise<void> {
  const configDir = path.dirname(configPath);

  // Create config directory if it doesn't exist
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }

  // Write the default config template
  await writeFile(configPath, DEFAULT_CONFIG_TEMPLATE, { mode: 0o600 });

  // Ensure permissions are restrictive
  await chmod(configPath, 0o600);

  console.log(`Created default config file at:
  ${configPath}

Please edit this file and set a password in the [auth] section:
  password = "your-secure-password"

Then restart the server.`);
  process.exit(0);
}

/**
 * Get the config file path (for use by other modules that need to update it).
 */
export function getConfigFilePath(): string {
  return getConfigPath();
}

/**
 * Update the theme in the config file.
 * Reads the current file, updates the appearance.theme value, and writes it back.
 */
export async function saveTheme(themeName: string): Promise<void> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    throw new Error("Config file does not exist");
  }

  const content = await readFile(configPath, "utf-8");

  // Check if [appearance] section exists
  if (content.includes("[appearance]")) {
    // Update existing theme value or add it to the section
    const themeRegex = /^(\s*theme\s*=\s*).*$/m;
    if (themeRegex.test(content)) {
      // Replace existing theme value
      const updated = content.replace(themeRegex, `$1"${themeName}"`);
      await writeFile(configPath, updated, { mode: 0o600 });
    } else {
      // Add theme after [appearance] line
      const updated = content.replace(
        /(\[appearance\]\s*\n)/,
        `$1theme = "${themeName}"\n`
      );
      await writeFile(configPath, updated, { mode: 0o600 });
    }
  } else {
    // Append [appearance] section at the end
    const updated = content.trimEnd() + `\n\n[appearance]\ntheme = "${themeName}"\n`;
    await writeFile(configPath, updated, { mode: 0o600 });
  }
}

/**
 * Settings that can be saved via the settings API.
 */
export interface SettingsToSave {
  appearance: AppearanceConfig;
  auth: {
    token_validity_days: number;
    password?: string;
  };
  shortcuts: ShortcutsConfig;
  terminal: TerminalConfig;
}

/**
 * Update a specific value in a TOML section.
 * Returns the updated content.
 */
function updateTomlValue(
  content: string,
  section: string,
  key: string,
  value: string | number
): string {
  const valueStr = typeof value === "string" ? `"${value}"` : String(value);
  const sectionHeader = `[${section}]`;
  const keyRegex = new RegExp(`^(\\s*${key}\\s*=\\s*).*$`, "m");

  // Check if section exists
  if (content.includes(sectionHeader)) {
    // Find the section bounds
    const sectionStart = content.indexOf(sectionHeader);
    const nextSectionMatch = content.slice(sectionStart + sectionHeader.length).match(/^\[/m);
    const sectionEnd = nextSectionMatch
      ? sectionStart + sectionHeader.length + (nextSectionMatch.index ?? 0)
      : content.length;
    const sectionContent = content.slice(sectionStart, sectionEnd);

    if (keyRegex.test(sectionContent)) {
      // Replace existing key within the section
      const updatedSection = sectionContent.replace(keyRegex, `$1${valueStr}`);
      return content.slice(0, sectionStart) + updatedSection + content.slice(sectionEnd);
    } else {
      // Add key after section header
      const insertPos = sectionStart + sectionHeader.length;
      return (
        content.slice(0, insertPos) +
        `\n${key} = ${valueStr}` +
        content.slice(insertPos)
      );
    }
  } else {
    // Append section at the end
    return content.trimEnd() + `\n\n[${section}]\n${key} = ${valueStr}\n`;
  }
}

/**
 * Save settings to the config file.
 * Only updates the values that are provided, preserving existing structure and comments.
 */
export async function saveSettings(settings: SettingsToSave): Promise<void> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    throw new Error("Config file does not exist");
  }

  let content = await readFile(configPath, "utf-8");

  // Update appearance settings
  content = updateTomlValue(content, "appearance", "theme", settings.appearance.theme);

  // Update auth settings
  content = updateTomlValue(
    content,
    "auth",
    "token_validity_days",
    settings.auth.token_validity_days
  );
  if (settings.auth.password !== undefined) {
    content = updateTomlValue(content, "auth", "password", settings.auth.password);
  }

  // Update shortcuts settings
  content = updateTomlValue(content, "shortcuts", "leader", settings.shortcuts.leader);
  content = updateTomlValue(content, "shortcuts", "new_tab", settings.shortcuts.new_tab);
  content = updateTomlValue(content, "shortcuts", "vsplit", settings.shortcuts.vsplit);
  content = updateTomlValue(content, "shortcuts", "hsplit", settings.shortcuts.hsplit);
  content = updateTomlValue(content, "shortcuts", "kill_pane", settings.shortcuts.kill_pane);
  content = updateTomlValue(content, "shortcuts", "copy", settings.shortcuts.copy);
  content = updateTomlValue(content, "shortcuts", "paste", settings.shortcuts.paste);

  // Update terminal settings
  content = updateTomlValue(
    content,
    "terminal",
    "scrollback_lines",
    settings.terminal.scrollback_lines
  );

  await writeFile(configPath, content, { mode: 0o600 });
}

export async function loadConfig(): Promise<WebmuxConfig> {
  const configPath = getConfigPath();

  let rawConfig: RawConfig = {};

  if (existsSync(configPath)) {
    const content = await readFile(configPath, "utf-8");
    rawConfig = parse(content) as RawConfig;
  } else {
    // Create default config on first run
    await createDefaultConfig(configPath);
  }

  const config: WebmuxConfig = {
    server: deepMerge(DEFAULT_CONFIG.server, rawConfig.server ?? {}),
    auth: deepMerge(DEFAULT_CONFIG.auth, rawConfig.auth ?? {}),
    terminal: deepMerge(DEFAULT_CONFIG.terminal, rawConfig.terminal ?? {}),
    shortcuts: deepMerge(DEFAULT_CONFIG.shortcuts, rawConfig.shortcuts ?? {}),
    appearance: deepMerge(
      DEFAULT_CONFIG.appearance,
      rawConfig.appearance ?? {}
    ),
  };

  applyEnvOverrides(config);
  validateConfig(config);

  return config;
}
