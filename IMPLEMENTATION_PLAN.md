# Webmux Implementation Plan

Each step corresponds to a single commit.  Steps should be completed in order.

## Phase 1: Project Scaffolding

- [x] **1.1** Initialize pnpm workspace with `package.json`, set up TypeScript
      config for both frontend and backend, create basic directory structure
      (`src/server/`, `src/client/`, `src/shared/`)

- [x] **1.2** Set up Vite for frontend with React and TypeScript, create minimal
      `index.html` and `App.tsx` that renders "Hello Webmux"

- [x] **1.3** Set up Bun + Hono backend server, serve static files from Vite
      build output, add `pnpm run dev` script that runs both concurrently

## Phase 2: Configuration

- [x] **2.1** Create config types in `src/shared/config.ts`, implement TOML
      config loader using smol-toml, load from `~/.config/webmux/config.toml`
      with fallback defaults

- [x] **2.2** Add environment variable overrides (`WEBMUX_PORT`, `WEBMUX_CONFIG`),
      validate config on startup, exit with clear error if password not set

## Phase 3: Authentication

- [x] **3.1** Implement `/auth/login` endpoint that validates password against
      config, returns JWT in HTTP-only cookie

- [x] **3.2** Implement `/auth/verify` endpoint and auth middleware that checks
      JWT cookie, protects all `/api/*` and `/ws/*` routes

- [x] **3.3** Implement `/auth/logout` endpoint that clears the auth cookie

- [x] **3.4** Create login page UI in React, redirect to main app on successful
      login, redirect to login page when unauthenticated

## Phase 4: Basic Terminal

- [x] **4.1** Implement PTY spawning with Bun Terminal API, detect user's shell from
      `/etc/passwd`, create `PtyManager` class to track active PTYs

- [x] **4.2** Implement WebSocket endpoint `/ws/terminal` with Bun's native
      WebSocket, authenticate connection, multiplex messages by pane ID

- [x] **4.3** Add xterm.js and react-xtermjs to frontend, create `Terminal`
      component that connects to WebSocket and renders terminal

- [x] **4.4** Implement terminal auto-resize using xterm-addon-fit, send resize
      events to backend, update PTY dimensions

## Phase 5: Session State

- [x] **5.1** Create `SessionState` type in shared code defining tabs, panes,
      and layout tree structure, implement in-memory session store on backend

- [x] **5.2** Implement `/api/session` GET endpoint that returns current session
      state, initialize with single tab containing single pane on first connect

- [x] **5.3** Broadcast session state changes to all connected WebSocket clients,
      implement client-side state sync

## Phase 6: Tabs

- [x] **6.1** Create `TabBar` component with tab buttons, active tab indicator,
      and new tab (+) button

- [x] **6.2** Implement `/api/tabs` POST endpoint to create new tab with single
      pane, spawns new PTY

- [x] **6.3** Implement `/api/tabs/:id` DELETE endpoint to close tab, kills all
      PTYs in tab, handles "last tab" case (create new empty tab)

- [x] **6.4** Wire up tab switching in UI, persist active tab in session state

## Phase 7: Pane Splitting

- [x] **7.1** Implement layout tree data structure supporting horizontal and
      vertical splits, each leaf node references a pane ID

- [x] **7.2** Implement `/api/panes/:id/split` POST endpoint accepting direction
      (h/v), creates new pane, updates layout tree, spawns new PTY

- [x] **7.3** Create `SplitContainer` React component that recursively renders
      layout tree, positions panes using CSS flexbox

- [x] **7.4** Implement `/api/panes/:id` DELETE endpoint to kill single pane,
      collapses layout tree node, handles "last pane in tab" case

## Phase 8: Pane Resizing

- [x] **8.1** Add resize handles between panes in `SplitContainer`, track split
      ratios in layout tree nodes

- [x] **8.2** Implement drag-to-resize with mouse events, update split ratios
      locally during drag for responsiveness

- [x] **8.3** Implement `/api/panes/:id/resize` PATCH endpoint to persist new
      split ratios, broadcast to other connected clients

## Phase 9: Pane Title Bars

- [x] **9.1** Create `PaneTitleBar` component displaying pane title, add to each
      terminal pane

- [x] **9.2** Parse terminal title escape sequences (OSC 0/1/2) in PTY output,
      update pane title in session state, default to shell name

- [x] **9.3** Add close (X) button to title bar, wire up to pane delete endpoint

## Phase 10: Focus Follows Mouse

- [x] **10.1** Track focused pane ID in client state, add mouse enter event to
       terminal containers that updates focused pane

