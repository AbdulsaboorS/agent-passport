import { describe, expect, it } from "vitest";

import { CapabilitySchema, ConnectionSchema, HandoffSchema } from "../src/index.js";

describe("security-sensitive boundaries", () => {
  it("rejects credential fields in a capability declaration", () => {
    const result = CapabilitySchema.safeParse({
      schemaVersion: "1",
      id: "11111111-1111-4111-8111-111111111111",
      kind: "cli",
      name: "GitHub CLI",
      description: "GitHub access",
      requirement: "required",
      authorization: { required: false },
      verification: { kind: "command", command: ["gh", "--version"] },
      token: "secret",
    });

    expect(result.success).toBe(false);
  });

  it("requires active connections to record when authorization occurred", () => {
    const result = ConnectionSchema.safeParse({
      schemaVersion: "1",
      id: "77777777-7777-4777-8777-777777777777",
      runtimeId: "66666666-6666-4666-8666-666666666666",
      capabilityId: "11111111-1111-4111-8111-111111111111",
      provider: "github",
      status: "active",
      authorizationMethod: "device-code",
      scopes: ["repo"],
      createdAt: "2026-09-20T19:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("requires published handoffs to be approved and expirable", () => {
    const result = HandoffSchema.safeParse({
      schemaVersion: "1",
      id: "55555555-5555-4555-8555-555555555555",
      projectId: "44444444-4444-4444-8444-444444444444",
      status: "published",
      goal: "Continue the Project",
      progress: [],
      decisions: [],
      blockers: [],
      nextActions: ["Retrieve the Handoff"],
      context: [],
      sensitivity: "internal",
      provenance: { source: "codex", capturedAt: "2026-09-20T19:00:00.000Z" },
      createdAt: "2026-09-20T19:00:00.000Z",
      expiresAt: "2026-09-20T18:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});
