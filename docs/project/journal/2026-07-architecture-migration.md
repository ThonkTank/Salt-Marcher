Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
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
