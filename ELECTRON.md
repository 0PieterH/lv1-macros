# Windows desktop app

For Apple Silicon and Intel macOS builds, see [MACOS.md](MACOS.md).

Build with `npm run package:win`. The portable Windows build is written to `dist/LV1 Macro Studio-win32-x64/`. Run **LV1 Macro Studio.exe**. Keep the executable and its supporting files together. Node.js and Companion are not required on the computer running the packaged app.

## Behaviour

- Runs the existing Macro Studio interface in its own Electron window.
- If the existing browser bridge is already listening on 127.0.0.1:3210, it attaches to that bridge, preserving its LV1 connection and current macro library.
- Otherwise starts a bundled mixer bridge on a free loopback port. That bridge starts in simulator mode, disarmed. Connect LV1 from Connections as before.
- Desktop-owned macros persist under the app's Windows user-data directory, normally `%APPDATA%/LV1 Macro Studio/data/macros.json`. Use File → Open desktop data folder to find data and logs. A reused browser bridge continues using its existing data folder.
- Closing the desktop app disarms automation and cancels pending actions. It stops a bridge it owns, and leaves a reused browser bridge running.
- Single-instance behaviour: launching again focuses the existing window.
- The renderer runs with Node integration disabled, context isolation enabled and sandboxing enabled. Navigation is restricted to the local bridge.
- The menu includes reload, zoom, full screen, editing commands and Stop all automation (`Ctrl+Shift+.`).

## Build from source

Node.js 24+ is required for development only.

```sh
npm install
node node_modules/electron/install.js
npm start
npm run package:win
```

Electron 45 uses an explicit runtime installation command. `prepare:desktop` converts the two inherited TypeScript protocol modules to JavaScript; no TypeScript loader or system Node is used by the packaged app. The official Electron packager builds the Windows x64 folder. The build currently produces an unsigned portable app, not an installer.

```sh
npm run start:web
npm test
```

## Desktop verification

Electron's hidden smoke test (`--smoke-test --own-bridge`) verifies the bundled runtime starts, a window loads the local interface, the state API responds, and renderer isolation flags are enabled. `--smoke-test` without `--own-bridge` also checks attaching to an already running browser bridge. Smoke tests disarm automation on exit; they do not send mixer control commands.
