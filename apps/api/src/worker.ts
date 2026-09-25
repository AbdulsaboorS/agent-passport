import { createPassportApp } from "./app.js";
import { D1PassportStore } from "./d1-store.js";
import { PassportService } from "./service.js";

type Environment = {
  DB: D1Database;
  WRITE_LIMITER: RateLimit;
  READ_LIMITER: RateLimit;
};

export default {
  async fetch(request, environment) {
    if (!(await withinRateLimit(request, environment))) {
      return Response.json(
        { error: "rate_limited", message: "Too many requests. Retry shortly." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const store = new D1PassportStore(environment.DB);
    const service = new PassportService({ store });
    const app = createPassportApp({ service, store });

    return await app.fetch(request);
  },

  async scheduled(_controller, environment) {
    await new D1PassportStore(environment.DB).purgeExpired(new Date().toISOString());
  },
} satisfies ExportedHandler<Environment>;

// Writes are keyed by client IP because anyone can register an identity. Reads are keyed by the
// presented token so destinations that share cloud egress IPs do not throttle one another.
async function withinRateLimit(request: Request, environment: Environment): Promise<boolean> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

  if (request.method !== "GET" && request.method !== "HEAD") {
    return (await environment.WRITE_LIMITER.limit({ key: `ip:${ip}` })).success;
  }

  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];

  const key = token === undefined ? `ip:${ip}` : `token:${await sha256Hex(token)}`;

  return (await environment.READ_LIMITER.limit({ key })).success;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
