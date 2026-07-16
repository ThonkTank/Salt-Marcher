Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Target: [Source Architecture](../architecture/source-architecture.md)

# Architecture Migration Delivery

Goal: Replace the horizontal source architecture with the explicit,
non-blocking vertical feature modular monolith defined by the target owner.

Finish: only `app`, `shell`, `platform`, and `features` remain as production
Java roots; feature collaboration uses provider APIs; explicit composition,
versioned SQLite recovery, local diagnostics, green CI, independent review, and
owner acceptance are complete; this file is deleted.

Current tree: `codex/greenfield-r2-platform-runtime` at the integrated R2
Platform Runtime candidate, based on merged R1 commit `6878a5cad`.

Completed: R0 Rule Cutover merged by PR #471. R1 Explicit Composition merged
by PR #473 with required CI green; discovery, service location, and service
contributions are deleted, and cross-feature references use typed provider
APIs.

R2 candidate: one application-owned serial execution lane, explicit JavaFX UI
dispatch, revisioned latest-state publication, and payload-free local
diagnostics are wired through production composition. Material persistence
commands run off JavaFX; feature state and immutable Dungeon frames cross the
UI seam explicitly; stale Creature, Hex, Dungeon, catalog-event, and Session
failure routes have deterministic regression coverage. Application shutdown
closes the lane. R3 still owns SQLite lifecycle/recovery; R4 still owns
vertical package moves.

Proof: after two direct review passes, all supported R2 state ownership,
ordering, startup-I/O, shutdown-drain, and failure-publication findings were
repaired with deterministic regressions. The final integrated regression set
passed in 15s and full `./gradlew check --console=plain` passed in 4m 6s.
Pre-existing multi-step SQLite recovery remains R3-owned. The exact final
staged state still requires refreshed proof before publication.

Publication gate per migration slice: `git diff --cached --check` and literal
green full `./gradlew check --console=plain`. Push and merge only after required
PR CI is green. Do not run another slice review after the current R2 closure
fixes; complete R3 through R5 first, then run one independent direct review
panel over the fully migrated system before final installation and owner
acceptance.

Next action: publish the proved R2 pull request. Then execute R3 through R5
without intermediate review-polish loops; review the combined final
architecture once.
