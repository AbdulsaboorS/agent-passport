import { z } from "zod";

import {
  IdentifierSchema,
  NonEmptyTextSchema,
  SchemaVersionSchema,
  TimestampSchema,
} from "./common.js";

export const ConnectionSchema = z
  .object({
    schemaVersion: SchemaVersionSchema,
    id: IdentifierSchema,
    runtimeId: IdentifierSchema,
    capabilityId: IdentifierSchema,
    provider: NonEmptyTextSchema,
    status: z.enum(["pending", "active", "expired", "revoked"]),
    authorizationMethod: z.enum(["browser", "device-code", "oauth"]),
    scopes: z.array(NonEmptyTextSchema),
    createdAt: TimestampSchema,
    authorizedAt: TimestampSchema.optional(),
    expiresAt: TimestampSchema.optional(),
    revokedAt: TimestampSchema.optional(),
  })
  .strict()
  .superRefine((connection, context) => {
    const createdAt = Date.parse(connection.createdAt);

    if (connection.status !== "pending" && connection.authorizedAt === undefined) {
      context.addIssue({
        code: "custom",
        message: "active, expired, and revoked connections require authorizedAt",
        path: ["authorizedAt"],
      });
    }

    if (connection.status === "pending" && connection.authorizedAt !== undefined) {
      context.addIssue({
        code: "custom",
        message: "pending connections cannot record authorizedAt",
        path: ["authorizedAt"],
      });
    }

    if (connection.status === "expired" && connection.expiresAt === undefined) {
      context.addIssue({
        code: "custom",
        message: "expired connections require expiresAt",
        path: ["expiresAt"],
      });
    }

    if (connection.status === "revoked" && connection.revokedAt === undefined) {
      context.addIssue({
        code: "custom",
        message: "revoked connections require revokedAt",
        path: ["revokedAt"],
      });
    }

    if (connection.status !== "revoked" && connection.revokedAt !== undefined) {
      context.addIssue({
        code: "custom",
        message: "only revoked connections can record revokedAt",
        path: ["revokedAt"],
      });
    }

    if (connection.authorizedAt !== undefined && Date.parse(connection.authorizedAt) < createdAt) {
      context.addIssue({
        code: "custom",
        message: "authorizedAt cannot be earlier than createdAt",
        path: ["authorizedAt"],
      });
    }

    if (connection.expiresAt !== undefined && Date.parse(connection.expiresAt) <= createdAt) {
      context.addIssue({
        code: "custom",
        message: "expiresAt must be later than createdAt",
        path: ["expiresAt"],
      });
    }

    if (connection.revokedAt !== undefined && Date.parse(connection.revokedAt) < createdAt) {
      context.addIssue({
        code: "custom",
        message: "revokedAt cannot be earlier than createdAt",
        path: ["revokedAt"],
      });
    }
  });

export type Connection = z.infer<typeof ConnectionSchema>;
