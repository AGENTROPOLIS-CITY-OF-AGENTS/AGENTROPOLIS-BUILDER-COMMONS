# Broadcast Tower Adapter

Broadcast Tower coordinates deliberate screen sharing, live-build sessions, recording metadata, and external streaming adapters.

## Safety defaults

- nothing is broadcast by default
- sources must be explicitly approved
- secret-bearing windows and hidden surfaces must not be captured implicitly
- agent status is a separate data source from raw agent memory
- recording destinations must be visible to participants

## Phase 3 foundation

The collaboration state and provider-neutral media contract are now implemented in `packages/realtime` and `packages/media-adapter`. Broadcast transport remains adapter work. A transport may publish only a surface that the realtime session has explicitly approved.

## Future adapters

- WebRTC
- OBS
- Restream-compatible destinations
- YouTube / Twitch / X / community surfaces where authorized


## WebRTC transport

`integrations/webrtc/src/adapter.mjs` now provides the first governed media transport adapter.

It may publish only:
- an active realtime session
- a participant already joined to that session
- a surface explicitly approved in collaboration state
- a surface owned by the publishing participant

Unpublishing stops attached tracks. Disconnect tears down published surfaces before closing the peer transport.

Surface handoff is coordinated separately in `packages/realtime/src/handoff.mjs`. An accepted handoff is coordination state only. It does not create execution authority or bypass capability grants.
