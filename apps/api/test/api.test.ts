import { HandoffSchema, SetupPlanSchema } from "@agent-passport/domain";
import {
  goldenPathCapabilities,
  handoffFixture,
  museRuntimeFixture,
  projectFixture,
  setupPlanFixture,
} from "@agent-passport/fixtures";
import type { CaptureAssessor } from "@agent-passport/intelligence";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  MAX_COMPACT_RESPONSE_TOKENS,
  MAX_DEFAULT_CONTEXT_TOKENS,
  PassportService,
  ProjectBriefSchema,
  createPassportApp,
  estimateJsonTokens,
  type PassportBundle,
  InMemoryPassportStore,
} from "../src/index.js";

const now = () => new Date("2026-09-21T00:00:00.000Z");

const publishToken = "publish-test-token";

const readToken = "read-test-token";

const bundle: PassportBundle = {
  project: projectFixture,
  handoff: handoffFixture,
  capabilities: [...goldenPathCapabilities],
  runtime: museRuntimeFixture,
  setupPlan: setupPlanFixture,
};

const PublishResponseSchema = z.object({ project: ProjectBriefSchema });

const ProjectListResponseSchema = z.object({ projects: z.array(ProjectBriefSchema) });

const AssessmentResponseSchema = z.object({
  status: z.literal("complete"),
  assessment: z.object({ model: z.string() }),
});

const OpenApiDocumentSchema = z.object({
  paths: z.record(z.string(), z.object({}).passthrough()),
});

async function testApp(assessor?: CaptureAssessor) {
  const store = new InMemoryPassportStore();
  await store.seedGrant({
    token: publishToken,
    connectionId: "publisher",
    scopes: ["project:write"],
  });
  await store.seedGrant({
    token: readToken,
    connectionId: "reader",
    scopes: ["project:read", "handoff:read", "setup-plan:read", "readiness:write"],
    projectIds: [projectFixture.id],
    expiresAt: "2026-09-22T00:00:00.000Z",
  });

  const service =
    assessor === undefined
      ? new PassportService({ store, now })
      : new PassportService({ store, now, assessor });

  return { app: createPassportApp({ service, store, now }), service, store };
}

function requestHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

