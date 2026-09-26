# Agent guidance

Act as a product engineer. Design, UX, security, and architecture are part of correctness.

## Start and finish

Maintainer notes (handoffs, product scope, research, design) live in `private/`, a separate private
repository that this repository ignores. When it exists, read `private/SESSION_HANDOFF.md` first.

Read `CONTEXT.md` before naming domain types or changing passport schemas. Use `private/docs/mvp.md`
for scope and `docs/security.md` for non-negotiable constraints.

Before ending material work, update `private/SESSION_HANDOFF.md` with the last session summary, next
work, and files to read, keeping it at 60 lines or fewer. Commit it in the `private/` repository.
Never move files from `private/` into this public repository.

Commit all completed, validated session work before ending the session. Leave changes uncommitted only when the user explicitly asks for a review checkpoint or the work is incomplete, and record that state in the branch handoff.

## How to work

- Before creating a file, inspect the target directory, similar patterns, and current dependencies.
- If a flat directory would reach 10 files, reconsider its structure before adding another.
- Question whether an existing component or module owns the new behavior before extending it.
- Extract shared logic when real duplication appears; do not create abstractions for hypothetical reuse.
- Raise unclear or misleading domain names before encoding them in public contracts.
- Check repository conventions plus library documentation and types before adding a package or custom implementation.
- Prefer established, maintained libraries when they reduce total complexity.
- Build the smallest durable end-to-end slice. Avoid both speculative infrastructure and deliberate throwaway paths.
- Study proven product patterns, then adapt them to this product instead of copying surface details.
- When ambiguity materially changes behavior, security, or public contracts, state the interpretations and ask. Otherwise make the smallest reversible assumption and record it.
- Before the first public release, remove obsolete paths instead of adding compatibility layers. After release, compatibility changes require an explicit decision.
- Keep UI labels self-explanatory. Add supporting copy only when it prevents misunderstanding or error.
- Comments explain enduring intent, constraints, or non-obvious tradeoffs—not edit history.

## Architecture boundaries

Keep shared domain contracts in `packages/domain`. Adapters, UI, persistence, and Jev integration consume those contracts instead of redefining them.

- Capability declarations never contain raw credentials.
- Destination authorization is explicit, scoped, and revocable.
- Jev makes narrow typed judgments; code controls policy and side effects.
- Context responses return the smallest useful payload and handles for deeper retrieval.
- UI work consumes shared fixtures until live interfaces exist.

Coordinate edits to root configuration, lockfiles, domain contracts, and fixtures across parallel branches.
