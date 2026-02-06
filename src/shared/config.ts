/**
 * Configuration types shared between server and client.
 */

export interface ServerConfig {
  port: number;
}

export interface AuthConfig {
  password: string;
  token_validity_days: number;
}

export interface TerminalConfig {
  scrollback_lines: number;
}

export interface ShortcutsConfig {
  leader: string;
  new_tab: string;
  vsplit: string;
  hsplit: string;
  kill_pane: string;
  copy: string;
  paste: string;
}

export interface AppearanceConfig {
  theme: string;
}

export interface WebmuxConfig {
  server: ServerConfig;
  auth: AuthConfig;
  terminal: TerminalConfig;
  shortcuts: ShortcutsConfig;
  appearance: AppearanceConfig;
}

export const DEFAULT_CONFIG: WebmuxConfig = {
  server: {
    port: 8002,
  },
  auth: {
    password: "",
    token_validity_days: 14,
  },
  terminal: {
    scrollback_lines: 100000,
  },
  shortcuts: {
    leader: "Ctrl+b",
    new_tab: "n",
    vsplit: "|",
    hsplit: "-",
    kill_pane: "x",
    copy: "Ctrl+Shift+C",
    paste: "Ctrl+Shift+V",
  },
  appearance: {
    theme: "Dracula",
  },
};
