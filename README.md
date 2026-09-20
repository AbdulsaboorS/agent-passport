# Agent Passport

Agent Passport lets someone continue work with a different agent or on a different computer without rebuilding the context and setup that made the work possible.

The first product journey is deliberately narrow:

> Start a GitHub project with a coding agent, then continue it inside Muse with the relevant context, capabilities, and a safe setup plan.

This repository is currently in its requirements and feasibility phase. Product scope, terminology, architecture, security constraints, and success criteria live in [`docs/`](./docs/).

## Product principles

- The user can inspect and revoke everything shared with an assistant.
- Capabilities are portable; raw credentials are not.
- Context is retrieved progressively instead of injected wholesale.
- The core contract is assistant-independent even while Muse is the first destination.
- Deterministic code owns permissions, installation, and execution. Jev supplies narrow semantic judgments.
- The interoperability layer is open; the hosted product earns revenue through secure convenience.

## Current status

No application code has been scaffolded yet. Read [`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md) for the active state and next actions.
