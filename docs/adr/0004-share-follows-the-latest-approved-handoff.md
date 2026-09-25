# A share follows the latest approved Handoff

## Context

A Project continues for weeks; a Handoff is a snapshot of where it stands at one moment. The first
relay model bound one Project to one Handoff and one share forever: after publishing, the Project
could not be captured again, and the relay rejected any second share for the same Project. An
expired or revoked share therefore ended the Project's portability, and a Connection that expired
after its 24-hour cap could not be renewed.

## Decision

A Project has a sequence of Handoffs. Each capture mints a new Handoff identifier, and each Handoff
is separately previewed and approved. A share is the relay's copy of one Project's **latest
approved** Handoff, and Connections are scoped to the share rather than to a single Handoff.

- **Update.** Approving and publishing a new Handoff while the share has an active Connection
  replaces the share's Handoff, Setup Plan, and expiry in place. Destinations holding that
  Connection read the new Handoff without receiving a new token. The approval surface names the
  destinations that will see it; approval is the consent to deliver it.
- **Reshare.** Publishing when the share is revoked, expired, or has no active Connection creates
  a new share and Connection for the same Project and supersedes the old share. Only the identity
  that owns the existing share can supersede it; the Project identifier stays unique per share
  owner.
- **Retention.** The relay keeps only the current Handoff. An update overwrites the previous
  bundle; revocation and superseding delete the bundle and readiness records, retaining only the
  identifiers and timestamps needed to answer revoked or unrecognized. Expired bundles are purged
  on a schedule.
- **Readiness.** Destinations report Runtime readiness into a separate record. They can never
  modify the approved bundle.

## Consequences

- A destination with a live Connection receives future approved Handoffs for that Project until
  the Connection expires or is revoked. The 24-hour Connection cap bounds silent delivery; the
  dashboard must show which Connections will receive an approved Handoff.
- Tokens from a superseded share are unrecognized (401), while tokens from a revoked share that has
  not been superseded return revoked (410).
- D1 Time Travel can restore overwritten rows for its retention window. Deletion here means the
  relay no longer serves or stores the bundle in its live database, not immediate erasure from
  platform backups.
- The Handoff schema is unchanged; the version sequence is carried by distinct Handoff identifiers
  and `createdAt` order.
