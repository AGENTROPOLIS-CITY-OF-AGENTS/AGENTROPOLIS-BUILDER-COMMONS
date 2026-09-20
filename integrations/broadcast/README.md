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
