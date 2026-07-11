Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-11
Source of Truth: July 2026 architecture-migration retros and durable pilot
lessons.

# July 2026 Architecture Migration Journal

## 2026-07-09 architecture-migration-m2-hex-retro - Close Hex pilot migration

The Hex pilot completed the full migration cycle on branch
`codex/architecture-migration-m0-charter`. Reference commit `3679a19e2`
collapsed the per-verb Hex usecases, travel ports, published-state adapters,
and Hex view content/input/intent-handler stack into the approved target
services, stateful published models, `HexMapViewModel`, and `HexMapVocabulary`.
The useful pilot pattern is concrete design first, wiring-port commit second,
then deletion-list execution in one behavior-neutral implementation pass.
The original 40% product LOC target was too strict for Hex once
byte-compatible published seams and frozen JavaFX view behavior were retained:
Phase 1 and Phase 2 accepted the bounded 41-file / 3,701-LOC exception, without
recalibrating rollout targets. Future areas should keep the chain, forwarding,
deletion-list, and String-roundtrip targets hard, but treat LOC as an
evidence-backed review gate rather than an invitation to compress readable
code. Harness proof also exposed a desktop Gradle environment quirk: retained
log attempts that redirect output fail before task execution with wildcard-IP
startup errors, while direct `env -u CODEX_THREAD_ID` harness execution passes.

## 2026-07-09 architecture-migration-m3-creatures-retro - Close Creature rollout

The Creature rollout completed the full migration cycle on branch
`codex/architecture-migration-m0-charter`. Reference commit `246d39267`
collapsed the Creature read-only catalog path from four per-route usecases,
an internal published-state repository, and publication assemblies into
`CreaturesApplicationService`, `CreatureCatalogProjection`, `CreaturesServiceAssembly`,
stateful published models, and the unchanged `CreatureCatalogPort` seam. The
implementation kept `CreaturesServiceContribution`, published records/enums,
commands, and `CatalogSearchSpec.sortField()` byte-compatible; the only data
touch was the approved typed sort-field gateway adaptation in the mapper.
Phase 1 and Phase 2 accepted the 27-file / 1,749-LOC result under the design's
1,750-LOC cap because retained published seams plus `CreatureCatalogData`
carry most of the unavoidable line count. The useful rollout lesson is that
read-only reference catalogs can remove behavior-forwarding layers without
inventing an authored write model; keep the public catalog vocabulary stable
and move lookup normalization/status publication into the application service.

## 2026-07-11 architecture-migration-m45-harness-closure - Carry hit-ref debt into design

M4.5 `dungeon-editor-view` harness closure ran the full mapped editor-view
suite in a clean detached proof worktree at `5df089e6a`: the eleven mapped
editor harness tasks, dungeon render parity, travel projection, topology, and
harness-map consistency all passed with frozen scenarios and assertions. The
focused handoff wrapper stopped before Gradle because project-health intake
matched `PH-20260711-001` against `dungeon-editor-view`. Phase 1 review
classified that as real active M4.5 debt, not as a harness coverage gap:
baseline/design must count the runtime/editor hit-ref and pointer-target string
protocol, and later M4.5 handoff remains blocked until the debt is structurally
resolved or legitimately narrowed. No documentation gate was used as migration
acceptance evidence.
