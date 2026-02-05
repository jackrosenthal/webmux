/**
 * Configuration loader for Webmux.
 * Loads TOML config from ~/.config/webmux/config.toml with fallback defaults.
 * Supports environment variable overrides:
 *   - WEBMUX_CONFIG: Path to config file (default: ~/.config/webmux/config.toml)
 *   - WEBMUX_PORT: Server port (overrides config file)
 */

import { parse } from "smol-toml";
import { readFile } from "fs/promises";
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

export async function loadConfig(): Promise<WebmuxConfig> {
  const configPath = getConfigPath();

  let rawConfig: RawConfig = {};

  if (existsSync(configPath)) {
    const content = await readFile(configPath, "utf-8");
    rawConfig = parse(content) as RawConfig;
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
