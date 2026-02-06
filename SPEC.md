# Webmux Specification

Webmux is a browser-based terminal multiplexer, similar to tmux but accessed
through a web browser.  Sessions persist as long as the server is running,
allowing users to close the browser and reconnect later to the same session.

## Architecture

### Backend

- **Runtime**: Bun (enables single-binary compilation via `bun build --compile`)
- **HTTP framework**: Hono (lightweight, works well with Bun)
- **Terminal emulation**: Bun's built-in Terminal API for spawning PTY processes
- **WebSocket**: Bun's native WebSocket support
- **Authentication**: Password configured in TOML config file

### Frontend

- **Build tool**: Bun (HTML imports with automatic bundling)
- **UI framework**: React
- **Terminal rendering**: xterm.js

## Project Layout

```
webmux/
├── package.json                 # Project manifest, scripts, dependencies
├── bun.lock                     # Bun lockfile
├── tsconfig.json                # Base TypeScript config (shared settings)
├── tsconfig.server.json         # Server TypeScript config (extends base)
├── tsconfig.client.json         # Client TypeScript config (extends base)
├── SPEC.md
├── IMPLEMENTATION_PLAN.md
│
├── src/
│   ├── server/                  # Backend code (runs in Bun)
│   │   ├── index.ts             # Entry point: starts Hono server
│   │   ├── auth/
│   │   │   ├── middleware.ts    # JWT verification middleware
│   │   │   └── routes.ts        # /auth/* endpoints (login, logout, verify)
│   │   ├── api/
│   │   │   ├── session.ts       # GET /api/session
│   │   │   ├── tabs.ts          # POST/DELETE /api/tabs
│   │   │   ├── panes.ts         # POST/DELETE/PATCH /api/panes
│   │   │   └── settings.ts      # GET/PATCH /api/settings
│   │   ├── ws/
│   │   │   └── terminal.ts      # WebSocket handler for terminal I/O
│   │   ├── pty/
│   │   │   └── manager.ts       # PTY lifecycle management, shell spawning
│   │   ├── session/
│   │   │   └── store.ts         # In-memory session state (tabs, panes, layout)
│   │   └── config/
│   │       └── loader.ts        # TOML config loading and validation
│   │
│   ├── client/                  # Frontend code (React, bundled by Bun)
│   │   ├── index.html           # HTML entry point (imported by server)
│   │   ├── main.tsx             # React entry point, renders App
│   │   ├── App.tsx              # Root component, routing, auth gate
│   │   ├── components/
│   │   │   ├── Terminal.tsx     # xterm.js wrapper, WebSocket connection
│   │   │   ├── TabBar.tsx       # Tab buttons, new tab, settings button
│   │   │   ├── SplitContainer.tsx  # Recursive layout renderer for splits
│   │   │   ├── PaneTitleBar.tsx # Title bar with name and close button
│   │   │   ├── ResizeHandle.tsx # Draggable divider between panes
│   │   │   ├── SettingsDialog.tsx # Settings modal with tabbed interface
│   │   │   └── Login.tsx        # Login form
│   │   ├── hooks/
│   │   │   ├── useSession.ts    # Session state subscription and sync
│   │   │   ├── useTerminal.ts   # Terminal WebSocket and xterm management
│   │   │   ├── useShortcuts.ts  # Keyboard shortcut registration
│   │   │   ├── useSettings.ts   # Settings state and API interactions
│   │   │   └── useTheme.ts      # Theme loading and application
│   │   ├── services/
│   │   │   ├── api.ts           # REST API client (fetch wrappers)
│   │   │   └── ws.ts            # WebSocket client, reconnection logic
│   │   └── styles/
│   │       └── main.css         # Global styles
│   │
│   └── shared/                  # Code shared between server and client
│       ├── types.ts             # Session, Tab, Pane, LayoutNode types
│       ├── config.ts            # Config schema types
│       └── protocol.ts          # WebSocket message type definitions
│
├── themes/
│   └── gogh.json                # Bundled Gogh themes (fetched at build time)
│
└── dist/                        # Build output (gitignored)
    └── webmux                   # Compiled ELF binary (includes frontend)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/server/index.ts` | Server entry point. Creates Hono app, mounts routes, starts listening. |
| `src/server/pty/manager.ts` | Spawns PTY processes, tracks them by pane ID, handles resize and cleanup. |
| `src/server/session/store.ts` | Single source of truth for session state. Notifies WebSocket clients on changes. |
| `src/server/ws/terminal.ts` | Multiplexes terminal I/O over a single WebSocket per client. |
| `src/client/App.tsx` | Checks auth, renders login or main UI, provides context providers. |
| `src/client/components/SplitContainer.tsx` | Recursively renders the layout tree as nested flexbox containers. |
| `src/client/components/SettingsDialog.tsx` | Tabbed modal for configuring appearance, security, shortcuts, and terminal settings. |
| `src/client/hooks/useSession.ts` | Fetches initial state, subscribes to WebSocket updates, exposes actions. |
| `src/shared/types.ts` | Defines `Session`, `Tab`, `Pane`, `LayoutNode` used by both ends. |
| `src/shared/protocol.ts` | Defines WebSocket message shapes for type-safe communication. |

