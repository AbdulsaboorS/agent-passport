import { z } from "zod";

import {
  IdentifierSchema,
  NonEmptyTextSchema,
  ProvenanceSchema,
  SchemaVersionSchema,
  SensitivitySchema,
  TimestampSchema,
} from "./common.js";

export const HandoffDecisionSchema = z
  .object({
    decision: NonEmptyTextSchema,
    rationale: NonEmptyTextSchema,
  })
  .strict();

export const ContextReferenceSchema = z
  .object({
    title: NonEmptyTextSchema,
    handle: NonEmptyTextSchema,
    sensitivity: SensitivitySchema,
  })
  .strict();

export const HandoffSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    status: z.enum(["draft", "published", "revoked"]),
    goal: NonEmptyTextSchema,
    progress: z.array(NonEmptyTextSchema),
    decisions: z.array(HandoffDecisionSchema),
    blockers: z.array(NonEmptyTextSchema),
    nextActions: z.array(NonEmptyTextSchema).min(1),
    context: z.array(ContextReferenceSchema),
    sensitivity: SensitivitySchema,
    provenance: ProvenanceSchema,
    createdAt: TimestampSchema,
    approvedAt: TimestampSchema.optional(),
    expiresAt: TimestampSchema,
    revokedAt: TimestampSchema.optional(),
  })
  .strict()
  .superRefine((handoff, context) => {
    const createdAt = Date.parse(handoff.createdAt);
    const expiresAt = Date.parse(handoff.expiresAt);

    if (expiresAt <= createdAt) {
      context.addIssue({
        code: "custom",
        message: "expiresAt must be later than createdAt",
        path: ["expiresAt"],
      });
    }

    if (
      handoff.approvedAt !== undefined &&
      (Date.parse(handoff.approvedAt) < createdAt || Date.parse(handoff.approvedAt) >= expiresAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "approvedAt must fall between createdAt and expiresAt",
        path: ["approvedAt"],
      });
    }

    if (handoff.status === "draft" && handoff.approvedAt !== undefined) {
      context.addIssue({
        code: "custom",
        message: "draft handoffs cannot be approved",
        path: ["approvedAt"],
      });
    }

    if (handoff.status !== "draft" && handoff.approvedAt === undefined) {
      context.addIssue({
        code: "custom",
        message: "published or revoked handoffs require approvedAt",
        path: ["approvedAt"],
      });
    }

    if (handoff.status === "revoked" && handoff.revokedAt === undefined) {
      context.addIssue({
        code: "custom",
        message: "revoked handoffs require revokedAt",
        path: ["revokedAt"],
      });
    }

    if (handoff.status !== "revoked" && handoff.revokedAt !== undefined) {
      context.addIssue({
        code: "custom",
        message: "only revoked handoffs can record revokedAt",
        path: ["revokedAt"],
      });
    }

    if (handoff.revokedAt !== undefined && Date.parse(handoff.revokedAt) < createdAt) {
      context.addIssue({
        code: "custom",
        message: "revokedAt cannot be earlier than createdAt",
        path: ["revokedAt"],
      });
    }
  });

export type ContextReference = z.infer<typeof ContextReferenceSchema>;

export type Handoff = z.infer<typeof HandoffSchema>;

export type HandoffDecision = z.infer<typeof HandoffDecisionSchema>;
