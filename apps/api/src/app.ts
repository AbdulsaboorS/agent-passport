import { RuntimeSchema } from "@agent-passport/domain";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import {
  CaptureAssessmentRequestSchema,
  ErrorResponseSchema,
  IdentityRegistrationRequestSchema,
  PassportBundleSchema,
  ProjectBriefSchema,
  PublishRequestSchema,
  RevokeRequestSchema,
  DestinationAccessScopeSchema,
} from "./contracts.js";
import { RelayAuthorizer } from "./authorization.js";
import { PassportService, PassportServiceError } from "./service.js";
import type { PassportStore } from "./store.js";

const BearerSecurity = [{ bearerAuth: [] }];

const ProjectParamsSchema = z.object({
  projectId: z.uuid().openapi({ param: { name: "projectId", in: "path" } }),
});

const registerIdentityRoute = createRoute({
  method: "post",
  path: "/v1/identities",
  request: {
    body: {
      content: { "application/json": { schema: IdentityRegistrationRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: z.object({ identityId: z.string() }) } },
      description: "Registered public identity",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    410: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Expired",
    },
  },
});

const CaptureAssessmentSchema = z.object({
  model: z.string(),
  judgments: z.object({
    relevant: z.number().min(0).max(1),
    sensitivityMismatch: z.number().min(0).max(1),
    portable: z.number().min(0).max(1),
    conflicting: z.number().min(0).max(1),
    stale: z.number().min(0).max(1),
  }),
  warnings: z.array(z.string()),
});

const CaptureAssessmentOutcomeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("complete"), assessment: CaptureAssessmentSchema }),
  z.object({
    status: z.enum(["not_configured", "unavailable"]),
    assessment: z.null(),
  }),
]);

const publishRoute = createRoute({
  method: "post",
  path: "/v1/projects/{projectId}/publish",
  security: BearerSecurity,
  request: {
    params: ProjectParamsSchema,
    body: { content: { "application/json": { schema: PublishRequestSchema } }, required: true },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({ project: ProjectBriefSchema }),
        },
      },
      description: "Published Passport data",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Forbidden",
    },
    410: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Expired",
    },
  },
});

const assessRoute = createRoute({
  method: "post",
  path: "/v1/projects/{projectId}/assess",
  security: BearerSecurity,
  request: {
    params: ProjectParamsSchema,
    body: {
      content: { "application/json": { schema: CaptureAssessmentRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CaptureAssessmentOutcomeSchema,
        },
      },
      description: "Optional Jev review evidence",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Forbidden",
    },
  },
});

const listProjectsRoute = createRoute({
  method: "get",
  path: "/v1/projects",
  security: BearerSecurity,
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ projects: z.array(ProjectBriefSchema) }) },
      },
      description: "Projects shared with this Connection",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Forbidden",
    },
    410: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Expired",
    },
  },
});

function readRoute(path: string, description: string, schema: z.ZodType) {
  return createRoute({
    method: "get",
    path,
    security: BearerSecurity,
    request: { params: ProjectParamsSchema },
    responses: {
      200: { content: { "application/json": { schema } }, description },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized",
      },
      403: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Forbidden",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
      410: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unavailable",
      },
    },
  });
}

const briefRoute = readRoute(
  "/v1/projects/{projectId}",
  "Compact Project brief",
  ProjectBriefSchema,
);

const handoffRoute = readRoute(
  "/v1/projects/{projectId}/handoff",
  "Current approved Handoff",
  PassportBundleSchema.shape.handoff,
);

const setupPlanRoute = readRoute(
  "/v1/projects/{projectId}/setup-plan",
  "Setup Plan",
  PassportBundleSchema.shape.setupPlan,
);

const readinessRoute = createRoute({
  method: "post",
  path: "/v1/projects/{projectId}/readiness",
  security: BearerSecurity,
  request: {
    params: ProjectParamsSchema,
    body: { content: { "application/json": { schema: RuntimeSchema } }, required: true },
  },
  responses: {
    200: {
      content: { "application/json": { schema: RuntimeSchema } },
      description: "Recorded Runtime readiness",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Forbidden",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Not found",
    },
    410: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unavailable",
    },
  },
});

