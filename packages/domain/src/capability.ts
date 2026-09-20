import { z } from "zod";

import { IdentifierSchema, NonEmptyTextSchema, SchemaVersionSchema } from "./common.js";

export const CapabilityKindSchema = z.enum([
  "agent-instructions",
  "cli",
  "coding-agent-cli",
  "connected-service",
  "remote-mcp-server",
  "skill",
]);

export const InstallationArtifactSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("apt"),
      package: NonEmptyTextSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("homebrew"),
      formula: NonEmptyTextSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("npm"),
      package: NonEmptyTextSchema,
      version: NonEmptyTextSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("remote"),
      endpoint: z.url({ protocol: /^https$/ }),
    })
    .strict(),
]);

export const AuthorizationRequirementSchema = z.discriminatedUnion("required", [
  z.object({ required: z.literal(false) }).strict(),
  z
    .object({
      required: z.literal(true),
      provider: NonEmptyTextSchema,
      methods: z.array(z.enum(["browser", "device-code", "oauth"])).min(1),
      scopes: z.array(NonEmptyTextSchema),
    })
    .strict(),
]);

export const VerificationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("command"),
      command: z.array(NonEmptyTextSchema).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("https"),
      endpoint: z.url({ protocol: /^https$/ }),
    })
    .strict(),
]);

export const CapabilitySchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdentifierSchema,
    kind: CapabilityKindSchema,
    name: NonEmptyTextSchema,
    description: NonEmptyTextSchema,
    requirement: z.enum(["required", "optional"]),
    installationOptions: z.array(InstallationArtifactSchema).min(1).optional(),
    authorization: AuthorizationRequirementSchema,
    verification: VerificationSchema,
  })
  .strict();

export type AuthorizationRequirement = z.infer<typeof AuthorizationRequirementSchema>;

export type Capability = z.infer<typeof CapabilitySchema>;

export type CapabilityKind = z.infer<typeof CapabilityKindSchema>;

export type InstallationArtifact = z.infer<typeof InstallationArtifactSchema>;

export type Verification = z.infer<typeof VerificationSchema>;
