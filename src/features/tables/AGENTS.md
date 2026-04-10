# Generic Tables Feature

## Purpose

`features.tables` owns the app-wide tables workspace that hosts loot-table and encounter-table editors behind one shared shell entry, plus the generic table-editor scaffolding that does not belong to either feature alone.

## Canonical Types and APIs

- `TablesObject` - canonical tables root for workspace composition and shell-facing handoff.
- `features.tables.input` - canonical owner-local requests and result carriers for the tables root.
- `features.tables.api.TablesModule` - compatibility facade for older shell/bootstrap wiring.
- `ui/TablesWorkspaceView` - tables-owned combined workspace surface for switching between encounter and loot editors.
- `ui/ManagedTableControls` - generic table-editor controls scaffold shared by encounter-table and loot-table editors.
- `ui/TableEditorTaskRunner` - generic async task submission helper for table-editor background work.

## Where New Code Goes

- Put shared encounter-table/loot-table workspace composition here.
- Keep generic editor scaffolding that is reused by both table features here.
- Keep loot-specific and encounter-specific semantics in their owning features.

## Forbidden Drift

- Do not move loot-table or encounter-table business rules into `features.tables`.
- Do not reintroduce `api` as the factual tables workspace root.
- Do not turn generic table-editor scaffolding into a grab bag for unrelated shared UI.
