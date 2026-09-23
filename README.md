# Agent Passport

Agent Passport lets someone continue work with a different agent or on a different computer without rebuilding the context and setup that made the work possible.

The first product journey is deliberately narrow:

> Run one install command, approve a Project Handoff locally, then continue it inside Muse with the
> relevant context, capabilities, and a safe setup plan.

This repository is in active MVP implementation. Product scope, terminology, architecture, security
constraints, and success criteria live in [`docs/`](./docs/); versioned runtime schemas and
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
- `apps/api` exposes scoped Hono/OpenAPI use cases backed by a Cloudflare D1 adapter. It verifies
  Ed25519 owner proofs and signed Connection tokens before enforcing primary-database scope, expiry,
  and revocation state.
- `apps/cli` captures one structured draft from an explicitly selected repository, screens it for
  credential-shaped content, previews and assesses it, records approval, publishes it, and retrieves
  the compact result. Its first-run identity and retrievable Connection tokens are protected by
  macOS Keychain; a private local SQLite database stores Passport and Connection metadata.
- The loopback daemon binds only to `127.0.0.1` and serves authenticated `/api` routes for local
  capture, approval, publication, Connection reveal/replacement, and revocation. It checks the
  exact Host, any supplied Origin, and a per-launch token; mutations require a matching Origin.
- The packaged local dashboard serves the Passport overview and Share preview from the daemon.
  Its production build uses live `/api` data and actions; the Vite development view uses fixtures.
- Owner-authorized Connection replacement revokes the old bearer immediately. The local route can
  shorten its lifetime; the relay rejects broader scope or expiry beyond the 24-hour/share cap.

The Worker and D1 database are deployed at
[`agent-passport-relay.feedback-signal.workers.dev`](https://agent-passport-relay.feedback-signal.workers.dev).
A live HTTP smoke test passed capture, approval, publish, authenticated Project and Handoff
retrieval, revocation, and rejection of the old Connection token. The personal Muse retrieval and
Runtime continuation proof remain. The npm package is still private, and capture still requires a
prepared Passport bundle JSON. Node 24's built-in SQLite module currently emits an
experimental-feature warning.

Muse-specific Runtime and authorization gaps remain live-POC hypotheses. Read
[`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md) and the current branch handoff for the active state.

## Local development

Install and validate the workspace:

```sh
corepack pnpm install
corepack pnpm check
corepack pnpm build
```

Apply the relay migration and start the Worker against local-only D1 state. `TYPESAFE_API_KEY` is
optional and must remain server-side; when absent or unavailable, deterministic publication still
works.

```sh
corepack pnpm --filter @agent-passport/api d1:migrate:local
corepack pnpm --filter @agent-passport/api dev
```

The CLI accepts a structured Passport bundle JSON and keeps each user-controlled stage explicit.
Assessment and publication create or reuse the protected macOS identity automatically. Publication
prints the Connection URL and its bare-token fallback.
The local database is stored under `~/Library/Application Support/Agent Passport/` with private
permissions. `node apps/cli/dist/main.js` starts the secured local dashboard and opens it on macOS;
`serve` starts it without opening a browser. The launch token is held only in page memory, so a
page reload requires reopening the dashboard from the CLI.

```sh
corepack pnpm --filter @agent-passport/cli build
node apps/cli/dist/main.js capture --repo . --input candidate.json --output draft.json
node apps/cli/dist/main.js validate --input draft.json
node apps/cli/dist/main.js preview --input draft.json
node apps/cli/dist/main.js assess --api http://localhost:8787 --input draft.json
node apps/cli/dist/main.js approve --input draft.json --output approved.json
node apps/cli/dist/main.js publish --api http://localhost:8787 --input approved.json
PASSPORT_READ_TOKEN=TOKEN_FROM_PUBLISH node apps/cli/dist/main.js retrieve --api http://localhost:8787 --project PROJECT_UUID
node apps/cli/dist/main.js revoke --api http://localhost:8787 --project PROJECT_UUID
```