const revokeRoute = createRoute({
  method: "post",
  path: "/v1/projects/{projectId}/revoke",
  security: BearerSecurity,
  request: {
    params: ProjectParamsSchema,
    body: { content: { "application/json": { schema: RevokeRequestSchema } }, required: true },
  },
  responses: {
    204: { description: "Revoked" },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Forbidden",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Not found",
    },
  },
});

const replaceConnectionRoute = createRoute({
  method: "post",
  path: "/v1/projects/{projectId}/connections",
  security: BearerSecurity,
  request: {
    params: ProjectParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: z
            .object({
              oldTokenId: z.uuid(),
              connectionToken: z.string().min(1),
              scopes: z.array(DestinationAccessScopeSchema).min(1),
            })
            .strict(),
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({
            connectionId: z.uuid(),
            tokenId: z.uuid(),
            expiresAt: z.iso.datetime({ offset: true }),
          }),
        },
      },
      description: "Replacement Connection registered",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Forbidden",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Not found",
    },
    410: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unavailable",
    },
  },
});

function bearerToken(context: Context): string | undefined {
  const authorization = context.req.header("Authorization");
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");

  return match?.[1];
}

function errorResponse(context: Context, error: Error): never {
  let response: Response;

  if (!(error instanceof PassportServiceError)) {
    response = context.json({ error: "invalid", message: "Request validation failed." }, 400);
  } else {
    const status =
      error.code === "unauthorized"
        ? 401
        : error.code === "forbidden"
          ? 403
          : error.code === "not_found"
            ? 404
            : error.code === "expired" || error.code === "revoked"
              ? 410
              : 400;

    response = context.json({ error: error.code, message: error.message }, status);
  }

  // SAFETY: Every response shape and status produced here is declared on each OpenAPI route.
  return response as never;
}

