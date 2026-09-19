# Builder Commons Core Contracts

The first implementation should stabilize a small set of portable contracts before framework-specific UI work.

## 1. Project Manifest

Location: `spec/project-manifest.schema.json`

Defines the minimum portable description of a Builder Commons project.

It intentionally does not hardcode GitHub, Hermes, Arc, or any other provider.

## 2. Participant Presence

Location: `spec/participant-presence.schema.json`

Defines how humans, agents, and services appear in a shared workspace.

Presence is descriptive. It does not grant authority.

A participant may advertise capabilities while separately referencing mandates and scoped permissions.

## 3. Contribution Evidence

Location: `spec/contribution-evidence.schema.json`

Defines evidence that Builder Commons can send to CHAOS Builders Exchange for contribution history and reputation.

The contract supports code and non-code contributions.

## Contract rule

Provider-specific data belongs in adapters or metadata, not in the portable core schema unless it becomes a proven cross-provider requirement.

## Next contracts

Planned after the first three:

- project room state
- capability grant
- task / mission
- opportunity reference
- execution receipt reference
- broadcast session
- compute resource advertisement
