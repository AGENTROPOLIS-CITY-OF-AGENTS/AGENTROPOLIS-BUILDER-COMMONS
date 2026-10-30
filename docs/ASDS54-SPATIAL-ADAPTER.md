# Builder Commons / ASDS-54 spatial adapter

Status: **implemented DOM-free navigation adapter + tests**, not a production 3D rendering integration.

This package provides a deterministic, reversible navigation state model over Builder Commons' existing functional zones (Atrium, Forge, Project Rooms, Guilds, Agent Dock, Compute Dock, Broadcast Tower, XR Portal, Opportunity Exchange). It can be consumed by a future ASDS-54 scene or the accessible 2D fallback without rewriting the project-room state engine.

## Boundaries
- Read-only presentation state only; no repository/network/agent tool calls or credential access.
- Existing Commons room, presence, capability broker, receipts and CBE adapters remain the owners of real functionality.
- `isSimulation: true` is mandatory until real spatial rendering and device input are verified.
- `agentExecutionGranted: false` is disclosure only; runtime execution authorization must still be enforced by the capability broker.
- Views and nav will share tokens from canonical `agentropolis-design-core`. Preserve Builder Commons current 2D UI and first contribution corridor.
- UI and city graph integration require separate review after current AGENTROPOLIS city visual remediation.

## Test
`node --test tests/spatial-adapter.test.mjs`

## Next
1. Connect a real ASDS-54 renderer via a versioned adapter once its source is available.
2. Add real navigable architectural assets; no primitive cubes as final production.
3. Wire navigation to existing project-room selection, never directly to execution.
4. Verify mobile/desktop, FULL/ADAPT/LITE/MIN, reduced-motion and accessible keyboard flows.
5. Implement a real project-room PR + verified contribution receipt user journey before promising shared build worlds.
