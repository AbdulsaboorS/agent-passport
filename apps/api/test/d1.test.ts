import { readFile } from "node:fs/promises";
import { URL as NodeUrl } from "node:url";

import { projectFixture } from "@agent-passport/fixtures";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { D1PassportStore, PassportService, createPassportApp } from "../src/index.js";
import {
  bearer,
  connectionToken,
  createTestIdentity,
  ownerToken,
  publish,
  registerIdentity,
} from "./support.js";

describe("D1 relay adapter", () => {
  let miniflare: Miniflare;

  beforeEach(async () => {
    miniflare = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: { DB: crypto.randomUUID() },
    });
    const database = await miniflare.getD1Database("DB");

    const migration = await readFile(
      new NodeUrl("../../../d1/migrations/0001_relay_identity_and_shares.sql", import.meta.url),
      "utf8",
    );

    await database.batch(
      migration
        .split(";")
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0)
        .map((statement) => database.prepare(statement)),
    );
  });

  afterEach(async () => {
    await miniflare.dispose();
  });

  it("persists signed authorization and enforces immediate revocation through the relay", async () => {
    const now = new Date("2026-09-21T00:00:00.000Z");
    const database = await miniflare.getD1Database("DB");
    const store = new D1PassportStore(database);
    const service = new PassportService({ store, now: () => now });
    const app = createPassportApp({ service, store, now: () => now });
    const identity = await createTestIdentity();

    expect((await registerIdentity(app, identity, now)).status).toBe(201);
    const connection = await connectionToken(identity, now);
    expect((await publish(app, identity, connection, now)).status).toBe(201);

    const read = await app.request(`/v1/projects/${projectFixture.id}`, {
      headers: bearer(connection),
    });

    expect(read.status).toBe(200);

    const revoke = await app.request(`/v1/projects/${projectFixture.id}/revoke`, {
      method: "POST",
      headers: bearer(await ownerToken(identity, now)),
      body: JSON.stringify({ reason: "D1 revocation proof" }),
    });

    expect(revoke.status).toBe(204);

    const replay = await app.request(`/v1/projects/${projectFixture.id}`, {
      headers: bearer(connection),
    });

    expect(replay.status).toBe(410);
  });
});
