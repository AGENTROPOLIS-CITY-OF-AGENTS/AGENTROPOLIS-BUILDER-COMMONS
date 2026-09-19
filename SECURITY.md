# Security Policy

Builder Commons connects code, agents, credentials, hardware, compute, wallets, and economic systems. Security boundaries are therefore part of the product architecture.

## Core rules

1. **Never place raw secrets in project-room state.**
2. **Never give an agent more authority than its mandate requires.**
3. **Prefer temporary scoped capabilities over long-lived credentials.**
4. **Sandbox untrusted projects and code before execution.**
5. **Separate intelligence from execution authority.**
6. **Emit receipts for consequential actions.**
7. **Keep settlement routing in PAYRAIL, not in arbitrary agents or language layers.**
8. **Do not weaken branch protections or verification gates to make automation easier.**

## Governed corridor

```text
Identity
  ↓
Mandate
  ↓
Policy
  ↓
Tool Permission
  ↓
Execution
  ↓
Receipt
  ↓
Audit
```

## BYOK

Bring Your Own Keys means Builder Commons can interoperate with user-owned credentials through approved vault or broker patterns.

It does **not** mean pasting keys into:

- source files
- chat
- spatial metadata
- agent memory
- project manifests
- logs

## Reporting

For now, report security issues privately to repository maintainers rather than opening a public issue containing exploit details or secrets.

A dedicated security reporting channel can be added as the project matures.
