Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-05-04
Source of Truth: Runtime dungeon-editor composition, session ownership, and
domain boundary of the `dungeoneditor` context.

# DungeonEditor Domain Model

## Context Role

Context Role: Generation Policy Context
Context Name: DungeonEditor

- `dungeoneditor` owns runtime editor-session composition
- `dungeoneditor` combines authored `dungeon` truth with session-local editor
  policy such as selection, tool, projection, overlay, preview, and pointer
  interpretation
- `dungeoneditor` does not own authored dungeon map persistence

## Published Language

`published/` owns the runtime dungeon-editor boundary for active workspaces and
session snapshots.

Published dungeon-editor carriers must not own:

- authored dungeon invariants
- persisted map truth
- passive-view widget state
- shell lifecycle

## Application Boundary

`DungeonEditorApplicationService` is the only callable dungeon-editor backend
boundary. It coordinates transient editor-session state through the foreign
`DungeonApplicationService` boundary from `dungeon`. Binder and view code
consume the runtime editor session through this boundary only; they do not own
the session.

The editor workspace surface is rebuilt from authored dungeon reads:

- committed authored state through `DungeonSnapshot`
- preview state through `DungeonOperationResult`
- committed selection detail through `DungeonInspectorSnapshot`

## Commands And Invariants

Write Model: None

Commands entering the model are:

- load runtime dungeon editor
- apply runtime dungeon editor session changes

Core invariants:

- runtime editor session state is not authored dungeon truth
- committed dungeon mutations still execute through the authored dungeon write
  model
- preview, selection, overlay, and projection state remain session-local
- pointer interpretation and drag-session state do not become persisted dungeon
  facts

## Consistency Model

`dungeoneditor` owns transient runtime session state only.

- selected map, selection, and tool are session-local workspace state
- overlay settings and projection level are session-local
- current editor surface is rebuilt from authored committed truth, optional
  authored preview truth, committed authored inspector detail, and current
  editor session state
- no separate `dungeoneditor` persistence store is introduced

## Ephemeral Policy Rationale

The interactive dungeon editor owns transient workspace composition over
authored dungeon map truth. Its decisions are preview behavior, selection
state, tool-local pointer interpretation, overlay policy, and projection
behavior for the current session, not authored map persistence. A future
durable editor write model would require an explicit new owner instead of being
absorbed into this generation-policy context.

## Ubiquitous Language

- `DungeonEditorSnapshot`: current runtime editor-session surface
- `DungeonEditorPreview`: transient preview description for the active edit
- `DungeonEditorOverlaySettings`: session-local overlay projection controls
