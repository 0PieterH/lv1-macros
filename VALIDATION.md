# Validation

- 23 automated tests passed on Node.js 24.19.0, including tests for the live-verified bulk gain/mute fields and PanArcWidth correction.
- Loopback fake LV1: batched MyFOH handshake, fragmented incoming frames, multiple frames in one packet, auto-pong, command transmission and cancellation of a pending reconnect passed.
- HTTP integration: simulator state injection, automatic fader-to-mute execution, app-control capture, macro persistence, external HTTP/OSC event triggers, rejected cross-origin writes, invalid macro rejection and disarm enforcement passed.
- Browser: macro creation, editing, saving, ANY conditions, a range mute affecting inputs 1–3, manual action execution, capture and event log inspected. No browser JavaScript errors observed. Default-width layout had no horizontal overflow.
- Syntax checks passed for server, editor and engine modules.
- A real LV1 v17.6.26.454 was subsequently tested: discovery, handshake, initial state, output fader, mute and the Input 80 threshold macro passed. See LIVE-TEST.md. Other controls and physical MIDI/GPI hardware remain unverified.

The app defaults to the simulator and starts disarmed. Live connection information and arming are not restored across service restarts.

## Electron desktop

- Windows x64 portable app packaged with Electron 45.0.0 (bundled Node 24.22.0).
- Packaged executable smoke test passed with its own bridge on an ephemeral loopback port, simulator mode, and persistent desktop data directory.
- Packaged executable smoke test passed when attaching to the existing real LV1 bridge on 127.0.0.1:3210, reporting live/connected.
- Both tests confirmed nodeIntegration=false, contextIsolation=true and sandbox=true for the renderer.
- Desktop shutdown disarmed automation; the owned bridge exited, while the reused live bridge remained available.
- The same 23 source regression tests passed after adding Electron support.
