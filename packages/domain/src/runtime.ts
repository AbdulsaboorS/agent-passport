import { z } from "zod";

import {
  IdentifierSchema,
  NonEmptyTextSchema,
  SchemaVersionSchema,
  TimestampSchema,
} from "./common.js";

export const RuntimeFeatureStatusSchema = z.enum(["available", "unavailable", "unverified"]);

export const RuntimeObservationSchema = z
  .object({
    status: RuntimeFeatureStatusSchema,
    observedAt: TimestampSchema,
    evidence: NonEmptyTextSchema,
  })
  .strict();

export const CapabilityReadinessStatusSchema = z.enum([
  "declared",
  "installed",
  "authorized",
  "ready",
  "stale",
  "unsupported",
]);

export const ReadinessEvidenceSchema = z
  .object({
    source: z.enum(["declaration", "command", "connector", "manual"]),
    observedAt: TimestampSchema,
    detail: NonEmptyTextSchema,
    command: z.array(NonEmptyTextSchema).min(1).optional(),
    version: NonEmptyTextSchema.optional(),
    credentialStorage: z
      .enum(["agent-readable-file", "brokered", "keyring", "not-applicable", "unverified"])
      .optional(),
    connectionId: IdentifierSchema.optional(),
  })
  .strict();

export const CapabilityReadinessSchema = z
  .object({
    capabilityId: IdentifierSchema,
    status: CapabilityReadinessStatusSchema,
    evidence: ReadinessEvidenceSchema,
  })
  .strict();

export const RuntimeSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdentifierSchema,
    name: NonEmptyTextSchema,
    kind: z.enum(["local", "muse-secure-vm"]),
    platform: z.enum(["darwin", "linux", "windows", "unverified"]),
    observations: z
      .object({
        browser: RuntimeObservationSchema,
        connectorRetrieval: RuntimeObservationSchema,
        packageInstallation: RuntimeObservationSchema,
        persistentFilesystem: RuntimeObservationSchema,
        terminal: RuntimeObservationSchema,
      })
      .strict(),
    capabilityReadiness: z.array(CapabilityReadinessSchema),
    reportedAt: TimestampSchema,
  })
  .strict();

export type CapabilityReadiness = z.infer<typeof CapabilityReadinessSchema>;

export type CapabilityReadinessStatus = z.infer<typeof CapabilityReadinessStatusSchema>;

export type ReadinessEvidence = z.infer<typeof ReadinessEvidenceSchema>;

export type Runtime = z.infer<typeof RuntimeSchema>;

export type RuntimeFeatureStatus = z.infer<typeof RuntimeFeatureStatusSchema>;

export type RuntimeObservation = z.infer<typeof RuntimeObservationSchema>;
