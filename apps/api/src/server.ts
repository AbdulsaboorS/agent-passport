import {
  goldenPathCapabilities,
  handoffFixture,
  museRuntimeFixture,
  projectFixture,
  setupPlanFixture,
} from "@agent-passport/fixtures";
import { JevCaptureAssessor, TypeSafeJevEvaluator } from "@agent-passport/intelligence";
import { serve } from "@hono/node-server";

import { createPassportApp } from "./app.js";
import { PassportService } from "./service.js";
import { InMemoryPassportStore } from "./store.js";

const store = new InMemoryPassportStore();

const publishToken = process.env.PASSPORT_PUBLISH_TOKEN;

const readToken = process.env.PASSPORT_READ_TOKEN;

if (publishToken === undefined || readToken === undefined) {
  throw new Error("PASSPORT_PUBLISH_TOKEN and PASSPORT_READ_TOKEN are required.");
}

await store.seedGrant({
  token: publishToken,
  connectionId: "local-publisher",
  scopes: ["project:write"],
});

await store.seedGrant({
  token: readToken,
  connectionId: "local-reader",
  scopes: ["project:read", "handoff:read", "setup-plan:read", "readiness:write"],
  projectIds: [projectFixture.id],
});

const assessor =
  process.env.TYPESAFE_API_KEY === undefined
    ? undefined
    : new JevCaptureAssessor(new TypeSafeJevEvaluator());

const service =
  assessor === undefined
    ? new PassportService({ store })
    : new PassportService({ store, assessor });

const app = createPassportApp({ service, store });

store.publish({
  project: projectFixture,
  handoff: handoffFixture,
  capabilities: [...goldenPathCapabilities],
  runtime: museRuntimeFixture,
  setupPlan: setupPlanFixture,
});

const port = Number.parseInt(process.env.PORT ?? "8787", 10);

serve({ fetch: app.fetch, port });

process.stdout.write(`Agent Passport API listening on http://localhost:${port}\n`);
