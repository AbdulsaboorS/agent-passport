# Architecture and technology stack

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
- **Agent surface:** official Model Context Protocol TypeScript SDK plus HTTPS/OpenAPI
- **Semantic judgments:** TypeSafe's JavaScript SDK, called only from trusted server-side code
- **Testing:** Vitest for modules and contracts; Playwright for critical browser journeys
- **Quality:** Biome, strict compiler options, dependency boundaries, and CI checks
- **Hosting:** Vercel for the Next.js web surface, Cloudflare Workers for the connector API, and Supabase for durable data

Dependency versions belong in lockfiles and package manifests, not this document. Scaffolding should select current stable releases and pin them through the lockfile.

## Planned module layout

```text
apps/
  web/             dashboard, landing page, previews, and connection controls
  api/             HTTPS, OpenAPI, OAuth, and MCP delivery surfaces
  cli/             capture, local inspection, publishing, and bootstrap commands
packages/
  domain/          versioned schemas, invariants, and domain operations
  fixtures/        representative passport and handoff states for UI and tests
  ui/              design tokens and reusable UI modules
  intelligence/    Jev questions and deterministic composition
  sdk/             typed client for Agent Passport consumers
supabase/
  migrations/      database schema and row-level security
```

## Module seams

The domain module owns meaning and validation. Web, API, CLI, persistence, MCP, and Muse-specific code are adapters around that seam.

The connector API exposes a small set of use cases rather than raw database records:

- list authorized Projects
- retrieve a compact Project brief
- retrieve the current Handoff
- search authorized Project context
- retrieve a Setup Plan
- report Runtime readiness

Persistence schemas and assistant-specific payloads must not become the domain interface.

## Jev boundary

Jev may classify candidate context, score relevance, detect semantic sensitivity, judge Capability portability, and identify conflicting or stale claims. Code performs candidate discovery, authorization, secret exclusion, schema validation, threshold policy, persistence, and all side effects.

Jev is text-only and does not generate visual assets, layouts, prose, or animations. UI personalization using Jev is deferred until a concrete user decision benefits from a typed judgment.

## Visual asset boundary

The MVP uses browser-native motion, SVG, and CSS. If the brand direction proves that a 3D passport object materially improves the experience, Blender may author a compressed glTF asset consumed by the web application. Blender is an asset tool, not a Runtime dependency.
