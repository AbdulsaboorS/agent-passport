import type { Runtime } from "@agent-passport/domain";

import type { ConnectionTokenClaims, Ed25519PublicKey, PassportBundle } from "./contracts.js";

export type StoredIdentity = {
  readonly id: string;
  readonly publicKey: Ed25519PublicKey;
  readonly createdAt: string;
};

export type StoredShare = {
  readonly id: string;
  readonly identityId: string;
  readonly projectId: string;
  readonly handoffId: string;
  readonly expiresAt: string;
  readonly bundle: PassportBundle;
  readonly createdAt: string;
  readonly revokedAt?: string;
};

export type StoredConnectionGrant = {
  readonly tokenId: string;
  readonly connectionId: string;
  readonly identityId: string;
  readonly shareId: string;
  readonly projectId: string;
  readonly scopes: ConnectionTokenClaims["scope"];
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly revokedAt?: string;
};

export type AuthorizationRecord = {
  readonly identity: StoredIdentity;
  readonly share: StoredShare;
  readonly grant: StoredConnectionGrant;
};

export type PublishShareInput = {
  readonly share: StoredShare;
  readonly grant: StoredConnectionGrant;
};

export class PassportStoreConflictError extends Error {}

export interface PassportStore {
  registerIdentity(identity: StoredIdentity): Promise<void>;
  getIdentity(identityId: string): Promise<StoredIdentity | undefined>;
  publish(input: PublishShareInput): Promise<void>;
  get(projectId: string): Promise<PassportBundle | undefined>;
  getShare(projectId: string): Promise<StoredShare | undefined>;
  getAuthorization(tokenId: string): Promise<AuthorizationRecord | undefined>;
  replaceGrant(
    oldTokenId: string,
    grant: StoredConnectionGrant,
    revokedAt: string,
  ): Promise<boolean>;
  updateRuntime(projectId: string, runtime: Runtime): Promise<void>;
  revokeProject(projectId: string, identityId: string, revokedAt: string): Promise<boolean>;
}

export class InMemoryPassportStore implements PassportStore {
  readonly #identities = new Map<string, StoredIdentity>();
  readonly #shares = new Map<string, StoredShare>();
  readonly #projectShares = new Map<string, string>();
  readonly #grants = new Map<string, StoredConnectionGrant>();

  async registerIdentity(identity: StoredIdentity): Promise<void> {
    const existing = this.#identities.get(identity.id);

    if (
      existing !== undefined &&
      JSON.stringify(existing.publicKey) !== JSON.stringify(identity.publicKey)
    ) {
      throw new PassportStoreConflictError("Identity key does not match its existing record.");
    }

    this.#identities.set(identity.id, structuredClone(identity));
  }

  async getIdentity(identityId: string): Promise<StoredIdentity | undefined> {
    const identity = this.#identities.get(identityId);

    return identity === undefined ? undefined : structuredClone(identity);
  }

  async publish(input: PublishShareInput): Promise<void> {
    if (this.#identities.get(input.share.identityId) === undefined) {
      throw new PassportStoreConflictError("Publishing identity is not registered.");
    }

    if (
      this.#shares.has(input.share.id) ||
      this.#projectShares.has(input.share.projectId) ||
      this.#grants.has(input.grant.tokenId)
    ) {
      throw new PassportStoreConflictError("Share or Connection already exists.");
    }

    this.#shares.set(input.share.id, structuredClone(input.share));
    this.#projectShares.set(input.share.projectId, input.share.id);
    this.#grants.set(input.grant.tokenId, structuredClone(input.grant));
  }

  async get(projectId: string): Promise<PassportBundle | undefined> {
    const share = await this.getShare(projectId);

    return share === undefined ? undefined : structuredClone(share.bundle);
  }

  async getShare(projectId: string): Promise<StoredShare | undefined> {
    const shareId = this.#projectShares.get(projectId);
    const share = shareId === undefined ? undefined : this.#shares.get(shareId);

    return share === undefined ? undefined : structuredClone(share);
  }

  async getAuthorization(tokenId: string): Promise<AuthorizationRecord | undefined> {
    const grant = this.#grants.get(tokenId);

    if (grant === undefined) {
      return undefined;
    }

    const share = this.#shares.get(grant.shareId);
    const identity = this.#identities.get(grant.identityId);

    if (share === undefined || identity === undefined) {
      return undefined;
    }

    return structuredClone({ identity, share, grant });
  }

  async replaceGrant(
    oldTokenId: string,
    grant: StoredConnectionGrant,
    revokedAt: string,
  ): Promise<boolean> {
    const old = this.#grants.get(oldTokenId);
    const share = old === undefined ? undefined : this.#shares.get(old.shareId);

    if (
      old === undefined ||
      share === undefined ||
      old.revokedAt !== undefined ||
      share.revokedAt !== undefined ||
      old.identityId !== grant.identityId ||
      old.projectId !== grant.projectId ||
      old.shareId !== grant.shareId ||
      this.#grants.has(grant.tokenId)
    ) {
      return false;
    }

    this.#grants.set(oldTokenId, { ...old, revokedAt });
    this.#grants.set(grant.tokenId, structuredClone(grant));

    return true;
  }

  async updateRuntime(projectId: string, runtime: Runtime): Promise<void> {
    const shareId = this.#projectShares.get(projectId);
    const share = shareId === undefined ? undefined : this.#shares.get(shareId);

    if (share !== undefined) {
      this.#shares.set(share.id, {
        ...share,
        bundle: { ...share.bundle, runtime: structuredClone(runtime) },
      });
    }
  }

  async revokeProject(projectId: string, identityId: string, revokedAt: string): Promise<boolean> {
    const shareId = this.#projectShares.get(projectId);
    const share = shareId === undefined ? undefined : this.#shares.get(shareId);

    if (share === undefined || share.identityId !== identityId) {
      return false;
    }

    this.#shares.set(share.id, {
      ...share,
      revokedAt,
      bundle: {
        ...share.bundle,
        handoff: { ...share.bundle.handoff, status: "revoked", revokedAt },
      },
    });

    for (const [tokenId, grant] of this.#grants) {
      if (grant.shareId === share.id) {
        this.#grants.set(tokenId, { ...grant, revokedAt });
      }
    }

    return true;
  }
}