- [x] **10.2** Send focus change to backend, include focused pane ID in terminal
       WebSocket messages so backend routes input correctly

- [x] **10.3** Add visual indicator for focused pane (subtle border or title bar
       highlight)

## Phase 11: Keyboard Shortcuts

- [x] **11.1** Create `ShortcutManager` class that parses shortcut config format
       (e.g., "Ctrl+Shift+T"), registers global keydown handlers

- [x] **11.2** Implement new tab, close tab, and kill pane shortcuts, ensure
       shortcuts don't interfere with terminal input

- [x] **11.3** Implement horizontal split and vertical split shortcuts

- [x] **11.4** Implement copy and paste shortcuts using Clipboard API and xterm
       selection

## Phase 12: Color Themes

- [x] **12.1** Fetch Gogh themes JSON at build time, transform to xterm.js theme
       format, bundle as static asset

- [x] **12.2** Create theme types, implement theme loader that merges bundled
       themes with user themes from `~/.config/webmux/themes/`

- [x] **12.3** Apply theme to xterm.js instances, store selected theme in config,
       persist across sessions

- [x] **12.4** Create theme selector dropdown in tab bar, update theme on
       selection, apply to all terminals immediately

## Phase 13: Scrollback

- [x] **13.1** Configure xterm.js scrollback buffer from config value, default
       100,000 lines

- [x] **13.2** Implement scrollback replay on reconnect - buffer recent terminal
       output on backend, send to new connections

## Phase 14: Polish

- [x] **14.1** Add xterm-addon-web-links for clickable URLs in terminal output

- [x] **14.2** Handle WebSocket disconnection gracefully, show reconnecting
       indicator, auto-reconnect with exponential backoff

- [x] **14.3** Add error handling and user-friendly error messages throughout

- [x] **14.4** Create default config file on first run if none exists, prompt
       user to set password

## Phase 15: Production Build

- [x] **15.1** Configure Vite to build frontend assets, embed in backend binary
       using Bun's asset bundling

- [x] **15.2** Set up `bun build --compile` in build script, output single
       `webmux` ELF binary

- [x] **15.3** Test binary on clean system without Bun/Node installed, document
       any runtime dependencies (libc, etc.)

## Phase 16: Identify Gaps

- [x] **16.1** Identify any gaps from SPEC.md that were not completed, or possibly not a part of the implementation plan (i.e., things left un-wired, etc).  Append new steps to the bottom of the implementation plan as required.

## Phase 17: Address Gaps

- [x] **17.1** Commit pnpm-workspace.yaml to version control (file exists but is
      untracked)

- [x] **17.2** Implement password hashing with @node-rs/argon2 as specified in
      SPEC.md - add dependency, hash passwords before comparison, update config
      generation to store hashed passwords

- [x] **17.3** Persist theme selection to config file instead of localStorage -
      add `/api/config/theme` PATCH endpoint to write theme to config.toml,
      update client to call this endpoint on theme change

## Phase 18: Settings Dialog

- [x] **18.1** Create `/api/settings` GET endpoint that returns current settings
      (appearance, security, shortcuts, terminal sections from config), create
      `/api/settings` PATCH endpoint that accepts partial updates and writes to
      config.toml

- [x] **18.2** Create `SettingsDialog.tsx` component with modal overlay, tabbed
      interface using icon buttons in left sidebar (Appearance, Security,
      Shortcuts, Terminal tabs)

- [x] **18.3** Implement Appearance tab with theme dropdown (reusing existing
      theme list), font size number input, save/cancel buttons that call
      PATCH /api/settings

- [x] **18.4** Add Google Fonts integration - create curated list of monospace
      fonts (JetBrains Mono, Fira Code, Source Code Pro, etc.), add font family
      dropdown to Appearance tab, dynamically load selected font from Google
      Fonts CDN

- [ ] **18.5** Apply selected font to xterm.js instances, add `font_family` and
      `font_size` to config schema and types, persist font settings to config

- [ ] **18.6** Implement Security tab with password change form (current
      password, new password, confirm), token validity days input

- [ ] **18.7** Implement Shortcuts tab displaying all configurable shortcuts
      (leader key, new_tab, vsplit, hsplit, kill_pane, copy, paste), allow
      editing each binding with a key capture input

- [ ] **18.8** Implement Terminal tab with scrollback lines input

- [ ] **18.9** Replace theme selector dropdown in TabBar with gear icon button
      that opens SettingsDialog, remove ThemeSelector.tsx

- [ ] **18.10** Create `useSettings.ts` hook for fetching/updating settings,
       handle optimistic updates and error states, broadcast settings changes
       to all connected clients via WebSocket
