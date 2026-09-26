import { useCallback, useEffect, useRef, useState } from "react";

import { localApi } from "./use-passport";

export type HandOffSession = {
  readonly agent: "claude-code" | "codex";
  readonly agentName: string;
  readonly sessionId: string;
  readonly repositoryPath: string;
  readonly updatedAt: string;
  readonly projectId?: string;
};

export type HandOffRun =
  | { readonly status: "idle" }
  | {
      readonly status: "running" | "succeeded" | "failed";
      readonly agentName: string;
      readonly repositoryPath: string;
      readonly startedAt: string;
      readonly finishedAt?: string;
      readonly projectId?: string;
      readonly error?: string;
    };

export type HandOffState = {
  /** `undefined` while the first scan runs. */
  readonly sessions: readonly HandOffSession[] | undefined;
  readonly run: HandOffRun;
  readonly error: string | undefined;
  readonly start: (repositoryPath: string) => void;
};

const POLL_MS = 1500;

const FIXTURE_SESSIONS: readonly HandOffSession[] = [
  {
    agent: "claude-code",
    agentName: "Claude Code",
    sessionId: "fixture",
    repositoryPath: "/Users/you/Developer/widgets",
    updatedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    agent: "codex",
    agentName: "Codex",
    sessionId: "fixture-2",
    repositoryPath: "/Users/you/Developer/billing",
    updatedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
  },
];

/**
 * The Hand off seam: which repositories have a resumable coding-agent session, and the one run the
 * daemon allows at a time. `onCaptured` fires once a draft Handoff is saved.
 */
export function useHandOff(onCaptured: (run: HandOffRun) => void): HandOffState {
  const [sessions, setSessions] = useState<readonly HandOffSession[]>();
  const [run, setRun] = useState<HandOffRun>({ status: "idle" });
  const [error, setError] = useState<string>();
  const captured = useRef(onCaptured);
  captured.current = onCaptured;

  useEffect(() => {
    if (import.meta.env.DEV) {
      setSessions(FIXTURE_SESSIONS);

      return;
    }

    let cancelled = false;

    void Promise.all([
      localApi<{ sessions: HandOffSession[] }>("/api/hand-off/sessions"),
      localApi<HandOffRun>("/api/hand-off"),
    ]).then(
      ([found, current]) => {
        if (cancelled) return;

        setSessions(found.sessions);

        // A run started before a reload keeps going; pick it back up.
        if (current.status === "running") setRun(current);
      },
      (cause: Error) => {
        if (!cancelled) {
          setSessions([]);
          setError(cause.message);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (run.status !== "running" || import.meta.env.DEV) return;

    const timer = window.setInterval(() => {
      void localApi<HandOffRun>("/api/hand-off").then(
        (next) => {
          if (next.status === "running") return;

          setRun(next);

          if (next.status === "succeeded") captured.current(next);
        },
        (cause: Error) => setError(cause.message),
      );
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [run.status]);

  const start = useCallback((repositoryPath: string) => {
    setError(undefined);

    if (import.meta.env.DEV) {
      const running: HandOffRun = {
        status: "running",
        agentName: "Claude Code",
        repositoryPath,
        startedAt: new Date().toISOString(),
      };

      setRun(running);
      window.setTimeout(() => setRun({ ...running, status: "succeeded" }), 3000);

      return;
    }

    void localApi<HandOffRun>("/api/hand-off", "POST", { repositoryPath }).then(
      setRun,
      (cause: Error) => setError(cause.message),
    );
  }, []);

  return { sessions, run, error, start };
}
