Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M3.5 Session Planner LOC exception amendment for the
architecture migration target design.

# Session Planner LOC Exception Amendment

## Scope

This amendment applies only to M3.5 Session Planner implementation review. It
does not change the approved target classes, deletion list, seam statement,
harness freeze, or non-LOC metric targets in
`docs/project/architecture/architecture-migration-sessionplanner-target-design.md`.

The implemented M3.5 product subset lands at 51 Java files and 5,170 physical
LOC, not the original 3,998 LOC target. Phase 1 and Phase 2 must explicitly
accept or reject this as a bounded exception capped at 5,200 physical LOC.

## Rationale

The miss is concentrated in behavior-bearing or byte-compatible seams that the
M3 design requires to survive:

| Class | LOC | Reason |
| --- | ---: | --- |
| `SessionPlannerViewModel` | 937 | Owns the typed JavaFX projection, widget-token map, scene drafts, and catalog seam after deleting the old content models. |
| `SessionPlannerTimelineMainView` | 601 | Retains the public JavaFX timeline view surface and visible parity with the frozen shell-layout harness. |
| `SessionPlannerProjection` | 525 | Replaces seven deleted projection/readback assemblies in one target projector while preserving old status text and projection math. |
| `SessionPlan` | 480 | Retains the existing aggregate for session scenes, participants, rest, loot, encounter days, and selected encounter state. |
| `SessionPlannerBinder` | 381 | Owns direct callback routing after deleting `SessionPlannerIntentHandler` and the old input-event records. |
| `SessionPlannerApplicationService` | 271 | Absorbs the deleted split services and use cases while preserving public command seams and storage-error behavior. |

These lines are not retained to satisfy a checker cosmetically. The CPD repair
must remain structural: publication state and listener mechanics are owned by
shared `src.domain.shared.published.PublishedState`, not by duplicated helper
loops or rephrased copies.

## Review Conditions

The exception is valid only if review verifies:

- all 57 deletion-list files are gone;
- `model/session/usecase/` and `model/session/port/` are empty or absent;
- no split service or old content/input/intent-handler references remain;
- shared `PublishedState` owns publication state/listener mechanics;
- rest-kind `.name()` string round-trips are absent;
- frozen Session Planner harnesses and `production-handoff` are green.

The exception does not relax the 55-file target, forwarding-only target,
chain-length target, String-roundtrip target, byte-compatible seam statement,
or frozen-harness parity rules.
