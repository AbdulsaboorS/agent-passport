import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

const LOOPBACK_HOST = "127.0.0.1";

const LOCAL_TOKEN_HEADER = "X-Agent-Passport-Local-Token";

const MAX_REQUEST_BYTES = 1_000_000;

export type RunningLocalDaemon = {
  readonly dashboardUrl: string;
  readonly token: string;
  close(): Promise<void>;
};

export function createLocalDaemonHandler(options: { port: number; token: string }) {
  const expectedHost = `${LOOPBACK_HOST}:${options.port}`;
  const expectedOrigin = `http://${expectedHost}`;

  return async (request: Request): Promise<Response> => {
    if (request.headers.get("Host") !== expectedHost) {
      return response("forbidden", 403);
    }

    if (request.url !== `${expectedOrigin}/api/bootstrap`) {
      return response("not found", 404);
    }

    if (request.method !== "GET") {
      return response("method not allowed", 405);
    }

    if (request.headers.get("Origin") !== expectedOrigin) {
      return response("forbidden", 403);
    }

    if (!tokensMatch(request.headers.get(LOCAL_TOKEN_HEADER), options.token)) {
      return response("unauthorized", 401);
    }

    return new Response(JSON.stringify({ status: "ready" }), {
      status: 200,
      headers: secureHeaders({ "Content-Type": "application/json" }),
    });
  };
}

export async function startLocalDaemon(
  options: { port?: number } = {},
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

  handler = createLocalDaemonHandler({ port: address.port, token });
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
