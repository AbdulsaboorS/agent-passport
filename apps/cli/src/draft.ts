import { PassportBundleSchema, type PassportBundle } from "@agent-passport/api";

export type RepositoryState = {
  readonly activeBranch: string;
  readonly revision: string;
  readonly capturedAt: string;
};

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password)\s*[:=]\s*["']?[^\s,"']+/i,
] as const;

export function assertNoSecretLikeContent(value: PassportBundle): void {
  const serialized = JSON.stringify(value);

  if (secretPatterns.some((pattern) => pattern.test(serialized))) {
    throw new Error("Capture rejected content that resembles a raw credential.");
  }
}

export function captureDraft(input: PassportBundle, repository: RepositoryState): PassportBundle {
  const parsed = PassportBundleSchema.parse(input);
  assertNoSecretLikeContent(parsed);

  const expiresAt = new Date(
    Date.parse(repository.capturedAt) + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Every capture is a new Handoff version, so the relay can tell it apart from the one it serves.
  const handoffId = crypto.randomUUID();

  const handoff = {
    ...parsed.handoff,
    id: handoffId,
    status: "draft" as const,
    provenance: {
      ...parsed.handoff.provenance,
      capturedAt: repository.capturedAt,
      reference: `git:${repository.activeBranch}@${repository.revision}`,
    },
    createdAt: repository.capturedAt,
    expiresAt,
  };

  delete handoff.approvedAt;
  delete handoff.revokedAt;

  return PassportBundleSchema.parse({
    ...parsed,
    project: {
      ...parsed.project,
      repository: {
        ...parsed.project.repository,
        activeBranch: repository.activeBranch,
        revision: repository.revision,
      },
      provenance: {
        ...parsed.project.provenance,
        capturedAt: repository.capturedAt,
        reference: `git:${repository.activeBranch}@${repository.revision}`,
      },
      updatedAt: repository.capturedAt,
    },
    handoff,
    setupPlan: { ...parsed.setupPlan, handoffId },
  });
}

export function validateDraft(input: PassportBundle): PassportBundle {
  const bundle = PassportBundleSchema.parse(input);
  assertNoSecretLikeContent(bundle);

  return bundle;
}

export function previewDraft(input: PassportBundle): string {
  return `${JSON.stringify(validateDraft(input), null, 2)}\n`;
}

export function approveDraft(input: PassportBundle, approvedAt: string): PassportBundle {
  const bundle = validateDraft(input);

  if (bundle.handoff.status !== "draft") {
    throw new Error("Only a draft Handoff can be approved.");
  }

  if (Date.parse(approvedAt) >= Date.parse(bundle.handoff.expiresAt)) {
    throw new Error("Approval must occur before the Handoff expires.");
  }

  return PassportBundleSchema.parse({
    ...bundle,
    handoff: {
      ...bundle.handoff,
      status: "published",
      approvedAt,
    },
  });
}
