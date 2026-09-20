import { z } from "zod";

import {
  IdentifierSchema,
  NonEmptyTextSchema,
  ProvenanceSchema,
  SchemaVersionSchema,
  SensitivitySchema,
  TimestampSchema,
} from "./common.js";

export const GitHubRepositorySchema = z
  .object({
    provider: z.literal("github"),
    owner: NonEmptyTextSchema,
    name: NonEmptyTextSchema,
    url: z.url({ protocol: /^https$/ }),
    defaultBranch: NonEmptyTextSchema,
    activeBranch: NonEmptyTextSchema,
    revision: NonEmptyTextSchema.optional(),
  })
  .strict();

export const ProjectSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdentifierSchema,
    name: NonEmptyTextSchema,
    goal: NonEmptyTextSchema,
    repository: GitHubRepositorySchema,
    capabilityIds: z.array(IdentifierSchema),
    sensitivity: SensitivitySchema,
    provenance: ProvenanceSchema,
    updatedAt: TimestampSchema,
  })
  .strict();

export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;

export type Project = z.infer<typeof ProjectSchema>;
