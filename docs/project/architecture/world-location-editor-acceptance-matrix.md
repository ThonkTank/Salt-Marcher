# World Location editor acceptance matrix

Status: normative for the pre-release renderer refactor.

The product truth remains the World Planner and Hex requirements. This matrix
connects their cross-feature journeys to the architecture boundary and to the
strongest automated evidence. A unit test may explain a mechanism, but it does
not replace a journey-level guarantee listed here.

| ID | Journey / failure | Required result | Primary evidence |
| --- | --- | --- | --- |
| WL-01 | Create without initial placement | Location is saved and selected; placement remains unchanged | `world-location-save.test.ts` keep integration and `world-location-creation-controller.test.tsx` |
| WL-02 | Create with initial placement | Location save precedes placement; both succeed visibly | `world-location-save.test.ts` and `hex-location-workflow.e2e.ts` |
| WL-03 | Edit, keep placement | No Hex write is issued | `world-location-save.test.ts` integration |
| WL-04 | Move placement | Current map revision is resolved only at commit time | `world-location-placement-commit.test.ts`, `world-location-save.test.ts`, and `campaign-walking.e2e.ts` |
| WL-05 | Remove placement | Missing placement is an idempotent success | `world-location-save.test.ts` and the production removal in `hex-location-workflow.e2e.ts` |
| WL-06 | Inspect/switch map without choosing | Existing placement is retained | `hex-location-draft-field.test.tsx`, `hex-location-placement-draft.test.tsx`, and `hex-location-workflow.e2e.ts` |
| WL-07 | Expanded map: cancel/apply | Cancel restores its baseline; Apply retains the staged selection | `hex-location-draft-field.test.tsx` and `hex-location-workflow.e2e.ts` |
| WL-08 | Catalog, biome, reference or tag lookup failure | Stable data remains visible; base location fields remain saveable | `integrated-world-location-editor.test.tsx` and independent resource-state component tests |
| WL-09 | Stale revision | One re-read and one semantic revalidation; never a blind command replay | `world-location-placement-commit.test.ts` and `world-location-save.test.ts` |
| WL-10 | Occupied/missing map/missing tile | Typed partial result; saved location remains selected; retry repeats placement only | `world-location-save.test.ts` and the partial-save journey in `hex-location-workflow.e2e.ts` |
| WL-11 | Unknown command outcome | Resolve only through the command receipt for the same command id | `world-location-save.test.ts`, `world-location-application.test.ts`, and `world-location-placement-commit.test.ts` |
| WL-12 | Keyboard-only editing | Tags/references support arrows, Home/End, Enter, Escape and chip removal | `token-combobox.test.tsx` and the keyboard/zoom journey in `campaign-walking.e2e.ts` |
| WL-13 | Small viewport | Form, compact map, expanded map and actions remain reachable with visible focus/scroll affordances | Geometry assertions and Goldens in the Hex-location and dialog Electron journeys |
| WL-14 | Create map from location | Shared map dialog returns the exact new map; existing placement is retained until an explicit tile selection | `hex-map-application.test.ts`, `hex-location-draft-field.test.tsx`, and `hex-location-workflow.e2e.ts` |
| WL-15 | Create faction or table from location | Shared child dialog returns the exact new record, links it, and preserves every parent draft field; faction-to-table nesting preserves both parent drafts | Component dialog tests and the three-level stack in `hex-location-workflow.e2e.ts` |
| WL-16 | Nested dialog and popup stack | One scrim is painted; only the top layer is interactive; Escape closes popup, then child, then parent with focus restoration | `modal-dialog.test.tsx`, both nested-dialog Electron journeys, and stacked Goldens |

## Phase traceability

- Guardrails and bundle inventory: WL-08, WL-12, WL-13, WL-16.
- Relational tags: WL-01, WL-02, WL-12.
- Revision-free intent and typed save: WL-03 through WL-11.
- Projection controller and one-canvas views: WL-06 through WL-10 and WL-13.
- Workspace composition: all journeys; only the integration boundary may bind
  World Planner, Hex, Faction, and Encounter Table implementations.
- Dialog decomposition and independent searches: WL-08 and WL-12 through
  WL-16.

Every row must retain at least one journey- or integration-level assertion in
addition to any isolated unit test. Golden files are changed only after manual
inspection of expected and actual images.
