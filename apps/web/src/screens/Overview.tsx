import { useNavigate } from "react-router";

import { Field } from "../components/Field";
import { HandOff } from "../components/HandOff";
import { Fingerprint } from "../components/Fingerprint";
import { Passport, PassportFoot, PassportRows, PassportRule } from "../components/Passport";
import { ReadinessList } from "../components/ReadinessList";
import { Stamp } from "../components/Stamp";
import { Ticks } from "../components/Ticks";
import { isHandoffStale, readinessRows, type PassportSnapshot } from "../data/snapshot";
import { usePassport } from "../data/use-passport";
import { destinationLabel } from "../lib/destination";
import {
  describeElapsedHours,
  describeRemaining,
  elapsedFraction,
  formatInstant,
  hoursBetween,
  shortRevision,
} from "../lib/time";
import { LoadGate } from "./LoadGate";

import "./overview.css";

const EXPIRING_UNDER_HOURS = 3;

export function Overview() {
  const { state, reload } = usePassport();
  const navigate = useNavigate();

  return (
    <LoadGate
      state={state}
      reload={reload}
      emptyLabel="No passport yet"
      emptyBody={
        <>
          <p>
            Pick a project you worked on with a coding agent. The agent writes the Handoff; you
            review it before anything is shared.
          </p>
          <HandOff onCaptured={() => void navigate("/share")} />
        </>
      }
    >
      {(snapshot) => (
        <PassportOverview snapshot={snapshot} onCaptured={() => void navigate("/share")} />
      )}
    </LoadGate>
  );
}

