# Omarchy Local Dock

## Mission

Dock an Omarchy workstation into Builder Commons as a governed BYOE workspace and compute source without giving agents ambient host authority.

## Ownership

Omarchy owns the local operating environment and developer/operator experience.

Utility Grid / HERDR owns machine registration, workspace lifecycle, routing, health, and machine-scoped receipts.

AGENTROPOLIS-AGENT-MCP owns the local governed capability membrane.

Builder Commons owns the Local Dock representation and collaboration routing.

## Workstation surfaces

The Local Dock may represent:
- Workspace
- Git
- Terminal
- Compute
- MCP
- Runtime
- Context Capsule

Every surface is descriptive until an explicit capability authorizes an action.

## Fleet mapping

```text
HERMES  = PM / orchestration
CODEX   = engineering execution
GROK    = creative / visual review
VERITY  = evidence validation
54T     = security assurance
AEGIS   = policy / authority gate
```

## BYOE mapping

Omarchy is especially useful as:
- BYOH
- BYOM
- BYOA
- BYOR
- BYOC
- BYOS
- BYOT
- BYOD
- BYOW
- BYOI

BYOK remains credential-brokered.

## Required implementation

1. Consume an authority-free machine profile from AGENTROPOLIS-AGENT-MCP.
2. Render workstation state in Compute Dock / Local Dock.
3. Do not persist credential references into room state.
4. Route reservation and execution through existing capability gates.
5. Attach bounded Context Capsules to delegated work.
6. Emit machine/runtime/action receipts.
7. Mark stale/disconnected machines non-interactive.
8. Provide accessible 2D parity for all workstation controls.
9. Add tests proving presence/visibility cannot execute.
10. Keep the adapter replaceable across host operating environments.

## Definition of done

A verified Omarchy machine can appear in Builder Commons, expose safe capabilities, accept a governed task, launch an approved worker inside a bounded workspace, produce test/evidence output, and return a receipt without exposing ambient host secrets or bypassing the execution corridor.
