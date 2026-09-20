import {
  HandoffSchema,
  inspectSetupPlan,
  RuntimeSchema,
  type Runtime,
} from "@agent-passport/domain";
import type { CaptureAssessment, CaptureAssessor } from "@agent-passport/intelligence";

import {
  MAX_COMPACT_RESPONSE_TOKENS,
  PassportBundleSchema,
  estimateJsonTokens,
  type PassportBundle,
  type ProjectBrief,
} from "./contracts.js";
import { InMemoryPassportStore } from "./store.js";

export type ServiceErrorCode =
  | "expired"
  | "forbidden"
  | "invalid"
  | "not_found"
  | "revoked"
  | "unauthorized";

export class PassportServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export type PublishResult = {
  readonly project: ProjectBrief;
};

export type CaptureAssessmentOutcome =
  | { readonly status: "complete"; readonly assessment: CaptureAssessment }
  | { readonly status: "not_configured" | "unavailable"; readonly assessment: null };

export class PassportService {
  readonly #store: InMemoryPassportStore;
  readonly #assessor: CaptureAssessor | undefined;
  readonly #now: () => Date;

  constructor(options: {
    store: InMemoryPassportStore;
    assessor?: CaptureAssessor;
    now?: () => Date;
  }) {
    this.#store = options.store;
    this.#assessor = options.assessor;
    this.#now = options.now ?? (() => new Date());
  }

  publish(bundleInput: PassportBundle): PublishResult {
    const bundle = PassportBundleSchema.parse(bundleInput);
    this.#assertBundleRelationships(bundle);

    if (bundle.handoff.status !== "published" || bundle.handoff.approvedAt === undefined) {
      throw new PassportServiceError("invalid", "Publishing requires an approved Handoff.");
    }

    if (Date.parse(bundle.handoff.expiresAt) <= this.#now().getTime()) {
      throw new PassportServiceError("expired", "The Handoff has already expired.");
    }

    this.#store.publish(bundle);

    return { project: this.#brief(bundle) };
  }

  async assessCapture(
    bundle: Pick<PassportBundle, "project" | "handoff">,
  ): Promise<CaptureAssessmentOutcome> {
    if (bundle.handoff.projectId !== bundle.project.id) {
      throw new PassportServiceError("invalid", "Handoff does not belong to the Project.");
    }

    if (this.#assessor === undefined) {
      return { status: "not_configured", assessment: null };
    }

    try {
      return {
        status: "complete",
        assessment: await this.#assessor.assess({
          project: bundle.project,
          handoff: bundle.handoff,
        }),
      };
    } catch {
      return { status: "unavailable", assessment: null };
    }
  }

  listProjects(projectIds: readonly string[]): ProjectBrief[] {
    const projects: ProjectBrief[] = [];

    for (const projectId of projectIds) {
      const bundle = this.#store.get(projectId);

      if (bundle !== undefined && this.#isReadable(bundle)) {
        projects.push(this.#brief(bundle));
      }
    }

    return projects;
  }

  getBrief(projectId: string): ProjectBrief {
    return this.#brief(this.#requireReadable(projectId));
  }

  getHandoff(projectId: string) {
    return this.#requireReadable(projectId).handoff;
  }

  getSetupPlan(projectId: string) {
    return this.#requireReadable(projectId).setupPlan;
  }

  reportReadiness(projectId: string, runtimeInput: Runtime): Runtime {
    const bundle = this.#requireReadable(projectId);
    const runtime = RuntimeSchema.parse(runtimeInput);

    if (runtime.id !== bundle.setupPlan.runtimeId) {
      throw new PassportServiceError(
        "invalid",
        "Runtime readiness must describe the Runtime named by the Setup Plan.",
      );
    }

    this.#store.updateRuntime(projectId, runtime);

    return runtime;
  }

  revoke(projectId: string): void {
    const bundle = this.#store.get(projectId);

    if (bundle === undefined) {
      throw new PassportServiceError("not_found", "Project was not found.");
    }

    this.#store.revokeProject(projectId, this.#now().toISOString());
  }

  #requireReadable(projectId: string): PassportBundle {
    const bundle = this.#store.get(projectId);

    if (bundle === undefined) {
      throw new PassportServiceError("not_found", "Project was not found.");
    }

    if (bundle.handoff.status === "revoked") {
      throw new PassportServiceError("revoked", "The Project share has been revoked.");
    }

    if (Date.parse(bundle.handoff.expiresAt) <= this.#now().getTime()) {
      throw new PassportServiceError("expired", "The Project share has expired.");
    }

    return bundle;
  }

  #isReadable(bundle: PassportBundle): boolean {
    return (
      bundle.handoff.status === "published" &&
      Date.parse(bundle.handoff.expiresAt) > this.#now().getTime()
    );
  }

  #brief(bundle: PassportBundle): ProjectBrief {
    const brief: ProjectBrief = {
      id: bundle.project.id,
      name: bundle.project.name,
      goal: bundle.project.goal,
      activeBranch: bundle.project.repository.activeBranch,
      updatedAt: bundle.project.updatedAt,
      currentHandoff: {
        id: bundle.handoff.id,
        goal: bundle.handoff.goal,
        expiresAt: bundle.handoff.expiresAt,
      },
      handles: {
        handoff: `/v1/projects/${bundle.project.id}/handoff`,
        setupPlan: `/v1/projects/${bundle.project.id}/setup-plan`,
      },
    };

    if (estimateJsonTokens(brief) > MAX_COMPACT_RESPONSE_TOKENS) {
      throw new PassportServiceError("invalid", "The compact Project brief exceeds its budget.");
    }

    return brief;
  }

  #assertBundleRelationships(bundle: PassportBundle): void {
    if (
      bundle.handoff.projectId !== bundle.project.id ||
      bundle.setupPlan.projectId !== bundle.project.id ||
      bundle.setupPlan.handoffId !== bundle.handoff.id ||
      bundle.setupPlan.runtimeId !== bundle.runtime.id
    ) {
      throw new PassportServiceError("invalid", "Passport records do not reference one another.");
    }

    const declaredCapabilityIds = new Set(bundle.capabilities.map((capability) => capability.id));

    if (bundle.project.capabilityIds.some((id) => !declaredCapabilityIds.has(id))) {
      throw new PassportServiceError("invalid", "Project references an undeclared Capability.");
    }

    const setupIssues = inspectSetupPlan(bundle.setupPlan, bundle.capabilities);

    if (setupIssues.length > 0) {
      throw new PassportServiceError(
        "invalid",
        setupIssues[0]?.message ?? "Setup Plan is invalid.",
      );
    }

    HandoffSchema.parse(bundle.handoff);
  }
}
