# macOS app

Two native builds are configured:

- `arm64`: Apple Silicon (M-series).
- `x64`: Intel Macs.

## Build on a Mac

Install Node.js 24+ for development, then run from this source folder:

```sh
npm ci
node node_modules/electron/install.js
npm run package:mac
npm run smoke:mac
```

Outputs:

```
dist/LV1-Macro-Studio-macOS-arm64.zip
dist/LV1-Macro-Studio-macOS-x64.zip
```

For a single architecture, use `npm run package:mac:arm64` or `npm run package:mac:x64`.

The app bundles Electron and its mixer bridge; end users do not need Node.js or Companion. Unzip the matching archive and move `LV1 Macro Studio.app` to Applications.

## Build through GitHub

Upload this folder's contents as the repository root, including `.github/`. Open Actions → macOS desktop builds → Run workflow. The workflow builds both architectures on a Mac runner, verifies their ad-hoc signatures, runs all unit/protocol tests and launches a simulator smoke test for the runner's native architecture. Download the `LV1-Macro-Studio-macOS` artifact after the workflow succeeds. It contains the distributable ZIPs and native smoke-test result.

No Apple credentials are needed for this development build. The workflow has not been run from the Windows development environment; a successful run is required before calling the Mac version tested.

## Signing and distribution

These are **ad-hoc signed development builds**, not Developer ID signed or notarized releases. macOS may require explicit approval to open a downloaded development app. For normal public distribution, sign with your Apple Developer ID and notarize on macOS. No Apple credentials are included in this repository. The build script uses macOS `codesign` and `ditto` to preserve signatures, framework symlinks and executable permissions.

## LV1 connection

The app starts with its own bridge in simulator mode, disarmed, unless a compatible local bridge is already running. Use Connections to enter the LV1 computer's IP address. LV1 can run on a different Windows computer on the same network; 127.0.0.1 refers to the Mac itself. Allow local network access if macOS requests it. Waves zDNS multicast must reach the Mac for discovery; otherwise enter the IP and TCP port manually.

Macro data is stored under `~/Library/Application Support/LV1 Macro Studio/data/` when the desktop owns the bridge. File → Open desktop data folder shows its actual location. Closing the last window quits the app and disarms automation. The menu uses macOS application/window menus and Command shortcuts.
