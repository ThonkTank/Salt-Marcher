Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: Compact hex-facing travel-state surface behavior for the
runtime `Reise` tab, visible states, and acceptance criteria.

# Hex Travel State Requirements

## Goal

Define the compact read-mostly travel-state surface shown in the runtime
`Reise` tab for overworld or hex travel context.

## Non-Goals

- the interactive hex travel workspace
- hex editor behavior
- dungeon-specific travel context
- shared map-canvas contract design

## Visible Structure

- one compact location row
- one travel-status badge
- a small key-value block for weather, time of day, and pace
- one concise interaction or context hint

## Required Behavior

- when the active party is travelling on a hex map, the runtime tab labeled
  `Reise` MUST show hex travel context rather than a generic placeholder
- the surface MUST communicate current location or lack of location
- the surface MUST communicate visible overworld travel context such as
  weather, time of day, and pace
- the surface MUST remain compact and read-mostly
- the surface MUST NOT duplicate the interactive hex travel workspace
- when no current hex location is available, the surface MUST show an explicit
  empty state
- the surface MUST consume an approved Hex runtime readback and MUST NOT infer
  Hex travel context from editor-only map selection
- movement commands MUST remain outside the compact state tab
- Hex MUST publish its compact context as typed readback for the feature-neutral
  Travel capability; Hex MUST NOT remain the permanent owner of the global
  `travel` shell contribution

## Visible States

- no current location selected
- active overworld or hex travel context
- transient status change after movement
- explicit no-context fallback while no matching Hex runtime readback exists

## Acceptance Criteria

- A user can read the core overworld travel context from the compact state
  surface alone.
- The surface remains clearly distinct from the full interactive travel view.
- Lack of active hex travel context is shown explicitly.
- Hex context appears only when an approved Hex runtime readback matches the
  active party position.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Hex Travel Requirements](./requirements-hex-travel.md)
- [Travel State Tab UI](../../project/requirements/requirements-travel-state-tab.md) (line 1)
- [Travel Context Domain](../../travel/domain/domain-travel.md)
