# Agent guidance

Start or resume work by reading the shared `SESSION_HANDOFF.md`, then the handoff for the current branch:

- `codex/mvp` -> `docs/handoffs/mvp.md`
- `fable/ui` -> `docs/handoffs/ui.md`

On `main`, the shared handoff is sufficient unless the task is preparing one of those branches.

Update the branch handoff before ending a session that materially changes repository state, validation, blockers, or next actions. Update the shared handoff only when a cross-branch decision changes or integrated work lands on `main`.

Read `CONTEXT.md` before naming domain types or changing the passport schema. Product requirements live in `docs/product.md` and `docs/mvp.md`; security constraints in `docs/security.md` are requirements, not suggestions.

Keep shared domain contracts in the future `packages/domain` module. Destination adapters, UI code, persistence, and Jev integration must consume those contracts instead of redefining them.

Preserve these invariants:

- A capability declaration contains no raw credential.
- Every destination authorization is explicit, scoped, and revocable.
- Jev makes narrow typed judgments; code controls policy and side effects.
- Context endpoints return the smallest useful response and provide handles for deeper retrieval.
- UI work consumes shared fixtures until live interfaces exist.

Coordinate edits to root configuration, shared contracts, fixtures, and lockfiles across parallel branches before changing them.
