# Agent guidance

Start or resume work by reading `SESSION_HANDOFF.md`. Update it before ending a session that materially changes repository state, decisions, validation, blockers, or next actions.

Read `CONTEXT.md` before naming domain types or changing the passport schema. Product requirements live in `docs/product.md` and `docs/mvp.md`; security constraints in `docs/security.md` are requirements, not suggestions.

Keep shared domain contracts in the future `packages/domain` module. Destination adapters, UI code, persistence, and Jev integration must consume those contracts instead of redefining them.

Preserve these invariants:

- A capability declaration contains no raw credential.
- Every destination authorization is explicit, scoped, and revocable.
- Jev makes narrow typed judgments; code controls policy and side effects.
- Context endpoints return the smallest useful response and provide handles for deeper retrieval.
- UI work consumes shared fixtures until live interfaces exist.

Coordinate edits to root configuration, shared contracts, fixtures, and lockfiles across parallel branches before changing them.
