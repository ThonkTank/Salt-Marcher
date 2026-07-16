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

Current tree: `codex/greenfield-r4-vertical-packages` contains the complete R4
Vertical Packages candidate, based on merged R3 commit `93e44bf49`.

Completed: R0 Rule Cutover merged by PR #471. R1 Explicit Composition merged
by PR #473 with required CI green; discovery, service location, and service
contributions are deleted, and cross-feature references use typed provider
APIs. R2 Platform Runtime merged by PR #475 with required CI green; one
application-owned execution lane, explicit UI dispatch, revisioned state, and
payload-free local diagnostics are active in production. R3 SQLite Lifecycle
merged by PR #477 with required CI green; one application-owned database now
owns connection configuration, versioned feature migrations, integrity,
verified local backup, and physical-corruption recovery.

R3 scope: move shared database path, connection configuration, integrity,
local versioned backup, and tested recovery behind `platform.persistence` and
wire one application-owned database lifecycle into every SQLite adapter.
Feature adapters retain schema and migration ownership. Tests use isolated
temporary databases only; no migration command may touch real local data. R4
still owns vertical package moves.

R3 candidate proof: the platform lifecycle regressions, all eight adapters on
one injected database, and bootstrap smoke passed together in 35s. The complete
Dungeon Editor behavior suite passed in 2m 14s. Final full
`./gradlew check --console=plain` passed in 3m 11s after the last production and
test change. Recovery is limited to physical corruption; logical foreign-key
failure is proven fail-closed without replacing the primary.

R3 publication: PR #477 required CI passed in 1m 39s and merged as
`93e44bf49`.

R4 scope: move every production Java package from `bootstrap` and `src` into
`app` or a capability-owned `features/<name>` role; preserve one Dungeon
feature, explicit feature composition, stored truth, and observable behavior.
Update tests, resource/package references, build entry points, and dependency
direction in the same slice, then delete the empty legacy production roots.
R5 owns final repository cleanup, whole-system qualification, holistic review,
installation proof, and delivery-owner retirement.

R4 candidate proof: `bootstrap` and `src` contain zero production Java; the
main source set contains exactly `app`, `shell`, `platform`, and `features`.
All target sources and tests compile, `architectureTest` passed in 40s, full
`uiTest` passed in 1m 55s, and final `./gradlew check --console=plain` passed in
2m 39s after the last production and test change.

R4 rule correction: observable feature APIs may use the shared state/UI
contracts, JavaFX adapters may invoke their own application and typed domain
values plus foreign APIs, and application publication may use explicit UI
dispatch. The arbitrary nested-package cycle rule was removed; feature,
feature-role, and adapter-role cycles remain enforced. One real
Encounter/World Planner feature cycle was removed through an app-wired typed
callback.

R2 proof: after two direct review passes, all supported R2 state ownership,
ordering, startup-I/O, shutdown-drain, and failure-publication findings were
repaired with deterministic regressions. The final integrated regression set
passed in 15s and full `./gradlew check --console=plain` passed in 4m 6s.
PR #475 required CI passed in 1m 48s before merge.

Publication gate per migration slice: `git diff --cached --check` and literal
green full `./gradlew check --console=plain`. Push and merge only after required
PR CI is green. Do not run another slice review after the current R2 closure
fixes; complete R3 through R5 first, then run one independent direct review
panel over the fully migrated system before final installation and owner
acceptance.

Next action: publish the proven R4 candidate, require green PR CI, merge it,
sync `main`, and execute R5 final cleanup and whole-system qualification before
the one holistic migration review.