function PassportOverview({
  snapshot,
  onCaptured,
}: {
  readonly snapshot: PassportSnapshot;
  readonly onCaptured: () => void;
}) {
  const { identity, bundle, share, repository, observedAt } = snapshot;
  const { project, handoff, runtime } = bundle;
  const rows = readinessRows(snapshot);
  const stale = isHandoffStale(snapshot);
  const revoked = share?.status === "revoked";
  const readyCount = rows.filter((row) => row.readiness?.status === "ready").length;
  const allReady = rows.length > 0 && readyCount === rows.length;

  const hoursLeft = share === undefined ? 0 : hoursBetween(observedAt, share.expiresAt);
  const expiring = share?.status === "active" && hoursLeft > 0 && hoursLeft < EXPIRING_UNDER_HOURS;

  const issued =
    handoff.approvedAt === undefined ? undefined : `issued ${formatInstant(handoff.approvedAt)}`;

  const destination = destinationLabel(snapshot);

  return (
    <div className="overview">
      <figure aria-labelledby="passport-caption">
        <Passport
          variant="full"
          drained={revoked}
          issued={issued}
          ariaLabel={`Passport for ${project.name}`}
        >
          <PassportRows>
            <Field label="Holder">
              {identity.holder}
              {identity.sample ? <span className="dim"> · sample</span> : null}
              <span className="dim"> · this computer</span>
            </Field>
            <Field label="Key">
              <span className="dim">{identity.keyAlgorithm}</span>{" "}
              <Fingerprint value={identity.keyFingerprint} />
              {identity.sample ? <span className="dim"> · sample</span> : null}
            </Field>
            <Field label="Project">
              {project.repository.name}
              <span className="dim">
                {" "}
                · {project.repository.activeBranch} @ {shortRevision(project.repository.revision)}
              </span>
            </Field>
            <Field label="Source">
              {handoff.provenance.source}
              <span className="dim">
                {" "}
                · captured {formatInstant(handoff.provenance.capturedAt)}
              </span>
              {stale ? <span className="dim"> · stale</span> : null}
            </Field>
            <Field label="Handoff">{handoff.goal}</Field>
          </PassportRows>

          <PassportRule />

          <PassportRows>
            <Field label="Scopes">
              {share === undefined ? (
                <span className="dim">not shared</span>
              ) : (
                <span className={revoked ? "strike" : undefined}>
                  {share.scopes.map((scope, index) => (
                    <span key={scope}>
                      {index > 0 ? <span className="dim"> · </span> : null}
                      {scope}
                    </span>
                  ))}
                </span>
              )}
            </Field>
            <Field label="Share">
              {share === undefined ? (
                <span className="dim">not shared</span>
              ) : (
                <div className="ticks-row">
                  <Ticks
                    elapsed={elapsedFraction(share.issuedAt, share.expiresAt, observedAt)}
                    label={describeElapsedHours(share.issuedAt, share.expiresAt, observedAt)}
                    expiring={expiring}
                  />
                  {revoked ? (
                    <span>
                      <span className="strike">expires {formatInstant(share.expiresAt)}</span>
                      <span className="dim"> · revoked</span>
                    </span>
                  ) : (
                    <span>
                      expires {formatInstant(share.expiresAt)}
                      <span className={expiring ? "expiring" : "dim"}>
                        {" "}
                        · {describeRemaining(observedAt, share.expiresAt)}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </Field>
          </PassportRows>

          <PassportRule />

          <Field label={destination}>
            <ReadinessList rows={rows} wide ariaLabel={`Readiness in ${runtime.name}`} />
          </Field>

          <PassportFoot>
            {allReady ? (
              <Stamp when={formatInstant(runtime.reportedAt)}>{`Ready · ${destination}`}</Stamp>
            ) : (
              <span className="mono dim">
                {readyCount} of {rows.length} ready · reported {formatInstant(runtime.reportedAt)}
              </span>
            )}
            {revoked && share?.revokedAt !== undefined ? (
              <span className="pp-revoked">
                revoked <span className="dim">{formatInstant(share.revokedAt)}</span>
              </span>
            ) : null}
          </PassportFoot>
        </Passport>
        <figcaption id="passport-caption">
          {revoked
            ? `Revoked. ${destination} can no longer read this Handoff.`
            : share?.status === "expired"
              ? `Expired. ${destination} can no longer read this Handoff.`
              : share === undefined
                ? "Nothing shared yet. Approve a share to send a Handoff."
                : `Everything ${destination} receives. Nothing else.`}
        </figcaption>
      </figure>

      <aside className="rail" aria-label="On this computer">
        <section aria-labelledby="rail-hand-off">
          <h2 id="rail-hand-off">Hand off</h2>
          <HandOff projectId={project.id} onCaptured={onCaptured} />
        </section>

        <section aria-labelledby="rail-project">
          <h2 id="rail-project">Project</h2>
          <p className="lead">{project.name}</p>
          <ul className="facts">
            <li>
              <span>
                {project.repository.owner}/{project.repository.name}
              </span>
              <span className="r">{project.repository.provider}</span>
            </li>
            <li>
              <span>
                captured {project.repository.activeBranch} @{" "}
                {shortRevision(project.repository.revision)}
              </span>
              <span className="r">{formatInstant(handoff.provenance.capturedAt)}</span>
            </li>
            <li>
              <span>
                repository now {repository.branch} @ {shortRevision(repository.revision)}
              </span>
              <span className={stale ? "r is-caution" : "r"}>{stale ? "stale" : "current"}</span>
            </li>
            <li>
              <span>sensitivity</span>
              <span className="r">{handoff.sensitivity}</span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="rail-share">
          <h2 id="rail-share">Share</h2>
          {share === undefined ? (
            <p className="lead muted">Not shared</p>
          ) : (
            <ul className="facts">
              <li>
                <span>{share.destination}</span>
                <span className={`r is-${share.status}`}>{share.status}</span>
              </li>
              <li>
                <span>issued</span>
                <span className="r">{formatInstant(share.issuedAt)}</span>
              </li>
              <li>
                <span className={revoked ? "struck" : ""}>expires</span>
                <span className={revoked ? "r struck" : expiring ? "r is-caution" : "r"}>
                  {formatInstant(share.expiresAt)}
                </span>
              </li>
              {share.revokedAt === undefined ? null : (
                <li>
                  <span>revoked</span>
                  <span className="r is-revoked">{formatInstant(share.revokedAt)}</span>
                </li>
              )}
              <li>
                <span>last access</span>
                <span className="r">
                  {share.lastAccessAt === undefined
                    ? "unavailable"
                    : formatInstant(share.lastAccessAt)}
                </span>
              </li>
              <li>
                <span>token</span>
                <span className="r">
                  {share.tokenSuffix === undefined ? "hidden" : `···· ${share.tokenSuffix}`}
                </span>
              </li>
            </ul>
          )}
        </section>

        <section aria-labelledby="rail-destinations">
          <h2 id="rail-destinations">Destinations</h2>
          <ul className="facts">
            <li>
              <span>
                {runtime.name}
                {" · "}
                {runtime.platform}
              </span>
              <span className={allReady ? "r is-ready" : "r"}>
                {readyCount}/{rows.length} ready
              </span>
            </li>
            <li>
              <span>reported</span>
              <span className="r">{formatInstant(runtime.reportedAt)}</span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="rail-next">
          <h2 id="rail-next">Next actions</h2>
          {handoff.nextActions.length === 0 ? (
            <p className="lead muted">None recorded</p>
          ) : (
            <ol className="next-actions">
              {handoff.nextActions.map((action, index) => (
                <li key={action}>
                  <span className="n">{String(index + 1).padStart(2, "0")}</span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {handoff.blockers.length === 0 ? null : (
          <section aria-labelledby="rail-blockers">
            <h2 id="rail-blockers">Blockers</h2>
            <ul className="next-actions">
              {handoff.blockers.map((blocker) => (
                <li key={blocker}>
                  <span className="n">—</span>
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
