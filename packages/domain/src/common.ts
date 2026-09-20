import { z } from "zod";

export const SchemaVersionSchema = z.literal("1");

export const IdentifierSchema = z.uuid();

export const TimestampSchema = z.iso.datetime({ offset: true });

export const NonEmptyTextSchema = z.string().trim().min(1);

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
