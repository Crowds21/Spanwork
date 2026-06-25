# AGENTS.md

## Cursor Cloud specific instructions

Spanwork (跨度) is a single product: a **Tauri 2 desktop app** (React 19 + Vite frontend in `apps/spanwork/src`, Rust backend in `apps/spanwork/src-tauri`) that stores all data locally in an embedded SQLite DB (`rusqlite` `bundled`). `packages/shared-types` is a shared TS library, not a service. There are **no external/networked services** (no DB server, API, Redis, etc.) — everything runs in-process.

### Running the app (full GUI works in the cloud VM)

- The README warns that the GUI window cannot open in the Cursor sandbox. This is **outdated for the cloud VM**: a virtual X display is available at `DISPLAY=:1`, and `pnpm tauri:dev` launches the real desktop app successfully. Interact with it via the Desktop pane / computer-use.
- `pnpm tauri:dev` (from repo root) starts the Vite dev server on port **1420** (strict) and the Rust Tauri shell with IPC + SQLite. This is the only way to exercise backend commands (projects, tasks, timer, habits).
- `pnpm dev` is **browser-only** (Vite preview on 1420) and has **no Tauri IPC**, so backend/data features will not work — use it only for pure UI checks.
- A `libEGL warning: DRI3 error / Could not get DRI3 device` is harmless; webkit falls back to software rendering and the UI renders fine.
- If port 1420 is taken, run `pnpm dev:kill-port` first (already chained into `pnpm tauri:dev`).

### Native system dependencies

- The Rust/Tauri build needs GTK/WebKit dev libraries (`libwebkit2gtk-4.1-dev`, `libjavascriptcoregtk-4.1-dev`, `libgtk-3-dev`, `libsoup-3.0-dev`, `librsvg2-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `build-essential`, `pkg-config`). These are provided by the VM snapshot. If `cargo build` fails with missing `webkit2gtk-4.1`/`libsoup-3.0` via `pkg-config`, reinstall them with apt.

### Lint / test / build / run commands (all from repo root)

- Typecheck (the repo's "lint"/"check"): `pnpm typecheck` (alias `pnpm check`) — runs `tsc -b --noEmit` across workspaces.
- Frontend tests: `pnpm --filter @spanwork/app test` (Vitest).
- Rust backend build: `cargo build` (workspace root; member is `apps/spanwork/src-tauri`).
- Run full app: `pnpm tauri:dev`. Build/run scripts are defined in the root `package.json`.