## Features

### Terminal Management

- **Tabs**: Multiple tabs, each containing one or more terminal panes
- **Splits**: Horizontal and vertical splitting within a tab
- **Resizing**: Drag-to-resize pane dividers
- **Focus**: Mouse-follows-focus (no click required to activate a pane)
- **Auto-resize**: Terminal dimensions automatically adjust to container size
- **Shell**: Respects user's shell from /etc/passwd

### Session Persistence

- Sessions survive browser close/reopen
- Sessions survive across multiple browser tabs/windows (shared view)
- Sessions are lost on server restart (in-memory only)

### Scrollback

- Default: 100,000 lines
- Configurable via settings

### Authentication

- Password defined in `~/.config/webmux/config.toml`
- JWT tokens stored in HTTP-only cookies
- Token validity: 14 days (configurable)
- Single-user model

## User Interface

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Tab 1] [Tab 2] [Tab 3] [+]                          [⚙]    │
├─────────────────────────────────────────────────────────────┤
│ ┌─ bash ───────────────────────────────────────[│][-][X]─┐ │
│ │                                                         │ │
│ │  $ ls -la                                               │ │
│ │  total 42                                               │ │
│ │                                                         │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ┌─ vim ─────────────────[│][-][X]─┬─ htop ─[│][-][X]─┐  │ │
│ │ │                                  │                 │  │ │
│ │ │                                  │                 │  │ │
│ │ └──────────────────────────────────┴─────────────────┘  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Pane Title Bar

Each terminal pane has a title bar displaying:
- Window title (from terminal escape sequences, defaults to shell name)
- Control buttons on the right:
  - Vertical split button
  - Horizontal split button
  - Close button

### Controls

- Tab bar at the top with:
  - Active tabs (click to switch)
  - New tab button (+)
  - Settings button (gear icon) opens the settings dialog
- Split controls in pane title bar or via keyboard shortcuts

### Settings Dialog

The settings dialog is a modal with a tabbed interface.  Tabs are displayed as
icon buttons in a vertical sidebar on the left.

```
┌─ Settings ──────────────────────────────────────────────────┐
│ ┌────┬─────────────────────────────────────────────────────┐│
│ │[PA]│  Appearance                                         ││
│ │    │                                                     ││
│ │[LO]│  Theme:        [Dracula              ▼]             ││
│ │    │                                                     ││
│ │[KB]│  Font Family:  [JetBrains Mono       ▼]             ││
│ │    │                                                     ││
│ │[TE]│  Font Size:    [14] px                              ││
│ │    │                                                     ││
│ │    │                                                     ││
│ └────┴─────────────────────────────────────────────────────┘│
│                                         [Cancel]   [Save]   │
└─────────────────────────────────────────────────────────────┘

[PA] = IconPalette, [LO] = IconLock, [KB] = IconKeyboard, [TE] = IconTerminal2
```

#### Tabs

Icons are from @tabler/icons-react:

| Tabler Icon        | Tab          | Settings                                       |
|--------------------|--------------|------------------------------------------------|
| `IconPalette`      | Appearance   | Theme, font family (Google Fonts), font size   |
| `IconLock`         | Security     | Password, token validity                       |
| `IconKeyboard`     | Shortcuts    | Leader key, all keyboard shortcut bindings     |
| `IconTerminal2`    | Terminal     | Scrollback lines, shell                        |

#### Font Selection

Fonts are loaded from Google Fonts.  The dropdown shows a curated list of
monospace fonts suitable for terminal use:

- JetBrains Mono (default)
- Fira Code
- Source Code Pro
- IBM Plex Mono
- Roboto Mono
- Ubuntu Mono
- Inconsolata
- Cascadia Code
- Hack
- Anonymous Pro

Custom fonts can be added via the config file.  The selected font is loaded
dynamically from Google Fonts CDN.

## Keyboard Shortcuts

Shortcuts use a leader key system (like tmux).  Press the leader key, then the
action key.  Shortcuts are configurable via `~/.config/webmux/config.toml`.

### Defaults

**Leader key:** `Ctrl+B`

