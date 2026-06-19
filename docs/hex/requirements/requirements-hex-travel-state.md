Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-19
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

## Current State

- SaltMarcher currently exposes a generic global placeholder in the runtime
  tab labeled `Reise`.
- The project-wide `Reise` state-tab requirements now allow a feature-owned
  live travel readback to replace that placeholder while keeping the state tab
  compact and read-mostly.
- Hex runtime travel readback is implemented through the party-owned overworld
  travel position when that position points at a valid Hex tile id.
- The Hex editor can author maps, terrain, and markers, and the Hex travel
  readback can publish the active party-token Hex location to the global state
  tab.

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

## Visible States

- no current location selected
- active overworld or hex travel context
- transient status change after movement
- placeholder fallback while no approved Hex runtime readback exists

## Acceptance Criteria

- A user can read the core overworld travel context from the compact state
  surface alone.
- The surface remains clearly distinct from the full interactive travel view.
- Lack of active hex travel context is shown explicitly.
- The static `Reise` placeholder is replaced only when an approved Hex runtime
  readback exists for the active party.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Hex Travel Requirements](./requirements-hex-travel.md)
- [Travel State Tab UI](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/requirements/requirements-travel-state-tab.md:1)
