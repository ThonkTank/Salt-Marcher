Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-19
Source of Truth: Compact dungeon-facing travel-state surface behavior for the
runtime `Reise` tab, visible states, and acceptance criteria.

# Dungeon Travel State Requirements

## Goal

Define the compact read-mostly dungeon travel-state surface shown in the
runtime `Reise` tab that communicates current dungeon travel context without
replacing the full interactive dungeon travel workspace.

## Non-Goals

- the interactive dungeon travel workspace
- dungeon editor behavior
- shell-wide state-tab policy
- shared canvas contract design

## Visible Structure

- one compact title or icon row identifying dungeon travel context
- one location or context row
- one status badge
- a short key-value block for tile, heading, or comparable dungeon context
- one concise interaction or status hint

## Required Behavior

- when the active party is inside a dungeon, the runtime tab labeled `Reise`
  MUST show dungeon travel context rather than a generic overworld placeholder
- the surface MUST communicate at least current map or area, current tile,
  heading, and movement status
- the surface MUST remain compact and read-mostly
- the surface MUST NOT duplicate the full interactive dungeon travel control
  surface inside the global state tab
- if the party is not in a dungeon, the dungeon-specific runtime `Reise` state
  MUST fall back to an explicit empty or non-applicable state
- blocked or unresolved dungeon movement MUST surface a concise status outcome
  instead of stale success text
- Dungeon MUST publish its compact context as typed readback for the
  feature-neutral Travel capability; Dungeon MUST NOT register a competing
  global `travel` shell contribution

## Visible States

- no active dungeon context
- active dungeon context with current area or location
- active movement or loading state
- blocked or failed move status

## Acceptance Criteria

- A user can identify current dungeon travel context from the compact state
  surface alone.
- The surface stays visibly smaller and less interactive than the full dungeon
  travel workspace.
- The content of the runtime `Reise` tab changes when the underlying dungeon
  runtime state changes.
- Non-dungeon runtime state never appears as if it were valid dungeon context.

## References

- [Dungeon Feature Requirements](./requirements-dungeon.md)
- [Dungeon Travel Requirements](./requirements-dungeon-travel.md)
- [Travel Context Domain](../../travel/domain/domain-travel.md)
