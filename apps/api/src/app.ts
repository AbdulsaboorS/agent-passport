import { RuntimeSchema } from "@agent-passport/domain";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import {
  CaptureAssessmentRequestSchema,
  ErrorResponseSchema,
  PassportBundleSchema,
  ProjectBriefSchema,
  PublishRequestSchema,
  RevokeRequestSchema,
  type AccessScope,
} from "./contracts.js";
import { PassportService, PassportServiceError } from "./service.js";
import { InMemoryPassportStore } from "./store.js";

const BearerSecurity = [{ bearerAuth: [] }];

const ProjectParamsSchema = z.object({
  projectId: z.uuid().openapi({ param: { name: "projectId", in: "path" } }),
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
  store: InMemoryPassportStore;
  now?: () => Date;
}) {
  const app = new OpenAPIHono({
    defaultHook: (result, context) =>
      result.success
        ? undefined
        : context.json({ error: "invalid", message: "Request validation failed." }, 400),
  });

  const now = options.now ?? (() => new Date());

  async function requireAccess(context: Context, scope: AccessScope, projectId?: string) {
    const token = bearerToken(context);

    if (token === undefined) {
      throw new PassportServiceError("unauthorized", "A bearer token is required.");
    }

    const result = await options.store.authorize(token, scope, projectId, now());

    if (result === "unknown") {
      throw new PassportServiceError("unauthorized", "The bearer token is not recognized.");
    }

    if (result === "forbidden") {
      throw new PassportServiceError("forbidden", "The Connection lacks the required scope.");
    }

    if (result === "expired") {
      throw new PassportServiceError("expired", "The Connection has expired.");
    }

    if (result === "revoked") {
      throw new PassportServiceError("revoked", "The Connection has been revoked.");
    }

    return token;
  }

  app.openapi(publishRoute, async (context) => {
    try {
      const { projectId } = context.req.valid("param");
      await requireAccess(context, "project:write", projectId);
      const { bundle } = context.req.valid("json");

      if (bundle.project.id !== projectId) {
        throw new PassportServiceError("invalid", "Path Project does not match the payload.");
      }

      return context.json(await options.service.publish(bundle), 201);
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
      await requireAccess(context, "project:write", projectId);
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
      const token = await requireAccess(context, "project:read");
      const authorizedIds: string[] = [];

      for (const projectId of options.store.listProjectIds()) {
        if (
          (await options.store.authorize(token, "project:read", projectId, now())) === "authorized"
        ) {
          authorizedIds.push(projectId);
        }
      }

      return context.json({ projects: options.service.listProjects(authorizedIds) }, 200);
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
      await requireAccess(context, "project:read", projectId);

      return context.json(options.service.getBrief(projectId), 200);
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
      await requireAccess(context, "handoff:read", projectId);

      return context.json(options.service.getHandoff(projectId), 200);
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
      await requireAccess(context, "setup-plan:read", projectId);

      return context.json(options.service.getSetupPlan(projectId), 200);
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
      await requireAccess(context, "readiness:write", projectId);

      return context.json(
        options.service.reportReadiness(projectId, context.req.valid("json")),
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
      await requireAccess(context, "project:write", projectId);
      context.req.valid("json");
      options.service.revoke(projectId);

      return context.body(null, 204);
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
