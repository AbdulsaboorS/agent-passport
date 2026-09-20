#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";

import { PassportBundleSchema, type PassportBundle } from "@agent-passport/api";

import { PassportApiClient } from "./client.js";
import { approveDraft, captureDraft, previewDraft, validateDraft } from "./draft.js";
import { LocalIdentityManager, MacOsKeychainIdentitySecretStore } from "./identity.js";

const execFileAsync = promisify(execFile);

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArgument(name: string): string {
  const value = argument(name);

  if (value === undefined) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

async function readJson(path: string): Promise<PassportBundle> {
  return PassportBundleSchema.parse(JSON.parse(await readFile(path, "utf8")));
}

async function repositoryState(repositoryPath: string) {
  const git = async (...args: string[]) =>
    (await execFileAsync("git", ["-C", repositoryPath, ...args])).stdout.trim();

  return {
    activeBranch: await git("branch", "--show-current"),
    revision: await git("rev-parse", "HEAD"),
    capturedAt: new Date().toISOString(),
  };
}

async function confirmApproval(): Promise<boolean> {
  if (process.argv.includes("--yes")) {
    return true;
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question("Publish exactly this preview? [y/N] ");
  prompt.close();

  return answer.trim().toLowerCase() === "y";
}

async function registeredIdentity(client: PassportApiClient, now: Date) {
  const identity = new LocalIdentityManager(new MacOsKeychainIdentitySecretStore());
  await client.registerIdentity(await identity.createRegistration(now));

  return identity;
}

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command === "capture") {
    const inputPath = requiredArgument("--input");
    const outputPath = requiredArgument("--output");
    const repositoryPath = argument("--repo") ?? process.cwd();
    const bundle = captureDraft(await readJson(inputPath), await repositoryState(repositoryPath));
    await writeFile(outputPath, previewDraft(bundle), "utf8");
    process.stdout.write(`Captured draft to ${outputPath}\n`);

    return;
  }

  if (command === "validate") {
    validateDraft(await readJson(requiredArgument("--input")));
    process.stdout.write("Draft is valid and passed deterministic credential screening.\n");

    return;
  }

  if (command === "preview") {
    process.stdout.write(previewDraft(await readJson(requiredArgument("--input"))));

    return;
  }

  if (command === "assess") {
    const bundle = validateDraft(await readJson(requiredArgument("--input")));
    const client = new PassportApiClient(requiredArgument("--api"));
    const now = new Date();
    const identity = await registeredIdentity(client, now);
    const ownerToken = await identity.createOwnerToken({ projectId: bundle.project.id, now });
    process.stdout.write(`${JSON.stringify(await client.assess(bundle, ownerToken), null, 2)}\n`);

    return;
  }

  if (command === "approve") {
    const input = await readJson(requiredArgument("--input"));
    process.stdout.write(previewDraft(input));

    if (!(await confirmApproval())) {
      throw new Error("Approval cancelled.");
    }

    const approved = approveDraft(input, new Date().toISOString());
    const outputPath = requiredArgument("--output");
    await writeFile(outputPath, previewDraft(approved), "utf8");
    process.stdout.write(`Approved Handoff written to ${outputPath}\n`);

    return;
  }

  if (command === "publish") {
    const bundle = validateDraft(await readJson(requiredArgument("--input")));
    const api = requiredArgument("--api");
    const client = new PassportApiClient(api);
    const now = new Date();
    const identity = await registeredIdentity(client, now);
    const shareId = crypto.randomUUID();

    const connection = await identity.createConnection({
      shareId,
      projectId: bundle.project.id,
      scopes: ["project:read", "handoff:read", "setup-plan:read", "readiness:write"],
      now,
      shareExpiresAt: bundle.handoff.expiresAt,
    });

    const ownerToken = await identity.createOwnerToken({ projectId: bundle.project.id, now });

    const result = await client.publish(bundle, {
      ownerToken,
      shareId,
      connectionToken: connection.token,
    });

    const connectionUrl = new URL("/connect", api);
    connectionUrl.hash = `token=${encodeURIComponent(connection.token)}`;
    process.stdout.write(
      `${JSON.stringify({ ...result, connectionUrl, token: connection.token }, null, 2)}\n`,
    );

    return;
  }

  if (command === "retrieve") {
    const token = process.env.PASSPORT_READ_TOKEN;

    if (token === undefined) {
      throw new Error("PASSPORT_READ_TOKEN is required.");
    }

    const client = new PassportApiClient(requiredArgument("--api"));
    process.stdout.write(
      `${JSON.stringify(await client.getProject(requiredArgument("--project"), token), null, 2)}\n`,
    );

    return;
  }

  if (command === "revoke") {
    const api = requiredArgument("--api");
    const projectId = requiredArgument("--project");
    const client = new PassportApiClient(api);
    const now = new Date();
    const identity = await registeredIdentity(client, now);
    const ownerToken = await identity.createOwnerToken({ projectId, now });
    await client.revoke(projectId, ownerToken, argument("--reason") ?? "Revoked locally");
    process.stdout.write(`Revoked Project share ${projectId}\n`);

    return;
  }

  process.stdout.write(
    "Usage: agent-passport <capture|validate|preview|assess|approve|publish|retrieve|revoke> [options]\n",
  );
}

await main().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
