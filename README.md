# Agent Passport

Agent Passport lets someone continue work with a different agent or on a different computer without rebuilding the context and setup that made the work possible.

The first product journey is deliberately narrow:

> Run one install command, approve a Project Handoff locally, then continue it inside Muse with the
> relevant context, capabilities, and a safe setup plan.

This repository is in its first MVP contract slice. Product scope, terminology, architecture,
security constraints, and success criteria live in [`docs/`](./docs/); versioned runtime schemas and
representative fixtures live in [`packages/domain`](./packages/domain) and
[`packages/fixtures`](./packages/fixtures).

## Product principles

- The user can inspect and revoke everything shared with an assistant.
- The Passport, dashboard, and identity begin locally; the MVP has no sign-up or account.
- Capabilities are portable; raw credentials are not.
- Context is retrieved progressively instead of injected wholesale.
- The core contract is assistant-independent even while Muse is the first destination.
- Deterministic code owns permissions, installation, and execution. Jev supplies optional,
  typed pre-publication judgments; its warnings never authorize, block, or perform side effects.
- The interoperability layer is open; the hosted product earns revenue through secure convenience.

## Current status

The local vertical slice is implemented:

- `packages/domain` owns strict version-1 contracts and lifecycle invariants.
- `packages/intelligence` asks pinned Jev questions about relevance, sensitivity, portability,
  conflicts, and staleness.
- `apps/api` exposes scoped Hono/OpenAPI use cases with in-memory persistence, hashed test tokens,
  expiry, revocation, compact responses, and Runtime readiness reporting.
- `apps/cli` captures one structured draft from an explicitly selected repository, screens it for
  credential-shaped content, previews and assesses it, records approval, publishes it, and retrieves
  the compact result.

ADR-0003 now sets the target architecture: `npx agent-passport` will run a loopback daemon and local
dashboard backed by a first-run identity keypair, while the hosted API shrinks to a D1-backed relay
for signed, scoped, expiring, revocable shares. The current in-memory bearer-token slice predates that
decision and is the migration baseline, not the final identity design.

Muse-specific Runtime and authorization gaps remain live-POC hypotheses. Read
[`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md) and the current branch handoff for the active state.

## Local development

Install and validate the workspace:

```sh
corepack pnpm install
corepack pnpm check
corepack pnpm build
```

Start the local API with separate POC tokens. `TYPESAFE_API_KEY` is optional and must remain
server-side; when absent or unavailable, the assessment endpoint reports that state and the
deterministic publish path continues to work.

```sh
PASSPORT_PUBLISH_TOKEN=local-publisher \
PASSPORT_READ_TOKEN=local-reader \
TYPESAFE_API_KEY=optional-server-key \
corepack pnpm --filter @agent-passport/api dev
```

The CLI accepts a structured Passport bundle JSON and keeps each user-controlled stage explicit:

```sh
corepack pnpm --filter @agent-passport/cli build
node apps/cli/dist/main.js capture --repo . --input candidate.json --output draft.json
node apps/cli/dist/main.js validate --input draft.json
node apps/cli/dist/main.js preview --input draft.json
PASSPORT_PUBLISH_TOKEN=local-publisher node apps/cli/dist/main.js assess --api http://localhost:8787 --input draft.json
node apps/cli/dist/main.js approve --input draft.json --output approved.json
PASSPORT_PUBLISH_TOKEN=local-publisher node apps/cli/dist/main.js publish --api http://localhost:8787 --input approved.json
PASSPORT_READ_TOKEN=local-reader node apps/cli/dist/main.js retrieve --api http://localhost:8787 --project PROJECT_UUID
```
