# W10 Reassembly Worker

Status: BLOCKED_NO_COMMIT
Date: 2026-07-08
Role: W10-Reassembly-Worker
Worktree: `/tmp/saltmarcher-arch-w10-reassembly-worker`
Branch: `codex/architecture-repair-w10-reassembly-worker`
Base: `806c0ac24654814436600cddceb5abb43f94af3f`

## Result

The clean W10 reassembly was built in a new worktree and left staged, but no
final commit was created because the required retained
`production-handoff` did not pass.

The W10-specific topology/readback proof is clean:

- WorldPlanner PH001 mirror records are absent from
  `src/view/leftbartabs/worldplanner`.
- Domain travel `Action`/`Operation` mirror usage is absent from the checked
  Domain/Harness scope.
- Project-health intake reports `Debt intake: none`.
- DeadCode report after integration reports zero files, types, constructors,
  methods, and fields.

## Inputs Applied

- CSS selector fix from `fa35df104b09adb8a6617a632d3acb1ff028fc04`.
- PH001 WorldPlanner resolution from
  `c99b78fdb8c2c5085297d03e2370ccc0a054673b`.
- DeadCode source diff from
  `d161aa298269184f7ea4ce153cd8f8e01eff7a38`, applied without the slice
  worker report file.
- DeadCode harness repair source/test diff from
  `fab0e69dc`, after its report recorded PASS for `compileTestJava`,
  `checkNoDeadCode`, and `dungeonEditorCoreBehaviorHarness`.
- Domain+Harness passive-carrier fix from the staged W10 split assembly subset:
  five `src/domain/dungeon/**` files plus
  `test/src/view/leftbartabs/dungeoneditor/DungeonRuntimeProjectionInvariantHarness.java`.

## Current Local State

- Local commits already on this branch:
  - `e5d986874` `Define world planner refresh selector`
  - `db4c73e79` `Resolve world planner search projection debt`
- Remaining reassembly integration is staged only, 23 files:
  Domain Dungeon, DungeonEditor deadcode consumers, and harness repair files.
- No final reassembly commit was created because required proof is red.

## Passed Proof

- `git diff --check` and `git diff --cached --check`: PASS.
- `rg "record SearchProjection|record FilterGroup|record FilterOption|record FilterChip" src/view/leftbartabs/worldplanner`: PASS, no hits.
- `rg "TravelDungeonSessionCommand\\.Action|TravelDungeonSessionCommand\\.Operation|\\bOperation\\.|\\.operation\\(" src/domain/dungeon test/src/view/leftbartabs/dungeoneditor/DungeonRuntimeProjectionInvariantHarness.java`: PASS, no hits.
- `python3 tools/quality/reporting/project_health_scan.py --intake --intake-only --worktree`: PASS, `Debt intake: none`.
- `./gradlew compileJava --console=plain`: PASS, `BUILD SUCCESSFUL in 6m 7s`.
- `./gradlew checkDomainEnforcement --console=plain`: PASS, `BUILD SUCCESSFUL in 4m 48s`.
- `./gradlew checkViewEnforcement --console=plain`: PASS, `BUILD SUCCESSFUL in 21m 46s`.

## Failed Required Proof

Command:

```text
tools/gradle/run-staged-verification.sh production-handoff
```

Retained logs:

- wrapper:
  `build/gradle-run-logs/20260708T130339Z-staged-production-handoff.log`
- observable:
  `build/gradle-run-logs/20260708T150341015282566-pid2572101-production-handoff.log`

Result:

```text
failure(exit 1)
Elapsed: 00h:31m:17s
66 actionable tasks: 37 executed, 10 from cache, 19 up-to-date
```

Final failing tasks:

1. `:cpdMain`
   - Duplicate 16-line `factMap(List<String>)` block between:
     - `src/view/leftbartabs/dungeoneditor/DungeonEditorStateStairGeometryContentPartModel.java:75`
     - `src/view/leftbartabs/dungeoneditor/DungeonEditorStateTransitionContentPartModel.java:186`
2. `:lizardMain`
   - Complexity warnings:
     - `src/domain/encounter/application/ApplyEncounterStateUseCase.java:64-90`
       `toSessionAction`, CCN 22
     - `src/domain/encounter/EncounterApplicationService.java:66-119`
       `toApplyStateRequest`, CCN 24
3. `:pmdStrictMain`
   - 72 violations total in `build/reports/pmd/main-strict.txt`.
   - W10/touched-scope examples:
     - `src/domain/dungeon/model/core/structure/corridor/CorridorDeletionTarget.java:6`
       `TooManyMethods`
     - `src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java:337`
       duplicate literal `"table"`
     - `src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java:353`
       duplicate literal `"faction"`
   - Broad out-of-scope families include Dungeon runtime/editor, Encounter,
     and feature-runtime pointer-target PMD debt.
4. `:spotbugsMain`
   - One `EI_EXPOSE_REP` finding:
     `src/features/dungeon/runtime/DungeonEditorRuntimeDependencies.java:50`
     in `AuthoredMapPersistence.dungeonMapRepository()`.

## Blocker

This pass is blocked on green inputs or authorized scope for the remaining
production-handoff failures above. Per instruction, I did not apply broad
baseline repairs outside the W10 reassembly input set, and I did not commit a
red handoff.
