import { useEffect, useState } from "react";

import { useHandOff, type HandOffRun, type HandOffSession } from "../data/use-hand-off";
import { describeAgo, describeStopwatch } from "../lib/time";

import "./hand-off.css";

const MAX_ROWS = 4;

type HandOffProps = {
  /** The Project on screen, listed first. */
  readonly projectId?: string | undefined;
  readonly onCaptured: (run: HandOffRun) => void;
};

/**
 * Lists repositories with a recent Claude Code or Codex session and asks that agent to write a
 * Handoff. The person never has to prompt the agent; they review the draft afterwards.
 */
export function HandOff({ projectId, onCaptured }: HandOffProps) {
  const { sessions, run, error, start } = useHandOff(onCaptured);

  if (run.status === "running") return <HandOffProgress run={run} />;

  if (sessions === undefined) {
    return (
      <p className="mono faint" role="status">
        Looking for coding-agent sessions…
      </p>
    );
  }

  const rows = sessions
    .toSorted(
      (left, right) => Number(right.projectId === projectId) - Number(left.projectId === projectId),
    )
    .slice(0, MAX_ROWS);

  return (
    <div className="hand-off">
      {run.status === "failed" ? (
        <p className="hand-off-error" role="alert">
          {run.error}
        </p>
      ) : null}
      {error === undefined ? null : (
        <p className="hand-off-error" role="alert">
          {error}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="hand-off-note">
          No Claude Code or Codex sessions found on this computer. Work on a GitHub project with
          one, then come back.
        </p>
      ) : (
        <ul className="hand-off-list">
          {rows.map((session) => (
            <HandOffRow
              key={session.repositoryPath}
              session={session}
              current={projectId !== undefined && session.projectId === projectId}
              onStart={start}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function HandOffRow({
  session,
  current,
  onStart,
}: {
  readonly session: HandOffSession;
  readonly current: boolean;
  readonly onStart: (repositoryPath: string) => void;
}) {
  const name = repositoryName(session.repositoryPath);

  return (
    <li>
      <span className="hand-off-project">
        <span className="hand-off-name">{name}</span>
        <span className="mono faint">
          {session.agentName} · {describeAgo(new Date().toISOString(), session.updatedAt)}
          {current ? " · this passport" : ""}
        </span>
      </span>
      <button
        className={current ? "btn btn-primary" : "btn"}
        type="button"
        aria-label={`Hand off ${name}`}
        onClick={() => onStart(session.repositoryPath)}
      >
        Hand off
      </button>
    </li>
  );
}

function HandOffProgress({ run }: { readonly run: Exclude<HandOffRun, { status: "idle" }> }) {
  const [now, setNow] = useState(() => new Date().toISOString());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().toISOString()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="hand-off" role="status" aria-live="polite">
      <p className="hand-off-running">
        <span className="hand-off-pulse" aria-hidden="true" />
        {run.agentName} is writing the Handoff for {repositoryName(run.repositoryPath)}
        <span className="mono faint"> {describeStopwatch(run.startedAt, now)}</span>
      </p>
      <p className="hand-off-note">
        It works from a copy of your latest session, with no tools, so nothing in your project
        changes. This usually takes about a minute.
      </p>
    </div>
  );
}

function repositoryName(path: string): string {
  return path.split("/").findLast((part) => part.length > 0) ?? path;
}
