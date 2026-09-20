# Use a TypeScript monorepo with portable domain contracts

Agent Passport will use a pnpm and Turborepo TypeScript monorepo, with versioned Zod contracts in a domain module consumed by the web, API, CLI, MCP, persistence, fixtures, and assistant adapters. This keeps the portability contract independent of Muse and lets parallel UI and MVP work share one validated language without duplicating payload types.

The web surface will use Next.js, the connector surface will use Hono on Cloudflare Workers, and durable identity and data will use Supabase. These separate deployment surfaces add operational pieces, but they keep the dashboard optimized for product UI and the connector optimized for portable HTTPS, OpenAPI, and MCP delivery.
