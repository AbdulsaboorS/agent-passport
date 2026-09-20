# Architecture and technology stack

## Product architecture

Agent Passport is an assistant-independent continuity hub with adapters at its edges:

```text
Source Agent -> capture adapter -> Passport core -> retrieval interface -> destination adapter -> Runtime
                                      |     |
                                      |     +-> readiness and Setup Plan
                                      +-> identity, sharing, and persistence
```

- A **source adapter** turns explicitly selected Project evidence into a typed draft. Codex is first.
- The **Passport core** validates contracts, enforces lifecycle and sharing policy, excludes secrets,
  produces compact views, and derives Setup Plans from Capability declarations and Runtime evidence.
- The **retrieval interface** exposes assistant-neutral use cases over authenticated HTTPS.
- A **destination adapter** maps one assistant's connector model onto that interface. Muse is first.
- A **Runtime** establishes its own Connections and reports evidence; credentials never cross the core contract.

Adding another personal assistant means adding an adapter or protocol mapping, not changing Project,
Handoff, Capability, Runtime, Connection, or Setup Plan.

## How the promise is executed

1. **Capture:** the Source Agent CLI reads only the selected repository and agent-authored handoff
   inputs, then validates a draft against the versioned domain schemas.
2. **Preview:** the person sees exactly what context and Capability declarations will be shared.
3. **Publish:** approval creates an immutable Handoff version and an expirable, revocable Project share.
4. **Retrieve:** a destination Connection lists authorized Projects, gets a compact brief and current
   Handoff, and follows handles only when deeper context is needed.
5. **Prepare:** deterministic code compares declared Capabilities with evidence reported by the Runtime
   and returns a declarative Setup Plan. It never assumes installation or authorization succeeded.
6. **Authorize:** the person completes destination-side provider flows; Agent Passport records status,
   scope, storage mode, freshness, and revocation evidence, never the credential.
7. **Continue:** the destination launches the selected coding agent with the approved Handoff and
   retrieves more context on demand.

## MVP module seams

The MVP keeps three deep modules and thin adapters:

- `packages/domain`: versioned schemas, lifecycle rules, compact views, and deterministic Setup Plan
  inspection. This is the portable contract and has no framework, persistence, or Muse dependency.
- `apps/api`: the Passport use-case module. Its small external interface lists authorized Projects,
  retrieves briefs/Handoffs/Setup Plans, publishes approved Handoffs, reports readiness, and revokes
  shares. Hono is its HTTP adapter; persistence and authentication are internal seams.
- `apps/cli`: the first source adapter. It captures, validates, previews, approves, publishes, and can
  retrieve the result for a local end-to-end proof.

`apps/web` supplies the durable preview, approval, and connection controls once the local vertical
slice works. `packages/sdk`, MCP delivery, and additional destination adapters are added only when a
second real caller makes those seams concrete.

## Fastest execution path

1. **Local vertical slice:** Hono plus an in-memory adapter serves the approved fixtures through scoped
   HTTPS use cases; the CLI performs capture -> preview -> publish -> retrieve.
2. **Destination proof:** a Muse custom connector calls that same interface. Run the live Runtime,
   installation, authorization, persistence, and revocation probes before claiming readiness.
3. **Durable MVP:** replace only the internal persistence/auth adapters with Supabase, add the minimal
   web approval/revocation surfaces, and deploy the existing Hono interface.
4. **Expansion:** add MCP, SDK packaging, additional measured Jev judgments, and more Destination
   Assistant adapters without changing the core contract.

## Stack

- **Language:** strict TypeScript across web, API, CLI, contracts, and tests
- **Workspace:** pnpm workspaces with Turborepo
- **Web:** Next.js and React
- **Styling:** Tailwind CSS with accessible headless primitives
- **Motion:** Motion for React plus CSS and SVG; Rive may be evaluated for one branded interactive asset
- **Connector API:** Hono on Cloudflare Workers
- **Contracts:** Zod as the runtime source of truth, inferred TypeScript types, and generated JSON Schema/OpenAPI
- **Persistence and identity:** Supabase Postgres, Auth, Storage, migrations, and row-level security
- **CLI:** Node.js TypeScript with a small command interface and guided prompts
- **Agent surface:** authenticated HTTPS/OpenAPI first; official Model Context Protocol TypeScript SDK as a later adapter
- **Semantic judgments:** TypeSafe's JavaScript SDK, called only from trusted server-side code
- **Testing:** Vitest for modules and contracts; Playwright for critical browser journeys
- **Quality:** Oxlint with vendored Anti-Slop for lint policy, Biome for formatting only, strict compiler options, dependency boundaries, and CI checks
- **Hosting:** Vercel for the Next.js web surface, Cloudflare Workers for the connector API, and Supabase for durable data

Dependency versions belong in lockfiles and package manifests, not this document. Scaffolding should select current stable releases and pin them through the lockfile.

## Planned module layout

```text
apps/
  web/             dashboard, landing page, previews, and connection controls
  api/             Passport use cases, authenticated HTTPS/OpenAPI, and internal adapters
  cli/             capture, local inspection, publishing, and bootstrap commands
packages/
  domain/          versioned schemas, invariants, and domain operations
  fixtures/        representative passport and handoff states for UI and tests
  ui/              design tokens and reusable UI modules
  intelligence/    optional evaluated Jev questions and deterministic composition
  sdk/             typed client added when a second real caller needs it
supabase/
  migrations/      database schema and row-level security
```

## Retrieval use cases

The domain module owns meaning and validation. Web, HTTP, CLI, persistence, MCP, and
assistant-specific code are adapters around its seam.

The connector API exposes a small set of use cases rather than raw database records:

- list authorized Projects
- retrieve a compact Project brief
- retrieve the current Handoff
- retrieve a Setup Plan
- report Runtime readiness
- revoke a Project share

Context search is added after compact brief, Handoff, and handle-based retrieval prove insufficient.

Persistence schemas and assistant-specific payloads must not become the domain interface.

## Jev boundary

Jev may classify candidate context, score relevance, detect semantic sensitivity, judge Capability portability, and identify conflicting or stale claims. Code performs candidate discovery, authorization, secret exclusion, schema validation, threshold policy, persistence, and all side effects.

Jev is expected to be strategically important to capture quality, but it does not control transport,
authorization, policy, publication, or side effects. The local slice exposes a pre-publication pilot
for relevance, sensitivity, portability, conflict, and staleness judgments using a pinned model.
Assessment failure is explicit and never prevents the deterministic workflow. Retain each judgment
only where representative evaluations show a material improvement over the baseline.

Jev is text-only and does not generate visual assets, layouts, prose, or animations. UI personalization using Jev is deferred until a concrete user decision benefits from a typed judgment.

## Visual asset boundary

The MVP uses browser-native motion, SVG, and CSS. If the brand direction proves that a 3D passport object materially improves the experience, Blender may author a compressed glTF asset consumed by the web application. Blender is an asset tool, not a Runtime dependency.
