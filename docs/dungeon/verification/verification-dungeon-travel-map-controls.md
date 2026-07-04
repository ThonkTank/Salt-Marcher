Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-06-24
Source of Truth: Map projection and presentation-control route expectations
for Dungeon Travel behavior verification.

# Dungeon Travel Map And Projection Controls Matrix

## Purpose

This document owns route expectations for Dungeon Travel map presentation
controls. Travel movement, runtime projection invariants, and authored dungeon
truth remain in their neighboring requirements, domain, and invariant catalogs.

## Verification Matrix

| ID | Interaction | Route | Fixture | Expected proof | Status |
| --- | --- | --- | --- | --- | --- |
| `DT-LVL-001` | Projection level up by visible control | Dungeon Travel next-level button | `F6_MULTI_LEVEL_FLOORS` plus party on level `0` | Clicking `+` increments the runtime travel projection level by `1`, updates the visible level label to `Ebene z=1`, and renders level `1` without authored or party-position mutation. | Ready |
| `DT-LVL-002` | Projection level down by visible control | Dungeon Travel previous-level button | `F6_MULTI_LEVEL_FLOORS` plus active projection level `1` | Clicking `-` decrements the runtime travel projection level to `0`, updates the visible level label to `Ebene z=0`, and renders level `0` without authored or party-position mutation. | Ready |

## References

- [Dungeon Travel Requirements](../requirements/requirements-dungeon-travel.md)
- [Dungeon Domain Model](../domain/domain-dungeon.md)
- [Dungeon Map Surface Contract](docs/maps/contract/contract-maps-dungeon-surface.md:1)
