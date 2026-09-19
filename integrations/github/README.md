# GitHub Adapter

GitHub is a first-class source-control provider for Builder Commons, not a hard dependency of Commons core.

## v0.1 responsibilities

- connect through scoped authorization
- discover accessible repositories
- import a repository reference into a project manifest
- surface issues and pull requests
- emit source-control evidence for contribution records

## Security rule

Raw GitHub credentials never belong in project-room state, project manifests, logs, or agent memory.

## Portable mapping

GitHub data should map into portable Commons contracts before it enters core project state.
