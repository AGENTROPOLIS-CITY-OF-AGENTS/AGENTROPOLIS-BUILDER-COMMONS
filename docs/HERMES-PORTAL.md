# Hermes Portal

## Status

The Hermes Portal is an **AGENTROPOLIS-owned interoperability and community surface** inside Builder Commons.

It is **not** an official Nous Research division unless Nous Research explicitly establishes or endorses that relationship.

Use neutral wording such as **Hermes Community Portal** for public surfaces until an official relationship exists.

## Purpose

The portal gives Hermes builders a dedicated entrance into Builder Commons without making Hermes the foundation of Builder Commons.

Potential portal capabilities:

- Hermes-compatible project rooms
- Hermes agent presence
- Hermes skills
- community projects
- runtime integration
- issue and bounty discovery
- build rooms
- upstream contribution tracking
- mobile-client experimentation
- testing and showcase spaces

## Ownership boundary

### AGENTROPOLIS owns
- the portal UI
- Commons integration
- adapters
- CBE integration
- governance integration
- spatial representation
- project-room behavior

### Nous / Hermes upstream owns
- Hermes core
- Hermes upstream APIs
- upstream contribution standards
- merge decisions for upstream PRs

## Upstream contribution rule

Do not turn AGENTROPOLIS Builder Commons into a permanent drifting Hermes fork.

When Builder Commons uncovers a capability that is broadly useful to Hermes:

```text
Need discovered in Builder Commons
            ↓
Is it AGENTROPOLIS-specific?
      ┌─────┴─────┐
     yes          no
      ↓            ↓
keep in adapter   generalize
                   ↓
                test
                   ↓
          propose upstream
```

The Commons must continue functioning even if an upstream proposal is not accepted.

## Hermes adapter

Recommended initial boundary:

```text
integrations/hermes/
├── adapter/
├── gateway/
├── presence/
├── skills/
├── projects/
└── README.md

portals/hermes/
├── community/
├── guilds/
├── bounties/
├── builds/
└── upstream/
```

The exact implementation may evolve. The architectural boundary should remain.
