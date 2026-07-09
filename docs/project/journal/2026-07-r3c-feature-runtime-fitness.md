Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-08
Source of Truth: Tier-L design note for the R3c feature-runtime fitness gate.
Entry Document: [July 2026 Journal](2026-07.md)

# July 2026 R3c Feature Runtime Fitness Journal

## 2026-07-08 feature-runtime-fitness-gate - Add narrow R3c feature-runtime gate

Problem: `checkFeatureRuntimeEnforcement` previously proved only
`src/features/**` placement while PH-20260707 tracked high-drift
feature-runtime fitness expectations as review-owned.
Target state: the feature-runtime diagnostic surface runs the existing
layering-backed placement diagnostics plus a dedicated
`featureRuntimeFitness` bundle through `FeatureRuntimeFitnessRules`.
Decision: close PH-20260707 narrowly by enforcing package-family shape,
runtime-root presence, shell-binding narrowness, compatibility-seam locality,
and feature-scoped passive-carrier mirror absence.
Alternatives considered: leave the gap review-owned, or add a broad semantic
topology gate. The broad gate was rejected because it would overclaim complete
feature-runtime semantic conformance or force legacy view/domain role ceremony
into `src/features/**`.
Scope boundary: change only the feature-runtime fitness gate, its build-logic
registration, owner docs, project-health debt disposition, and focused-proof
wording. Remaining non-listed semantics stay Review-Owned.
Gate and docs: the target gate lives in build-harness
`FeatureRuntimeFitnessRules`, the `featureRuntimeFitness` enforcement bundle,
and the `feature-runtime` diagnostic surface; the durable wording lives in the
feature-runtime, layering-enforcement, quality-platform entrypoint, and
project-health-debt docs.
Risk: this is R3c work because it adds a frozen gate surface and diagnostic
bundle that can block future PRs; it must carry R3c review/label treatment and
the full required gate set before merge.
Scoped input proof already recorded green: `compileJava`,
`checkFeatureRuntimeEnforcement`, `checkDocumentationEnforcement`, and
`focused-handoff --path src/features/dungeon/runtime --area feature-runtime`
passed in the after-W10 stack worker.
Blocked before final handoff: after-W10 `production-handoff` is still red on
quality tasks (`pmdStrictMain`, `cpdMain`, `lizardMain`, `spotbugsMain`), and
the final combined stack still needs fresh integration, proof, and judge
review. This note does not claim merge readiness.
