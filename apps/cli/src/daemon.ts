import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { PassportBundleSchema } from "@agent-passport/api";
import { z } from "zod";

import type { LocalPassportWorkflow } from "./local-workflow.js";

const LOOPBACK_HOST = "127.0.0.1";

const LOCAL_TOKEN_HEADER = "X-Agent-Passport-Local-Token";

const MAX_REQUEST_BYTES = 1_000_000;

const CaptureRequestSchema = z
  .object({
    repositoryPath: z.string().min(1),
    bundle: PassportBundleSchema,
  })
  .strict();

const PublishRequestSchema = z.object({ relayUrl: z.url() }).strict();

const LocalRevokeRequestSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

const ReplaceRequestSchema = z
  .object({ lifetimeSeconds: z.number().int().min(1).max(86400).optional() })
  .strict();

export type RunningLocalDaemon = {
  readonly dashboardUrl: string;
  readonly token: string;
  close(): Promise<void>;
};

export function createLocalDaemonHandler(options: {
  port: number;
  token: string;
  workflow?: LocalPassportWorkflow | undefined;
  now?: () => Date;
}) {
  const expectedHost = `${LOOPBACK_HOST}:${options.port}`;
  const expectedOrigin = `http://${expectedHost}`;
  const now = options.now ?? (() => new Date());

  return async (request: Request): Promise<Response> => {
    if (request.headers.get("Host") !== expectedHost) {
      return response("forbidden", 403);
    }

    const origin = request.headers.get("Origin");

    if (origin !== null && origin !== expectedOrigin) {
      return response("forbidden", 403);
    }

    if (request.method !== "GET" && origin !== expectedOrigin) {
      return response("forbidden", 403);
    }

    if (!tokensMatch(request.headers.get(LOCAL_TOKEN_HEADER), options.token)) {
      return response("unauthorized", 401);
    }

    const path = new URL(request.url).pathname;

    if (path === "/api/bootstrap" && request.method === "GET") {
      return json({ status: "ready" });
    }

    if (options.workflow === undefined) {
      return response("not found", 404);
    }

    const workflow = options.workflow;

    try {
      if (path === "/api/projects" && request.method === "GET") {
        return json({
          projects: workflow.store.list().map((item) => ({
            ...item,
            connections: workflow.store.connections(item.bundle.project.id, now()),
          })),
        });
      }

      if (path === "/api/capture" && request.method === "POST") {
        const body = CaptureRequestSchema.parse(await request.json());

        return json(await workflow.capture(body.bundle, body.repositoryPath), 201);
      }

      const projectMatch = /^\/api\/projects\/([0-9a-f-]{36})(?:\/(approve|publish|revoke))?$/.exec(
        path,
      );

      if (projectMatch !== null) {
        const projectId = projectMatch[1];

        if (projectId === undefined) {
          return response("not found", 404);
        }

        if (projectMatch[2] === undefined && request.method === "GET") {
          const project = workflow.store.get(projectId);

          return project === undefined
            ? response("not found", 404)
            : json({ ...project, connections: workflow.store.connections(projectId, now()) });
        }

        if (projectMatch[2] === "approve" && request.method === "POST") {
          return json(await workflow.approve(projectId));
        }

        if (projectMatch[2] === "publish" && request.method === "POST") {
          const body = PublishRequestSchema.parse(await request.json());

          return json(await workflow.publish(projectId, body.relayUrl), 201);
        }

        if (projectMatch[2] === "revoke" && request.method === "POST") {
          const body = LocalRevokeRequestSchema.parse(await request.json());

          await workflow.revoke(projectId, body.reason);

          return json({ status: "revoked" });
        }
      }

      const connectionMatch = /^\/api\/connections\/([0-9a-f-]{36})(?:\/(reveal|replace))?$/.exec(
        path,
      );

      if (connectionMatch !== null) {
        const connectionId = connectionMatch[1];

        if (connectionId === undefined) {
          return response("not found", 404);
        }

        const project = workflow.store
          .list()
          .find((item) =>
            workflow.store
              .connections(item.bundle.project.id, now())
              .some((connection) => connection.connectionId === connectionId),
          );

        if (project === undefined) {
          return response("not found", 404);
        }

        if (connectionMatch[2] === undefined && request.method === "GET") {
          return json(
            workflow.store
              .connections(project.bundle.project.id, now())
              .find((item) => item.connectionId === connectionId),
          );
        }

        if (connectionMatch[2] === "reveal" && request.method === "GET") {
          return json(await workflow.store.reveal(connectionId, now()));
        }

        if (connectionMatch[2] === "replace" && request.method === "POST") {
          const body = ReplaceRequestSchema.parse(await request.json());

          return json(
            await workflow.replaceConnection(
              project.bundle.project.id,
              connectionId,
              body.lifetimeSeconds,
            ),
            201,
          );
        }
      }

      return response("not found", 404);
    } catch (error) {
      return response(error instanceof Error ? error.message : "invalid request", 400);
    }
  };
}

export async function startLocalDaemon(
  options: { port?: number; workflow?: LocalPassportWorkflow } = {},
): Promise<RunningLocalDaemon> {
  const token = randomBytes(32).toString("base64url");
  let handler: ReturnType<typeof createLocalDaemonHandler> | undefined;

  const server = createServer(async (request, output) => {
    if (handler === undefined) {
      writeNodeResponse(output, response("unavailable", 503));

      return;
    }

    try {
      writeNodeResponse(output, await handler(await webRequest(request)));
    } catch {
      writeNodeResponse(output, response("invalid request", 400));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, LOOPBACK_HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });

  // SAFETY: This server listens on TCP, so Node returns AddressInfo or null, never a pipe name.
  const address = server.address() as AddressInfo | null;

  if (address === null || address.address !== LOOPBACK_HOST) {
    await closeServer(server);
    throw new Error("Local daemon did not bind to the required loopback address.");
  }

  handler = createLocalDaemonHandler({ port: address.port, token, workflow: options.workflow });
  const origin = `http://${LOOPBACK_HOST}:${address.port}`;

  return {
    dashboardUrl: `${origin}/#token=${encodeURIComponent(token)}`,
    token,
    close: async () => await closeServer(server),
  };
}

function tokensMatch(candidate: string | null, expected: string): boolean {
  if (candidate === null) {
    return false;
  }

  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);

  return (
    candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes)
  );
}

function response(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: secureHeaders({ "Content-Type": "application/json" }),
  });
}

function json<T>(value: T, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: secureHeaders({ "Content-Type": "application/json" }),
  });
}

function secureHeaders(additional: Record<string, string> = {}): Headers {
  return new Headers({
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...additional,
  });
}

async function webRequest(request: IncomingMessage): Promise<Request> {
  const host = request.headers.host;

  if (host === undefined) {
    throw new Error("Host header is required.");
  }

  const method = request.method ?? "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : await requestBody(request);
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    init.body = body;
  }

  return new Request(`http://${host}${request.url ?? "/"}`, init);
}

async function requestBody(request: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let length = 0;

  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;

    if (length > MAX_REQUEST_BYTES) {
      throw new Error("Request body is too large.");
    }

    chunks.push(bytes);
  }

  return Buffer.concat(chunks);
}

function writeNodeResponse(output: ServerResponse, responseValue: Response): void {
  output.statusCode = responseValue.status;
  responseValue.headers.forEach((value, name) => output.setHeader(name, value));
  void responseValue.arrayBuffer().then(
    (body) => output.end(Buffer.from(body)),
    () => output.end(),
  );
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error))),
  );
}
