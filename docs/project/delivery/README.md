Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Target: [Source Architecture](../architecture/source-architecture.md)

# Architecture Migration Delivery

Goal: Replace the horizontal source architecture with the explicit,
non-blocking vertical feature modular monolith defined by the target owner.

Finish: only `app`, `shell`, `platform`, and `features` remain as production
Java roots; feature collaboration uses provider APIs; explicit composition,
versioned SQLite recovery, local diagnostics, green CI, independent review, and
owner acceptance are complete; this file is deleted.

Current tree: `codex/greenfield-r0-rule-cutover`; base and HEAD `0d9e8de9d`;
owned dirty scope is R0 documentation, architecture tests, obsolete
form-enforcement build code, and annotation-only removal of dead `PMD.*`
suppressions from 41 production Java files; active slice is R0 Rule Cutover.

Completed: R0 candidate replaces the horizontal/discovery/registry/form rules
with target feature/API/composition owners, target ArchUnit enforcement, and a
mechanism-neutral startup smoke test. Obsolete PMD form rules, settings build,
inactive FXML form task, feature-local delivery note, and superseded project
architecture owners are removed. Executable runtime behavior, signatures,
imports, state, and control flow are unchanged.

Legacy inventory for later slices: shell service lookup, bootstrap-owned
stylesheet loading, horizontal feature/runtime packages, the Encounter Table
cross-feature SQL join, and adopter-local Maps/Dungeon rendering and input
types. Dungeon persistence also still transports cluster-relative boundary
rows. This inventory has no target authority.

Proof: the Gradle source-input rename proof reran both `test` and
`architectureTest` (`BUILD SUCCESSFUL in 2m 31s`) and the temporary probe is
removed. After the fifteenth-review repairs, fresh `architectureTest
--rerun-tasks` is `BUILD SUCCESSFUL in 37s` with all ten target tests (1
dependency, 8 cycle, 1 source/package), and full `./gradlew check
--console=plain` is `BUILD SUCCESSFUL in 2m 28s` with `test` executed.
The complete 135-file candidate is staged; `git diff --cached --check` passes
with no output, no `PMD.*` key remains, and the warm full `check` is `BUILD
SUCCESSFUL in 2s` with all six tasks up-to-date. Independent final review is
`CLEAN` with no remaining architecture, convention, behavior, or proof finding.

Publication gate: `git diff --cached --check`, a warm full `check`, and an
independent review must assess this exact staged diff. A clean result authorizes
committing and opening the R0 pull request without further edits.

Next action: commit this unchanged R0 candidate and open its pull request.

Blocker: None.
