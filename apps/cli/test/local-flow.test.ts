import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

import { InMemoryPassportStore, PassportService, createPassportApp } from "@agent-passport/api";
import {
  goldenPathCapabilities,
  handoffFixture,
  museRuntimeFixture,
  projectFixture,
  setupPlanFixture,
} from "@agent-passport/fixtures";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { PassportBundleSchema } from "@agent-passport/api";

import {
  InMemoryConnectionSecretStore,
  InMemoryIdentitySecretStore,
  LocalIdentityManager,
  LocalPassportStore,
  LocalPassportWorkflow,
  PassportApiClient,
  createLocalDaemonHandler,
} from "../src/index.js";

describe("secured local workflow", () => {
  it("captures a selected repository, publishes, replaces, and revokes through local routes", async () => {
    const now = new Date("2026-09-22T00:00:00.000Z");
    const relayStore = new InMemoryPassportStore();
    const service = new PassportService({ store: relayStore, now: () => now });
    const app = createPassportApp({ service, store: relayStore, now: () => now });

    const localStore = new LocalPassportStore(
      new DatabaseSync(":memory:"),
      new InMemoryConnectionSecretStore(),
    );

    const workflow = new LocalPassportWorkflow({
      store: localStore,
      identity: new LocalIdentityManager(new InMemoryIdentitySecretStore()),
      client: (url) =>
        new PassportApiClient(url, (input, init) => app.request(new Request(input, init))),
      now: () => now,
    });

    const port = 43123;
    const origin = `http://127.0.0.1:${port}`;
    const token = "high-entropy-test-token";
    const handle = createLocalDaemonHandler({ port, token, workflow, now: () => now });

    const request = (
      path: string,
      options: {
        method?: string;
        body?: unknown;
        origin?: string;
        token?: string;
        host?: string;
      } = {},
    ) => {
      const init: RequestInit = {
        method: options.method ?? "GET",
        headers: {
          Host: options.host ?? `127.0.0.1:${port}`,
          Origin: options.origin ?? origin,
          "X-Agent-Passport-Local-Token": options.token ?? token,
          "Content-Type": "application/json",
        },
      };

      if (options.body !== undefined) init.body = JSON.stringify(options.body);

      return handle(new Request(`${origin}${path}`, init));
    };

    try {
      await expect((await request("/api/dashboard")).json()).resolves.toEqual({ status: "empty" });

      const captured = await request("/api/capture", {
        method: "POST",
        body: {
          repositoryPath: resolve(process.cwd(), "../.."),
          bundle: {
            project: projectFixture,
            handoff: handoffFixture,
            capabilities: [...goldenPathCapabilities],
            runtime: museRuntimeFixture,
            setupPlan: setupPlanFixture,
          },
        },
      });

      expect(captured.status).toBe(201);
      expect(PassportBundleSchema.parse(await captured.json()).handoff.status).toBe("draft");

      const draftDashboard = z
        .object({
          status: z.literal("ready"),
          snapshot: z.object({
            identity: z.object({ keyFingerprint: z.string().length(32) }),
            bundle: PassportBundleSchema,
            repository: z.object({ revision: z.string().min(1) }),
          }),
        })
        .parse(await (await request("/api/dashboard")).json());

      expect(draftDashboard.snapshot.bundle.handoff.status).toBe("draft");

      expect(
        (await request(`/api/projects/${projectFixture.id}/approve`, { method: "POST" })).status,
      ).toBe(200);

      const published = await request(`/api/projects/${projectFixture.id}/publish`, {
        method: "POST",
        body: { relayUrl: "https://passport.test" },
      });

      expect(published.status).toBe(201);

      const result = z
        .object({ connection: z.object({ connectionId: z.uuid() }) })
        .parse(await published.json());

      const connectionId = result.connection.connectionId;

      const activeDashboard = z
        .object({
          snapshot: z.object({
            share: z.object({
              connectionId: z.uuid(),
              status: z.literal("active"),
              tokenSuffix: z.string().length(4),
            }),
          }),
        })
        .parse(await (await request("/api/dashboard")).json());

      expect(activeDashboard.snapshot.share.connectionId).toBe(connectionId);

      expect((await request("/api/projects", { token: "wrong" })).status).toBe(401);
      expect((await request("/api/projects", { host: "attacker.test" })).status).toBe(403);
      expect(
        (
          await request(`/api/projects/${projectFixture.id}/revoke`, {
            method: "POST",
            origin: "https://attacker.test",
            body: { reason: "CSRF" },
          })
        ).status,
      ).toBe(403);
      expect((await request("/api/projects")).status).toBe(200);

      const revealed = z
        .object({ connectionUrl: z.url(), token: z.string() })
        .parse(await (await request(`/api/connections/${connectionId}/reveal`)).json());

      expect(revealed.connectionUrl).toContain("#token=");
      expect(await (await request("/api/dashboard")).text()).not.toContain(revealed.token);
      expect(
        (
          await app.request(`/v1/projects/${projectFixture.id}`, {
            headers: { Authorization: `Bearer ${revealed.token}` },
          })
        ).status,
      ).toBe(200);

      const replacement = await request(`/api/connections/${connectionId}/replace`, {
        method: "POST",
        body: { lifetimeSeconds: 60 },
      });

      expect(replacement.status).toBe(201);
      expect(
        (
          await app.request(`/v1/projects/${projectFixture.id}`, {
            headers: { Authorization: `Bearer ${revealed.token}` },
          })
        ).status,
      ).toBe(410);

      const replacementId = z
        .object({ connectionId: z.uuid() })
        .parse(await replacement.json()).connectionId;

      const newToken = z
        .object({ token: z.string() })
        .parse(await (await request(`/api/connections/${replacementId}/reveal`)).json()).token;

      expect(
        (
          await app.request(`/v1/projects/${projectFixture.id}`, {
            headers: { Authorization: `Bearer ${newToken}` },
          })
        ).status,
      ).toBe(200);

      expect(
        (
          await request(`/api/projects/${projectFixture.id}/revoke`, {
            method: "POST",
            body: { reason: "Finished" },
          })
        ).status,
      ).toBe(200);
      expect((await request(`/api/connections/${replacementId}/reveal`)).status).toBe(400);

      const revokedDashboard = z
        .object({
          snapshot: z.object({ share: z.object({ status: z.literal("revoked") }) }),
        })
        .parse(await (await request("/api/dashboard")).json());

      expect(revokedDashboard.snapshot.share.status).toBe("revoked");
      expect(
        (
          await app.request(`/v1/projects/${projectFixture.id}`, {
            headers: { Authorization: `Bearer ${newToken}` },
          })
        ).status,
      ).toBe(410);
    } finally {
      localStore.close();
    }
  });
});
