import { z } from "zod";

export const SchemaVersionSchema = z.literal("1");

export const IdentifierSchema = z.uuid();

export const TimestampSchema = z.iso.datetime({ offset: true });

// Bounds every free-text field so a Passport stays a compact brief rather than a document dump.
export const NonEmptyTextSchema = z.string().trim().min(1).max(4_000);

export const SensitivitySchema = z.enum(["public", "internal", "sensitive"]);

export const ProvenanceSchema = z
  .object({
    source: NonEmptyTextSchema,
    capturedAt: TimestampSchema,
    reference: NonEmptyTextSchema.optional(),
  })
  .strict();

export type Provenance = z.infer<typeof ProvenanceSchema>;

export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

export type Sensitivity = z.infer<typeof SensitivitySchema>;
