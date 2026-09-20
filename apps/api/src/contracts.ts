import {
  CapabilitySchema,
  HandoffSchema,
  ProjectSchema,
  RuntimeSchema,
  SetupPlanSchema,
  type Handoff,
} from "@agent-passport/domain";
import { z } from "zod";

export const AccessScopeSchema = z.enum([
  "project:write",
  "project:read",
  "handoff:read",
  "setup-plan:read",
  "readiness:write",
]);

export type AccessScope = z.infer<typeof AccessScopeSchema>;

export const PassportBundleSchema = z
  .object({
    project: ProjectSchema,
    handoff: HandoffSchema,
    capabilities: z.array(CapabilitySchema),
    runtime: RuntimeSchema,
    setupPlan: SetupPlanSchema,
  })
  .strict();

export type PassportBundle = z.infer<typeof PassportBundleSchema>;

export const PublishRequestSchema = z
  .object({
    bundle: PassportBundleSchema,
    approved: z.literal(true),
  })
  .strict();

export const CaptureAssessmentRequestSchema = z
  .object({
    project: ProjectSchema,
    handoff: HandoffSchema,
  })
  .strict();

export const RevokeRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string(),
  })
  .strict();

export const ProjectBriefSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    goal: z.string(),
    activeBranch: z.string(),
    updatedAt: z.iso.datetime({ offset: true }),
    currentHandoff: z.object({
      id: z.uuid(),
      goal: z.string(),
      expiresAt: z.iso.datetime({ offset: true }),
    }),
    handles: z.object({
      handoff: z.string(),
      setupPlan: z.string(),
    }),
  })
  .strict();

export type ProjectBrief = z.infer<typeof ProjectBriefSchema>;

export const MAX_COMPACT_RESPONSE_TOKENS = 750;

export const MAX_DEFAULT_CONTEXT_TOKENS = 1_500;

export type CompactPayload =
  | ProjectBrief
  | { readonly projects: readonly ProjectBrief[] }
  | { readonly project: ProjectBrief; readonly handoff: Handoff };

export function estimateJsonTokens(value: CompactPayload): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}
