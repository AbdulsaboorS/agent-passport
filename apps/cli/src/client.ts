import type { CaptureAssessmentOutcome, PassportBundle, ProjectBrief } from "@agent-passport/api";

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response> | Response;

type PublishResponse = {
  readonly project: ProjectBrief;
};

export class PassportApiClient {
  readonly #baseUrl: string;
  readonly #fetch: Fetch;

  constructor(baseUrl: string, fetchImplementation: Fetch = fetch) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#fetch = fetchImplementation;
  }

  assess(bundle: PassportBundle, token: string): Promise<CaptureAssessmentOutcome> {
    return this.#request<CaptureAssessmentOutcome>(
      `/v1/projects/${bundle.project.id}/assess`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ project: bundle.project, handoff: bundle.handoff }),
      },
    );
  }

  publish(bundle: PassportBundle, token: string): Promise<PublishResponse> {
    return this.#request<PublishResponse>(`/v1/projects/${bundle.project.id}/publish`, token, {
      method: "POST",
      body: JSON.stringify({ bundle, approved: true }),
    });
  }

  getProject(projectId: string, token: string): Promise<ProjectBrief> {
    return this.#request<ProjectBrief>(`/v1/projects/${projectId}`, token);
  }

  async #request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);

    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Agent Passport API returned ${response.status}: ${detail}`);
    }

    // SAFETY: Each caller supplies the response type declared by the matching OpenAPI route.
    return (await response.json()) as T;
  }
}
