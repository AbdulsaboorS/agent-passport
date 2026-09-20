import type { Runtime } from "@agent-passport/domain";

import type { AccessScope, PassportBundle } from "./contracts.js";

export type AccessGrantSeed = {
  readonly token: string;
  readonly connectionId: string;
  readonly scopes: readonly AccessScope[];
  readonly projectIds?: readonly string[];
  readonly expiresAt?: string;
};

type AccessGrant = {
  connectionId: string;
  scopes: AccessScope[];
  projectIds?: string[];
  expiresAt?: string;
  tokenDigest: string;
  revokedAt?: string;
};

async function digestToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class InMemoryPassportStore {
  readonly #bundles = new Map<string, PassportBundle>();
  readonly #grants = new Map<string, AccessGrant>();

  async seedGrant(seed: AccessGrantSeed): Promise<void> {
    const { projectIds, scopes, token, ...grant } = seed;
    const tokenDigest = await digestToken(token);

    const storedGrant: AccessGrant = {
      ...grant,
      tokenDigest,
      scopes: [...scopes],
    };

    if (projectIds !== undefined) {
      storedGrant.projectIds = [...projectIds];
    }

    this.#grants.set(tokenDigest, storedGrant);
  }

  publish(bundle: PassportBundle): void {
    this.#bundles.set(bundle.project.id, structuredClone(bundle));
  }

  listProjectIds(): string[] {
    return [...this.#bundles.keys()];
  }

  get(projectId: string): PassportBundle | undefined {
    const bundle = this.#bundles.get(projectId);

    return bundle === undefined ? undefined : structuredClone(bundle);
  }

  updateRuntime(projectId: string, runtime: Runtime): void {
    const bundle = this.#bundles.get(projectId);

    if (bundle !== undefined) {
      this.#bundles.set(projectId, { ...bundle, runtime: structuredClone(runtime) });
    }
  }

  revokeProject(projectId: string, revokedAt: string): void {
    const bundle = this.#bundles.get(projectId);

    if (bundle !== undefined) {
      this.#bundles.set(projectId, {
        ...bundle,
        handoff: {
          ...bundle.handoff,
          status: "revoked",
          revokedAt,
        },
      });
    }

    for (const grant of this.#grants.values()) {
      if (
        grant.projectIds?.includes(projectId) === true &&
        !grant.scopes.includes("project:write")
      ) {
        grant.revokedAt = revokedAt;
      }
    }
  }

  async authorize(
    token: string,
    scope: AccessScope,
    projectId: string | undefined,
    now: Date,
  ): Promise<"authorized" | "expired" | "forbidden" | "revoked" | "unknown"> {
    const grant = this.#grants.get(await digestToken(token));

    if (grant === undefined) {
      return "unknown";
    }

    if (grant.revokedAt !== undefined) {
      return "revoked";
    }

    if (grant.expiresAt !== undefined && Date.parse(grant.expiresAt) <= now.getTime()) {
      return "expired";
    }

    if (!grant.scopes.includes(scope)) {
      return "forbidden";
    }

    if (
      projectId !== undefined &&
      grant.projectIds !== undefined &&
      !grant.projectIds.includes(projectId)
    ) {
      return "forbidden";
    }

    return "authorized";
  }
}
