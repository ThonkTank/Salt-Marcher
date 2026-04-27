Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Compact hex-facing `Reise` state-surface behavior, visible
states, and acceptance criteria.

# Hex Reise Requirements

## Goal

Define the compact read-mostly `Reise` surface for overworld or hex travel
context.

## Non-Goals

- the interactive hex travel workspace
- hex editor behavior
- dungeon-specific travel context
- shared map-canvas contract design

## Current State

- SaltMarcher currently exposes only a generic global `Reise` placeholder.
- The sibling `salt-marcher` repo shows the concrete compact travel-context
  shape that this requirement should own for hex travel: location row, status,
  weather, time of day, pace, and an interaction hint.

## Visible Structure

- one compact location row
- one travel-status badge
- a small key-value block for weather, time of day, and pace
- one concise interaction or context hint

## Required Behavior

- when the active party is travelling on a hex map, `Reise` MUST show hex
  travel context rather than a generic placeholder
- the surface MUST communicate current location or lack of location
- the surface MUST communicate visible overworld travel context such as
  weather, time of day, and pace
- the surface MUST remain compact and read-mostly
- the surface MUST NOT duplicate the interactive hex travel workspace
- when no current hex location is available, the surface MUST show an explicit
  empty state

## Visible States

- no current location selected
- active overworld or hex travel context
- transient status change after movement

## Acceptance Criteria

- A user can read the core overworld travel context from the compact state
  surface alone.
- The surface remains clearly distinct from the full interactive travel view.
- Lack of active hex travel context is shown explicitly.

## References

- [Hex Feature Requirements](./requirements-hex.md)
- [Hex Travel Requirements](./requirements-hex-travel.md)
