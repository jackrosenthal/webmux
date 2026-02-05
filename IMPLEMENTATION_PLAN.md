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

- [x] **4.1** Implement PTY spawning with node-pty, detect user's shell from
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

- [ ] **5.3** Broadcast session state changes to all connected WebSocket clients,
      implement client-side state sync

## Phase 6: Tabs

- [ ] **6.1** Create `TabBar` component with tab buttons, active tab indicator,
      and new tab (+) button

- [ ] **6.2** Implement `/api/tabs` POST endpoint to create new tab with single
      pane, spawns new PTY

- [ ] **6.3** Implement `/api/tabs/:id` DELETE endpoint to close tab, kills all
      PTYs in tab, handles "last tab" case (create new empty tab)

- [ ] **6.4** Wire up tab switching in UI, persist active tab in session state

## Phase 7: Pane Splitting

- [ ] **7.1** Implement layout tree data structure supporting horizontal and
      vertical splits, each leaf node references a pane ID

- [ ] **7.2** Implement `/api/panes/:id/split` POST endpoint accepting direction
      (h/v), creates new pane, updates layout tree, spawns new PTY

- [ ] **7.3** Create `SplitContainer` React component that recursively renders
      layout tree, positions panes using CSS flexbox

- [ ] **7.4** Implement `/api/panes/:id` DELETE endpoint to kill single pane,
      collapses layout tree node, handles "last pane in tab" case

## Phase 8: Pane Resizing

- [ ] **8.1** Add resize handles between panes in `SplitContainer`, track split
      ratios in layout tree nodes

- [ ] **8.2** Implement drag-to-resize with mouse events, update split ratios
      locally during drag for responsiveness

- [ ] **8.3** Implement `/api/panes/:id/resize` PATCH endpoint to persist new
      split ratios, broadcast to other connected clients

## Phase 9: Pane Title Bars

- [ ] **9.1** Create `PaneTitleBar` component displaying pane title, add to each
      terminal pane

- [ ] **9.2** Parse terminal title escape sequences (OSC 0/1/2) in PTY output,
      update pane title in session state, default to shell name

- [ ] **9.3** Add close (X) button to title bar, wire up to pane delete endpoint

## Phase 10: Focus Follows Mouse

- [ ] **10.1** Track focused pane ID in client state, add mouse enter event to
       terminal containers that updates focused pane

- [ ] **10.2** Send focus change to backend, include focused pane ID in terminal
       WebSocket messages so backend routes input correctly

- [ ] **10.3** Add visual indicator for focused pane (subtle border or title bar
       highlight)

## Phase 11: Keyboard Shortcuts

- [ ] **11.1** Create `ShortcutManager` class that parses shortcut config format
       (e.g., "Ctrl+Shift+T"), registers global keydown handlers

- [ ] **11.2** Implement new tab, close tab, and kill pane shortcuts, ensure
       shortcuts don't interfere with terminal input

- [ ] **11.3** Implement horizontal split and vertical split shortcuts

- [ ] **11.4** Implement copy and paste shortcuts using Clipboard API and xterm
       selection

## Phase 12: Color Themes

- [ ] **12.1** Fetch Gogh themes JSON at build time, transform to xterm.js theme
       format, bundle as static asset

- [ ] **12.2** Create theme types, implement theme loader that merges bundled
       themes with user themes from `~/.config/webmux/themes/`

- [ ] **12.3** Apply theme to xterm.js instances, store selected theme in config,
       persist across sessions

- [ ] **12.4** Create theme selector dropdown in tab bar, update theme on
       selection, apply to all terminals immediately

## Phase 13: Scrollback

- [ ] **13.1** Configure xterm.js scrollback buffer from config value, default
       100,000 lines

- [ ] **13.2** Implement scrollback replay on reconnect - buffer recent terminal
       output on backend, send to new connections

## Phase 14: Polish

- [ ] **14.1** Add xterm-addon-web-links for clickable URLs in terminal output

- [ ] **14.2** Handle WebSocket disconnection gracefully, show reconnecting
       indicator, auto-reconnect with exponential backoff

- [ ] **14.3** Add error handling and user-friendly error messages throughout

- [ ] **14.4** Create default config file on first run if none exists, prompt
       user to set password

## Phase 15: Production Build

- [ ] **15.1** Configure Vite to build frontend assets, embed in backend binary
       using Bun's asset bundling

- [ ] **15.2** Set up `bun build --compile` in build script, output single
       `webmux` ELF binary

- [ ] **15.3** Test binary on clean system without Bun/Node installed, document
       any runtime dependencies (libc, etc.)
