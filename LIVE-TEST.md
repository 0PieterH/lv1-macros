# Real LV1 test — 22 October 2026

Console service: LV1 v17.6.26.454. Connection: MyFOH-style OSC-over-TCP handshake; zDNS discovery succeeded.

## Verified

- 80 input channels discovered, plus real channel names, colours, scene list, mixer view and meters.
- The console provided initial gain/mute state for 150 track records in `/Channels`.
- Input 80 was confirmed unused by the user before any control changes.
- Started with Input 80 at −144 dB, unmuted.
- Disabled other macros during testing.
- Sent Input 80 to −70 dB, then unmuted it.
- Moved it to −80 dB. The automatic `gain <= -80 → mute ON` rule fired.
- A separate LV1 client received `/Notify/Track/Out/Gain [0,79,-80,T]` and `/Notify/Track/Out/Mute [0,79,1,T]`.
- A fresh `/Channels` readback independently confirmed gain −80 and mute 1.
- Restored Input 80 to −144 dB, unmuted. The entire 19-field bulk record matched its initial record.
- Restored the original macro library and left automation disarmed.

## Corrections based on this session

- Decode initial fader gain from record offset 3 and mute from offset 6 of the validated 19-field `/Channels` records.
- Do not treat `/Notify/PanArcWidth` as normalized stereo width: this console sends values such as 857.142857.
- Allow 16 Groups and 16 DCA/Link tracks, which this LV1 advertises; the supplied module assumed 8.
- Keep internal groups 24/25 out of action pickers because their control semantics have not been established.
- Update mixer values in place instead of rebuilding all channel controls for every meter notification.

This test verifies connection, state reception, output fader control, mute control and the automatic fader-to-mute rule. It does not verify every processing, send, talkback, scene-recall, MIDI or GPI action.
