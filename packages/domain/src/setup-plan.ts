import { z } from "zod";

import { InstallationArtifactSchema, VerificationSchema } from "./capability.js";
import {
  IdentifierSchema,
  NonEmptyTextSchema,
  SchemaVersionSchema,
  TimestampSchema,
} from "./common.js";

export const SetupStepStatusSchema = z.enum(["pending", "blocked", "complete", "not-required"]);

const SetupStepBaseSchema = z.object({
  id: IdentifierSchema,
  capabilityId: IdentifierSchema,
  instruction: NonEmptyTextSchema,
  status: SetupStepStatusSchema,
});

export const SetupStepSchema = z.discriminatedUnion("kind", [
  SetupStepBaseSchema.extend({
    kind: z.literal("install"),
    artifact: InstallationArtifactSchema,
  }).strict(),
  SetupStepBaseSchema.extend({
    kind: z.literal("authorize"),
    provider: NonEmptyTextSchema,
    method: z.enum(["browser", "device-code", "oauth"]),
    scopes: z.array(NonEmptyTextSchema),
  }).strict(),
  SetupStepBaseSchema.extend({
    kind: z.literal("verify"),
    verification: VerificationSchema,
  }).strict(),
]);

export const SetupPlanSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdentifierSchema,
    projectId: IdentifierSchema,
    handoffId: IdentifierSchema,
    runtimeId: IdentifierSchema,
    status: z.enum(["pending", "blocked", "ready", "stale"]),
    steps: z.array(SetupStepSchema),
    generatedAt: TimestampSchema,
  })
  .strict();

export type SetupPlan = z.infer<typeof SetupPlanSchema>;

export type SetupStep = z.infer<typeof SetupStepSchema>;

export type SetupStepStatus = z.infer<typeof SetupStepStatusSchema>;
