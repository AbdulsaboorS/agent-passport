import type { Capability, InstallationArtifact } from "./capability.js";
import type { SetupPlan } from "./setup-plan.js";

export type SetupPlanIssue = {
  readonly capabilityId: string;
  readonly message: string;
  readonly stepId: string;
};

function artifactsMatch(left: InstallationArtifact, right: InstallationArtifact): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "apt" && right.kind === "apt") {
    return left.package === right.package;
  }

  if (left.kind === "homebrew" && right.kind === "homebrew") {
    return left.formula === right.formula;
  }

  if (left.kind === "npm" && right.kind === "npm") {
    return left.package === right.package && left.version === right.version;
  }

  return left.kind === "remote" && right.kind === "remote" && left.endpoint === right.endpoint;
}

export function inspectSetupPlan(
  plan: SetupPlan,
  capabilities: readonly Capability[],
): SetupPlanIssue[] {
  const capabilitiesById = new Map(
    capabilities.map((capability) => [capability.id, capability] as const),
  );

  const issues: SetupPlanIssue[] = [];

  for (const step of plan.steps) {
    const capability = capabilitiesById.get(step.capabilityId);

    if (capability === undefined) {
      issues.push({
        capabilityId: step.capabilityId,
        message: "Setup step references an undeclared capability.",
        stepId: step.id,
      });
      continue;
    }

    if (step.kind === "install") {
      const declaredArtifacts = capability.installationOptions ?? [];

      const matchesDeclaration = declaredArtifacts.some((artifact) =>
        artifactsMatch(artifact, step.artifact),
      );

      if (!matchesDeclaration) {
        issues.push({
          capabilityId: capability.id,
          message: "Install step does not match a declared installation option.",
          stepId: step.id,
        });
      }
    }

    if (step.kind === "authorize") {
      const authorization = capability.authorization;
      const matchesProvider = authorization.required && authorization.provider === step.provider;
      const methods = authorization.required ? authorization.methods : [];
      const matchesMethod = methods.includes(step.method);
      const declaredScopes = authorization.required ? authorization.scopes : [];

      const matchesScopes =
        declaredScopes.length === step.scopes.length &&
        declaredScopes.every((scope) => step.scopes.includes(scope));

      if (!matchesProvider || !matchesMethod || !matchesScopes) {
        issues.push({
          capabilityId: capability.id,
          message: "Authorization step exceeds or differs from the capability declaration.",
          stepId: step.id,
        });
      }
    }
  }

  return issues;
}