| Shortcut         | Action                        |
|------------------|-------------------------------|
| Leader, n        | New tab                       |
| Leader, \|       | Vertical split                |
| Leader, -        | Horizontal split              |
| Leader, x        | Kill current pane             |
| Ctrl+Shift+C     | Copy selected text (direct)   |
| Ctrl+Shift+V     | Paste from clipboard (direct) |

## Configuration

### File Location

`~/.config/webmux/config.toml`

### Example Configuration

```toml
[server]
port = 8002

[auth]
password = "your-password-here"
token_validity_days = 14

[terminal]
scrollback_lines = 100000

[shortcuts]
leader = "Ctrl+b"
new_tab = "n"
vsplit = "|"
hsplit = "-"
kill_pane = "x"
copy = "Ctrl+Shift+C"
paste = "Ctrl+Shift+V"

[appearance]
theme = "Dracula"
font_family = "JetBrains Mono"
font_size = 14
```

## Color Schemes

- Defined in JSON format
- Default themes sourced from [Gogh](https://github.com/Gogh-Co/Gogh)
- Users can add custom themes to `~/.config/webmux/themes/`

### Theme JSON Format

```json
{
  "name": "Dracula",
  "background": "#282a36",
  "foreground": "#f8f8f2",
  "cursor": "#f8f8f2",
  "black": "#000000",
  "red": "#ff5555",
  "green": "#50fa7b",
  "yellow": "#f1fa8c",
  "blue": "#bd93f9",
  "magenta": "#ff79c6",
  "cyan": "#8be9fd",
  "white": "#bfbfbf",
  "brightBlack": "#4d4d4d",
  "brightRed": "#ff6e67",
  "brightGreen": "#5af78e",
  "brightYellow": "#f4f99d",
  "brightBlue": "#caa9fa",
  "brightMagenta": "#ff92d0",
  "brightCyan": "#9aedfe",
  "brightWhite": "#e6e6e6"
}
```

## API Endpoints

### Authentication

| Method | Endpoint     | Description                          |
|--------|--------------|--------------------------------------|
| POST   | /auth/login  | Authenticate with configured password |
| POST   | /auth/logout | Invalidate current token             |
| GET    | /auth/verify | Check if token is valid              |

### Session Management

| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| GET    | /api/session          | Get current session state      |
| POST   | /api/tabs             | Create new tab                 |
| DELETE | /api/tabs/:id         | Close tab                      |
| POST   | /api/panes/:id/split  | Split pane (h or v)            |
| DELETE | /api/panes/:id        | Kill pane                      |
| PATCH  | /api/panes/:id/resize | Resize pane                    |

### Settings

| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| GET    | /api/settings         | Get current settings           |
| PATCH  | /api/settings         | Update settings (partial)      |

### WebSocket

| Endpoint       | Description                              |
|----------------|------------------------------------------|
| /ws/terminal   | Bidirectional terminal I/O multiplexed   |

WebSocket messages are JSON-encoded with a `paneId` field to route data to the
correct terminal.

## Environment Variables

| Variable          | Default | Description                     |
|-------------------|---------|---------------------------------|
| WEBMUX_PORT       | 8002    | Server listen port              |
| WEBMUX_CONFIG     | ~/.config/webmux/config.toml | Config file path |

## Development

Requires Bun to be installed.

```bash
# Install dependencies
bun install

# Run development server (with hot reload)
bun run dev
```

## Production Build

Build produces a self-contained ELF binary for distribution using
`bun build --compile`:

```bash
bun run build
```

The output binary (`webmux`) includes all frontend assets embedded and can be
deployed without Bun or Node.js installed on the target system.  Note that
The binary is platform-specific (Linux x64).

### Runtime Dependencies

The compiled binary is dynamically linked against:

- **glibc 2.25+** (libc.so.6, libpthread.so.0, libdl.so.2, libm.so.6)
- **Linux kernel 3.2+** (for PTY support)

No Bun, Node.js, or other JavaScript runtime is required on the target system.
The binary is self-contained and includes all JavaScript code and frontend
assets.

To verify dependencies on a target system:

```bash
ldd ./webmux
```

## Security Considerations

- Password stored in config file (ensure `~/.config/webmux/config.toml` has
  restrictive permissions: `chmod 600`)
- Tokens are JWT stored in HTTP-only cookies (not accessible to JavaScript)
- HTTPS should be terminated at a reverse proxy (nginx, caddy, etc.)
- Terminals run as the user who started the server
- WebSocket connections require valid authentication

## Browser Support

- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Dependencies

### Backend
- bun (runtime)
- hono (HTTP framework)
- Bun Terminal API (PTY spawning)
- @node-rs/argon2 (password hashing for stored tokens)
- smol-toml (TOML parsing)

### Frontend
- react
- @tabler/icons-react (icon library)
- @xterm/xterm
- @xterm/addon-fit
- @xterm/addon-web-links