export function createPassportApp(options: {
  service: PassportService;
  store: PassportStore;
  now?: () => Date;
}) {
  const app = new OpenAPIHono({
    defaultHook: (result, context) =>
      result.success
        ? undefined
        : context.json({ error: "invalid", message: "Request validation failed." }, 400),
  });

  const now = options.now ?? (() => new Date());
  const authorizer = new RelayAuthorizer({ store: options.store, now });

  function requiredToken(context: Context): string {
    const token = bearerToken(context);

    if (token === undefined) {
      throw new PassportServiceError("unauthorized", "A bearer token is required.");
    }

    return token;
  }

  app.openapi(registerIdentityRoute, async (context) => {
    try {
      const registration = context.req.valid("json");
      await authorizer.registerIdentity(registration);

      return context.json({ identityId: registration.identityId }, 201);
    } catch (error) {
      return errorResponse(
        context,
        error instanceof Error ? error : new Error("Request validation failed."),
      );
    }
  });

  app.openapi(publishRoute, async (context) => {
    try {
      const { projectId } = context.req.valid("param");
      const owner = await authorizer.authorizeOwner(requiredToken(context), projectId);
      const { bundle, shareId, connectionToken } = context.req.valid("json");

      if (bundle.project.id !== projectId) {
        throw new PassportServiceError("invalid", "Path Project does not match the payload.");
      }

      const grant = await authorizer.connectionForPublish(connectionToken, {
        identityId: owner.identityId,
        projectId,
        shareId,
        shareExpiresAt: bundle.handoff.expiresAt,
      });

      return context.json(
        await options.service.publish({
          bundle,
          shareId,
          identityId: owner.identityId,
          grant,
        }),
        201,
      );
    } catch (error) {
      return errorResponse(
        context,
        error instanceof Error ? error : new Error("Request validation failed."),
      );
    }
  });

  app.openapi(assessRoute, async (context) => {
    try {
      const { projectId } = context.req.valid("param");
      await authorizer.authorizeOwner(requiredToken(context), projectId);
      const capture = context.req.valid("json");

      if (capture.project.id !== projectId) {
        throw new PassportServiceError("invalid", "Path Project does not match the payload.");
      }

      return context.json(await options.service.assessCapture(capture), 200);
    } catch (error) {
      return errorResponse(
        context,
        error instanceof Error ? error : new Error("Request validation failed."),
      );
    }
  });

  app.openapi(listProjectsRoute, async (context) => {
    try {
      const access = await authorizer.authorizeConnection(requiredToken(context), "project:read");

      return context.json(
        { projects: await options.service.listProjects([access.projectId]) },
        200,
      );
    } catch (error) {
      return errorResponse(
        context,
        error instanceof Error ? error : new Error("Request validation failed."),
      );
    }
  });

  app.openapi(briefRoute, async (context) => {
    try {
      const { projectId } = context.req.valid("param");
      await authorizer.authorizeConnection(requiredToken(context), "project:read", projectId);

      return context.json(await options.service.getBrief(projectId), 200);
    } catch (error) {
      return errorResponse(
        context,
        error instanceof Error ? error : new Error("Request validation failed."),
      );
    }
  });

  app.openapi(handoffRoute, async (context) => {
    try {
      const { projectId } = context.req.valid("param");
      await authorizer.authorizeConnection(requiredToken(context), "handoff:read", projectId);

      return context.json(await options.service.getHandoff(projectId), 200);
    } catch (error) {
      return errorResponse(
        context,
        error instanceof Error ? error : new Error("Request validation failed."),
      );
    }
  });

  app.openapi(setupPlanRoute, async (context) => {
    try {
      const { projectId } = context.req.valid("param");
      await authorizer.authorizeConnection(requiredToken(context), "setup-plan:read", projectId);

      return context.json(await options.service.getSetupPlan(projectId), 200);
    } catch (error) {
      return errorResponse(
        context,
        error instanceof Error ? error : new Error("Request validation failed."),
      );
    }
  });

  app.openapi(readinessRoute, async (context) => {
    try {
      const { projectId } = context.req.valid("param");
      await authorizer.authorizeConnection(requiredToken(context), "readiness:write", projectId);

      return context.json(
        await options.service.reportReadiness(projectId, context.req.valid("json")),
        200,
      );
    } catch (error) {
      return errorResponse(
        context,
        error instanceof Error ? error : new Error("Request validation failed."),
      );
    }
  });

  app.openapi(revokeRoute, async (context) => {
    try {
      const { projectId } = context.req.valid("param");
      const owner = await authorizer.authorizeOwner(requiredToken(context), projectId);
      context.req.valid("json");
      await options.service.revoke(projectId, owner.identityId);

      return context.body(null, 204);
    } catch (error) {
      return errorResponse(
        context,
        error instanceof Error ? error : new Error("Request validation failed."),
      );
    }
  });

  app.openapi(replaceConnectionRoute, async (context) => {
    try {
      const { projectId } = context.req.valid("param");
      const owner = await authorizer.authorizeOwner(requiredToken(context), projectId);
      const { oldTokenId, connectionToken, scopes } = context.req.valid("json");
      const old = await options.store.getAuthorization(oldTokenId);

      if (
        old === undefined ||
        old.share.projectId !== projectId ||
        old.share.identityId !== owner.identityId
      ) {
        throw new PassportServiceError("not_found", "Connection was not found for this Project.");
      }

      if (old.grant.revokedAt !== undefined || old.share.revokedAt !== undefined) {
        throw new PassportServiceError("revoked", "Connection is revoked.");
      }

      if (
        Date.parse(old.grant.expiresAt) <= now().getTime() ||
        Date.parse(old.share.expiresAt) <= now().getTime()
      ) {
        throw new PassportServiceError("expired", "Connection has expired.");
      }

      const grant = await authorizer.connectionForPublish(connectionToken, {
        identityId: owner.identityId,
        projectId,
        shareId: old.share.id,
        shareExpiresAt: old.share.expiresAt,
      });

      if (
        JSON.stringify(grant.scopes) !== JSON.stringify(scopes) ||
        grant.scopes.some((scope) => !old.grant.scopes.includes(scope))
      ) {
        throw new PassportServiceError("forbidden", "Replacement cannot broaden Connection scope.");
      }

      if (Date.parse(grant.expiresAt) > Date.parse(old.share.expiresAt)) {
        throw new PassportServiceError("invalid", "Connection cannot outlive its share.");
      }

      const replaced = await options.store.replaceGrant(oldTokenId, grant, now().toISOString());

      if (!replaced) {
        throw new PassportServiceError("revoked", "Connection is no longer active.");
      }

      return context.json(
        { connectionId: grant.connectionId, tokenId: grant.tokenId, expiresAt: grant.expiresAt },
        201,
      );
    } catch (error) {
      return errorResponse(
        context,
        error instanceof Error ? error : new Error("Request validation failed."),
      );
    }
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
  });
  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Agent Passport API", version: "0.1.0" },
  });

  return app;
}
