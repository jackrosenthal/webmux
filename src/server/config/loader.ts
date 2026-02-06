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
