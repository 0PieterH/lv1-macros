# LV1 Macro Studio

A local Electron desktop app and browser-based macro editor for Waves LV1. Includes conditional automation, a mixer simulator and a native OSC-over-TCP bridge. Companion is not required.

An **Electron Windows desktop build** is now included. It bundles its own runtime and needs no separate Node installation. See ELECTRON.md for desktop launch, persistence and packaging details. The browser/server mode below remains available without npm dependencies.

## Desktop development

Requires Node.js 24+ and npm.

```sh
npm ci
node node_modules/electron/install.js
npm start
```

Build a portable Windows x64 app:

```sh
npm run package:win
```

Output: `dist/LV1 Macro Studio-win32-x64/`. Distribute the complete folder, including its supporting files. Run `npm test` for the 23 automated tests. Network tests bind only to loopback.

## macOS

Apple Silicon and Intel builds are configured. On a Mac, run `npm run package:mac` to produce both `.app` ZIPs. The included **macOS desktop builds** GitHub Actions workflow can build them after this source is uploaded. See [MACOS.md](MACOS.md) for build instructions, testing, local-network access and development-signing limitations. Mac builds have not been executed on the Windows development machine.

The repository contains source, icons, dependency lockfile, tests and documentation. Dependencies, generated runtimes, packaged binaries, logs and personal saved macro data are excluded. Desktop builds always start with the example macro library.

## Run

Install **Node.js 24 or newer**. On Windows double-click `start.cmd`, or run:

```sh
node server.mjs
```

Open http://127.0.0.1:3210. Set `LV1_APP_PORT` to change the HTTP port. Close the terminal or press Ctrl+C to stop the service. Automation runs in the service while it is open; keyboard/MIDI inputs require an open, connected browser.

The app starts in **simulator mode, disarmed**. Arm it, open Mixer & simulator, and lower Presenter to −80 dB. The example rule sets its mute ON. Moving the fader back up does not unmute it. Conditions are baselined on arming; to test a rule already true, first move back outside its condition.

## Features

- Macro library: create, duplicate, delete, order, search, name, colour, enable/disable; import/export JSON; atomic on-disk save in `data/macros.json`.
- Rule conditions: fader, mute, solo, pan, width, meter L/R, send on/gain, current scene/name, tempo, mixer view, layer, mute groups, talkback, flip aux and mixer-1 spill slots. ANY/ALL, < / ≤ / > / ≥ / equality tolerance, ON/OFF, minimum interval.
- Ordered action sequences with waits and awaited cancellable channel/send fades. Actions can span a channel range within a group. All dedicated controls from the supplied source are represented. Raw LV1 OSC and external UDP OSC actions accept typed JSON args.
- Manual buttons, app-focused F1–F12 shortcuts, local OSC UDP input, local HTTP events, optional browser Web MIDI Program Change.
- Capture manual app controls into a new macro. Physical console changes are not reconstructed as captured commands.
- Simulator with mixer controls and scene, meter, send, layer, mute-group and talkback state injection. Simulator mode never sends commands to LV1 or external OSC targets.
- zDNS network discovery, native MyFOH-style LV1 handshake, automatic pong, TCP timeout, reconnect, port rediscovery and state notifications.
- Execution log; stop/disarm cancels remaining sequence steps and fades. Disconnect disarms; reconnect requires explicit rearming. State received at initial connection is not treated as a transition.

## Connect a mixer

Connections → enter its IPv4 and TCP port. Port 0 discovers that IP via Waves zDNS multicast (225.1.1.1:13337). Alternatively scan, select a result, then Connect LV1. After registration and state arrival, arm automation. A subsequent real LV1 v17.6.26.454 test verified connection, initial state, fader/mute commands and automatic threshold execution; see LIVE-TEST.md. Other commands still need hardware verification.

Unknown live values remain unknown. Unknown conditions do not match; toggles and fades reject unknown starting state. Locally sent mute/fader actions optimistically update state because the supplied source documents that LV1 does not echo all commands to their sender.

## External inputs

HTTP and UDP listeners bind to **127.0.0.1**. The HTTP API rejects foreign browser origins and non-JSON writes. This is a local single-user service, not an authenticated LAN server.

Choose an `External OSC / MIDI / GPI` trigger and an address such as `/macro/go`. Start the OSC listener in Connections to accept plain OSC messages on UDP 9001 (address matching, arguments ignored). HTTP integrations can post:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3210/api/event -ContentType application/json -Body '{"address":"/macro/go"}'
```

GPI requires your own local hardware adapter to post an event. Web MIDI requires a supporting browser (Chrome/Edge), user permission and a MIDI input. A Program Change on MIDI channel 1, program 0 maps to `/midi/1/0`. The MIDI input remains browser-owned. Incoming OSC/GPI/MIDI triggers are not native LV1 key-press events.

## Limits

- No native LV1 macro storage is created: the rule engine runs on this computer.
- Meter rate is determined by LV1. The supplied project estimated 0.8 Hz; substantially faster updates were observed on the tested v17 console. No selectable pre/post meter point or dedicated signal-present flag.
- Flip feedback requires LV1's Aux Cue On Flip. The Flip action needs an already assigned LV1 User Key.
- No supplied protocol support for Audio Master A/B, native channel macros/Macroders, security modes, session saving or arbitrary bank switching.
- Capture records controls sent by this app, not every physical mixer operation. In simulation, direct state-injection controls are not capture actions; use Manual action to record a sequence.
- Existing commands for preamp, processing and EQ retain the source's signatures. Actual available processing varies by track and mixer configuration.
- Stop cancels future work; it does not reverse commands already applied. A live fader slider sends its final value when released; simulator sliders update during dragging.

## Test

```sh
node --test test/*.test.mjs
```

The tests cover threshold/rearm semantics, baselining, unknown state, ANY/ALL, cancellation, sparse scenes, typed OSC, protocol framing and simulator controls. They do not establish compatibility with live Waves hardware.

## Attribution

`lib/osc.ts` and `lib/zdns-discover.ts` are adapted from the user-supplied companion-module-waves-lv1, copyright 2026 Miguel Lourenço, MIT. The accompanying LICENSE is retained. The transport and action mapping follow that project's documented protocol. Community software; not affiliated with Waves or DiGiCo.

## Credits

Pieter HUTAPEA

Protocol portions: Miguel Lourenço (2026), MIT; see LICENSE.

## MIDI mapping window

Open Connections → Open MIDI mapping, then Enable MIDI input. Add a mapping, choose its target macro and press Learn. Play a note, send a Program Change or move a CC control; the device, channel, number and value are captured without firing macros. Save mappings to apply. Arm automation to run mapped macros.

Use channel 0 for any channel, All inputs for any device, and a blank value for any value. Note Off and zero-velocity Note On are ignored. For CC buttons, matching a specific press value avoids triggering again on release. Mappings persist in midi-mappings.json in the desktop data folder. Enable MIDI after each app launch; incoming messages continue working when the mapping window is closed. The original /midi/CH/PC external event addresses remain supported.