describe("Passport HTTPS interface", () => {
  let subject: Awaited<ReturnType<typeof testApp>>;

  beforeEach(async () => {
    subject = await testApp();
  });

  it("publishes, lists, and progressively retrieves an approved Passport", async () => {
    const publishResponse = await subject.app.request(`/v1/projects/${projectFixture.id}/publish`, {
      method: "POST",
      headers: requestHeaders(publishToken),
      body: JSON.stringify({ bundle, approved: true }),
    });

    expect(publishResponse.status).toBe(201);
    expect(PublishResponseSchema.parse(await publishResponse.json()).project.id).toBe(
      projectFixture.id,
    );

    const listResponse = await subject.app.request("/v1/projects", {
      headers: requestHeaders(readToken),
    });

    expect(listResponse.status).toBe(200);
    const list = ProjectListResponseSchema.parse(await listResponse.json());
    expect(list.projects).toHaveLength(1);
    expect(estimateJsonTokens(list)).toBeLessThanOrEqual(MAX_COMPACT_RESPONSE_TOKENS);
    const listedProject = list.projects[0];

    if (listedProject === undefined) {
      throw new Error("Expected one authorized Project.");
    }

    const handoffResponse = await subject.app.request(`/v1/projects/${projectFixture.id}/handoff`, {
      headers: requestHeaders(readToken),
    });

    expect(handoffResponse.status).toBe(200);
    const handoff = HandoffSchema.parse(await handoffResponse.json());
    expect(handoff.id).toBe(handoffFixture.id);
    expect(estimateJsonTokens({ project: listedProject, handoff })).toBeLessThanOrEqual(
      MAX_DEFAULT_CONTEXT_TOKENS,
    );

    const setupPlanResponse = await subject.app.request(
      `/v1/projects/${projectFixture.id}/setup-plan`,
      { headers: requestHeaders(readToken) },
    );

    expect(setupPlanResponse.status).toBe(200);
    expect(SetupPlanSchema.parse(await setupPlanResponse.json()).id).toBe(setupPlanFixture.id);
  });

  it("returns a Jev assessment as pre-publication review evidence", async () => {
    const assessor: CaptureAssessor = {
      assess: async () => ({
        model: "jev-test",
        judgments: {
          relevant: 0.95,
          sensitivityMismatch: 0.1,
          portable: 0.91,
          conflicting: 0.05,
          stale: 0.08,
        },
        warnings: [],
      }),
    };

    subject = await testApp(assessor);

    const response = await subject.app.request(`/v1/projects/${projectFixture.id}/assess`, {
      method: "POST",
      headers: requestHeaders(publishToken),
      body: JSON.stringify({ project: bundle.project, handoff: bundle.handoff }),
    });

    expect(response.status).toBe(200);
    expect(AssessmentResponseSchema.parse(await response.json()).assessment.model).toBe("jev-test");
  });

  it("reports Jev as unavailable without blocking deterministic publication", async () => {
    subject = await testApp({
      assess: async () => {
        throw new Error("service unavailable");
      },
    });

    const assessment = await subject.app.request(`/v1/projects/${projectFixture.id}/assess`, {
      method: "POST",
      headers: requestHeaders(publishToken),
      body: JSON.stringify({ project: bundle.project, handoff: bundle.handoff }),
    });

    expect(await assessment.json()).toEqual({ status: "unavailable", assessment: null });

    const publish = await subject.app.request(`/v1/projects/${projectFixture.id}/publish`, {
      method: "POST",
      headers: requestHeaders(publishToken),
      body: JSON.stringify({ bundle, approved: true }),
    });

    expect(publish.status).toBe(201);
  });

  it("enforces authentication and Project scope", async () => {
    subject.store.publish(bundle);

    const missing = await subject.app.request(`/v1/projects/${projectFixture.id}`);
    expect(missing.status).toBe(401);

    const wrongScope = await subject.app.request(`/v1/projects/${projectFixture.id}/handoff`, {
      headers: requestHeaders(publishToken),
    });

    expect(wrongScope.status).toBe(403);

    const otherProject = await subject.app.request(
      "/v1/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      { headers: requestHeaders(readToken) },
    );

    expect(otherProject.status).toBe(403);
  });

  it("enforces Connection expiry", async () => {
    subject.store.publish(bundle);
    await subject.store.seedGrant({
      token: "expired-token",
      connectionId: "expired",
      scopes: ["project:read"],
      projectIds: [projectFixture.id],
      expiresAt: "2026-09-20T23:59:59.000Z",
    });

    const response = await subject.app.request(`/v1/projects/${projectFixture.id}`, {
      headers: requestHeaders("expired-token"),
    });

    expect(response.status).toBe(410);
  });

  it("revokes the share and its scoped read Connection", async () => {
    subject.store.publish(bundle);

    const revoke = await subject.app.request(`/v1/projects/${projectFixture.id}/revoke`, {
      method: "POST",
      headers: requestHeaders(publishToken),
      body: JSON.stringify({ reason: "POC complete" }),
    });

    expect(revoke.status).toBe(204);

    const read = await subject.app.request(`/v1/projects/${projectFixture.id}`, {
      headers: requestHeaders(readToken),
    });

    expect(read.status).toBe(410);
  });

  it("publishes an OpenAPI contract for every MVP use case", async () => {
    const response = await subject.app.request("/openapi.json");
    const document = OpenApiDocumentSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        "/v1/projects",
        "/v1/projects/{projectId}/assess",
        "/v1/projects/{projectId}",
        "/v1/projects/{projectId}/handoff",
        "/v1/projects/{projectId}/setup-plan",
        "/v1/projects/{projectId}/readiness",
        "/v1/projects/{projectId}/revoke",
      ]),
    );
  });
});
