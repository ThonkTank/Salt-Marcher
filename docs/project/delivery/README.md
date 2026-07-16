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

Current tree: `codex/greenfield-r5-final-qualification` is the final R5 cleanup
and qualification slice, based on merged R4 commit `c49d82178`.

Completed: R0 Rule Cutover merged by PR #471. R1 Explicit Composition merged
by PR #473 with required CI green; discovery, service location, and service
contributions are deleted, and cross-feature references use typed provider
APIs. R2 Platform Runtime merged by PR #475 with required CI green; one
application-owned execution lane, explicit UI dispatch, revisioned state, and
payload-free local diagnostics are active in production. R3 SQLite Lifecycle
merged by PR #477 with required CI green; one application-owned database now
owns connection configuration, versioned feature migrations, integrity,
verified local backup, and physical-corruption recovery. R4 Vertical Packages
merged by PR #479 with required CI green; all production Java now lives under
`app`, `shell`, `platform`, or vertical `features`, and `app` composes only
feature roots and APIs.

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

R4 publication: PR #479 required CI passed in 1m 53s and merged as
`c49d82178`.

R5 scope: remove active obsolete source-shape references and other migration
residue, qualify the whole target system, run the one independent holistic
review over R0-R5, fix only material supported findings, prove the installed
desktop application, publish and merge the final slice, then retire this
temporary delivery owner after owner acceptance.

R5 holistic review found four material endpoint gaps: mutable publication
escaped through provider read models, Hex and Dungeon APIs retained string or
duplicate boundary carriers, Dungeon inspector proof retained free-form debug
facts, and SQLite preflight/recovery could mutate or partially move a database
family before safe completion. The R5 candidate now keeps publishers inside
their features, uses typed API values and one Dungeon topology reference,
removes inspector compatibility facts, validates an isolated SQLite family,
and rolls back every completed quarantine/restore move. Durable owner and
agent-skill text no longer presents migration-stage rules as current truth.

The final panel additionally found a racy preflight snapshot, incomplete
rollback-journal and backup-version handling, and a relocated Dungeon inspector
debug carrier. The corrected candidate now creates its backup through a
read-only SQLite snapshot, treats rollback journals as database-family state,
validates stored backup versions, publishes only authored inspector summaries,
and proves the typed feature-marker selection route.

Affected-risk revalidation accepted the Dungeon inspector/selection repair and
identified one final SQLite crash case. A valid primary with a hot rollback
journal is now copied under an exclusive OS lock and recovered only in an
isolated writable family before its read-only snapshot is accepted; an active
writer fails closed without a backup.

The strengthened Hot-Journal fixture now proves SQLite's journal magic and an
uncommitted page spill in the primary before isolated recovery; the original
family remains byte-identical while the verified backup contains only committed
truth.

Final R5 proof: all 16 SQLite lifecycle regressions and the feature-marker
production route passed; two consecutive warm
`./gradlew check --rerun-tasks --console=plain` runs passed in 4m 11s and 3m
40s; the following no-change `./gradlew check --console=plain` passed in 3s.
Branch-protection readback names exactly `check` as required status context.

Final review: the direct Main panel accepted the target architecture, typed
boundaries, state ownership, Dungeon inspector/selection route, governance,
and the strengthened SQLite recovery proof with no remaining code blocker.
`./gradlew installDesktopApp --console=plain` then passed in 16s.

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

Next action: publish and merge R5 through required green CI, then obtain owner
acceptance and delete this temporary delivery owner.
