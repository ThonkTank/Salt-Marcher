# Application-layer refactor acceptance matrix

Status: normative for the pre-release editor refactor.

## Recorded baseline

The authoritative pre-refactor worktree was recorded on 2026-08-07 before the
remaining architecture changes in this matrix:

- `pnpm check`: green; 73 test files and 326 tests.
- reachable renderer graph: 3,018,531 bytes.
- shell initial graph: 769,056 bytes.
- common Workspace graph: 1,049,403 bytes.
- Session/Catalog/Hex/Reference lazy graphs: 347,038 / 379,048 / 346,673 /
  97,770 bytes.
- Pixi dynamic leaf graph: 1,622,455 bytes.

This baseline is evidence of the starting state only. It does not satisfy a
row below unless the named implementation and focused evidence also exist.

The refactor does not add product features. It makes command outcomes,
revision ownership, partial-save recovery, nested dialogs, and development
feedback deterministic while retaining the journeys in the
[World Location editor acceptance matrix](world-location-editor-acceptance-matrix.md).

| ID | Guarantee | Required evidence |
| --- | --- | --- |
| AR-01 | Location, Faction, Encounter Table, and Hex Map creation returns the exact saved record without aggregate-ID differencing | Contract, store/service, and renderer-port tests |
| AR-02 | Installation and campaign Encounter Table snapshots advance independently and delayed reads cannot overwrite a newer scope | Contract and accumulator tests |
| AR-03 | Encounter Table picker summaries are utility-computed; opening a Faction editor does not request every referenced Creature detail | Integration and dialog tests |
| AR-04 | Location base save commits before placement and survives every typed placement rejection | Core application and Electron journey |
| AR-05 | An unknown Location save outcome is read by command identity; missing receipts are never replayed automatically | Core interruption and renderer-port tests |
| AR-06 | Explicit retry after partial save repeats placement only | Core application and Electron journey |
| AR-07 | Switching or creating the viewed map does not alter placement until a tile is selected | Placement controller and Electron journey |
| AR-08 | Direct and nested Hex Map creation execute the same renderer application use case | Port/controller tests |
| AR-09 | A post-persistence projection failure cannot issue a second mutation | Submission-lifecycle and dialog tests |
| AR-10 | Related Location, Faction, and Encounter Table dialogs are sibling overlays and preserve every mounted parent draft | Component and Electron nested-dialog journey |
| AR-11 | Escape and focus order is popup, child modal, parent modal, application | Overlay unit and Electron dialog journey |
| AR-12 | Encounter percentage allocation is independent of asynchronously loaded names and locale | Pure unit tests |
| AR-13 | Editor headers and footers remain fixed at the supported minimum viewport; only bodies scroll | Geometry assertions, axe, and Goldens |
| AR-14 | Renderer import boundaries are enforced by lint where possible and Pixi remains a dynamic leaf | Lint and bundle architecture tests |
| AR-15 | Golden updates name their exact target and E2E suites use isolated seeded data roots | Script tests and canonical check |

The implementation is complete only when every row has its listed evidence and
`pnpm check` passes from the production build.

## Implemented evidence

| ID | Concrete evidence |
| --- | --- |
| AR-01 | `world-location-save.test.ts`, `encounter-sources.test.ts`, `world-location-application.test.ts`, and `hex-map-application.test.ts` assert exact saved records and command receipts; `architecture-boundaries.test.ts` rejects ID-differencing adapters. |
| AR-02 | `encounter-table-snapshot.test.ts` covers crossed and delayed scope revisions; `encounter-table-application.test.ts` covers port-side accumulation. |
| AR-03 | `encounter-sources.test.ts` verifies deterministic count, CR, and biome summaries; `faction-table-picker.test.tsx` and `world-faction-dialog.test.tsx` prove summary-only browsing, bounded selected-table fact loading, and queue pruning after a table switch. |
| AR-04 | `world-location-save.test.ts` covers base failure, keep, place, remove, occupied, missing tile/map, and typed partial success; `hex-location-workflow.e2e.ts` exercises the production command. |
| AR-05 | `world-location-save.test.ts` leaves a readable provisional journal receipt after interruption; `world-location-application.test.ts` proves receipt-only recovery and no replay when absent. |
| AR-06 | Core and renderer application tests assert same-command placement-only retry; `hex-location-workflow.e2e.ts` verifies that the Location revision does not advance during retry. |
| AR-07 | `hex-location-placement-draft.test.tsx` and `hex-location-draft-field.test.tsx` separate viewed map from selection; the Hex Location journey preserves placement while creating a map. |
| AR-08 | `hex-map-application.test.ts`, `hex-map-dialog.test.tsx`, and `architecture-boundaries.test.ts` prove direct and nested creation share `createHexMapApplicationPort`; direct and embedded placement share `createWorldLocationPlacementCommitter`. |
| AR-09 | `submission-lifecycle.test.ts`, `hex-map-dialog.test.tsx`, and the Faction/Encounter dialog tests prove reconciliation-only retries after persistence. |
| AR-10 | `integrated-world-location-editor.test.tsx` and `modal-dialog.test.tsx` cover sibling forms; `hex-location-workflow.e2e.ts` preserves Location → Faction → Table drafts. |
| AR-11 | `modal-dialog.test.tsx` covers popup, alert, child, and parent ordering plus focus restoration; `dialog-architecture.e2e.ts` covers the production overlay stack. |
| AR-12 | `encounter-table-shares.test.ts` proves identity-based deterministic allocation; `encounter-table-manager.test.tsx` compares percentages and entry order before and after deferred Creature facts resolve. |
| AR-13 | Shared geometry assertions are used by the Location and dialog journeys at the minimum viewport; `surface-contrast.test.ts` covers both themes and the checked Goldens cover all refactored frames. |
| AR-14 | Area-specific ESLint restrictions and `architecture-boundaries.test.ts` enforce process/application boundaries plus Pixi, Related-Creation, and Faction lazy leaves; `test:bundle-budget` enforces every graph. |
| AR-15 | `visual-golden-policy.test.ts` proves manifest selector, suite, and viewport use; `bundle-budget-policy.test.ts` covers growth and downward ratchets; `wdio.conf.ts` and `run-e2e-suites.ts` provide versioned, isolated, at-most-two-way fixture execution. |

## Final verification

The canonical `pnpm check` completed successfully on 2026-08-07 after the
Schema-20 change, aggregate-ownership audit, and final downward baseline
ratchet:

- formatting, lint, both TypeScript projects, reference artifacts, and render
  qualification artifacts passed;
- 82 Vitest files passed with 366 tests;
- the production build and utility-process smoke test passed;
- all five isolated Electron suites passed with eight journeys; and
- the reachable renderer measured 3,045,295 bytes, leaving 310,148 bytes below
  the 3.20 MiB hard ceiling. Its 90.8% use emits the intended warning only.
