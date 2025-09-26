# Map Manager Overview

## Purpose & Audience
This document guides developers who integrate `createMapManager` into feature views. It explains the supporting helpers, deletion safeguards, and error handling expectations.

## Directory Map
| Path | Description | Primary Docs |
| --- | --- | --- |
| `src/ui/map-manager.ts` | Exposes `createMapManager`, the central orchestration object. | [`../src/ui/UiOverview.txt`](../src/ui/UiOverview.txt) |
| `src/ui/map-workflows.ts` | Provides selection and creation prompts consumed by the manager. | [`../src/ui/UiOverview.txt`](../src/ui/UiOverview.txt) |
| `src/ui/confirm-delete.ts` | Confirmation modal that protects destructive actions. | [`../src/ui/UiOverview.txt`](../src/ui/UiOverview.txt) |
| `src/core/map-delete.ts` | Removes map files and associated tiles. | [`../core/README.md`](../core/README.md) |

## Key Workflows
1. **State coordination.** `createMapManager` encapsulates the current map (`current`) and exposes `open`, `create`, `setFile`, and `deleteCurrent` actions.
2. **Selection and creation.** Both flows delegate to helpers in `map-workflows.ts`, ensuring consistent modals and notices.
3. **Deletion safety.** `deleteCurrent` launches `ConfirmDeleteModal`. Only after successful confirmation does it call `deleteMapAndTiles`, which clears the tracked file and invokes the `onChange` callback with `null`.

## Linked Docs
- [Shared UI components](README.md) – catalog of related building blocks.
- [UI terminology reference](terminology.md) – approved copy for notices and button labels.

## Standards & Conventions
- Wrap destructive operations in `try/catch` and surface failures through both logging (`console.error`) and notices sourced from `MAP_MANAGER_COPY`.
- New states or notices must be added to `MAP_MANAGER_COPY` and reflected in the glossary.
- Tests under `tests/ui/map-manager.test.ts` should remain in sync with any behavioral change or new copy requirement.
