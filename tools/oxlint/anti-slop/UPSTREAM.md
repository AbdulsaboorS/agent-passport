# Anti-Slop provenance

- Source: <https://github.com/dmmulroy/anti-slop>
- Source commit: `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`
- Installed from: `skills/install-anti-slop/assets/anti-slop/`
- Installed path: `tools/oxlint/anti-slop/`
- Installed: 2026-09-20
- Intentional deviations: none

The vendored plugin is ignored by this repository's formatter and linter. Its generic rules are
enabled in `oxlint.config.ts`; the opt-in Effect rules are not enabled because this repository does
not depend directly on Effect.
