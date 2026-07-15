Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-04-24
Source of Truth: Planned hex adoption seam for the generic maps canvas.

# Hex Map Adoption Architecture

## Purpose

This specification reserves the target-state adoption seam for a future hex map
feature.

It owns:

- the one-adapter rule for hex adoption
- the rule that hex converts `canvas <-> internal hex coordinates`

It does not own hex payload families, hex gameplay requirements, or hex
persistence truth.

## Planned Adopter Rules

- a hex adopter MUST own exactly one adapter between the generic canvas and
  internal hex coordinates
- the passive map view remains canvas-native and never emits hex-native
  coordinates directly
- hex-native selection, snap, edit, and action candidates belong to the hex
  adopter boundary, not to the passive map view
- draw and hit still share one `MapRenderScene`

## Explicit Non-Rules

- this document does not define a hex payload family
- this document does not define hex editor or travel workflows
- this document does not define hex persistence rules

## Verification Notes

- This architecture is currently `Candidate`.
- Future hex work should reuse the generic maps canvas instead of inventing a
  second passive map surface.

## References

- [Maps Canvas Architecture](./architecture-maps-canvas.md)
- [Maps Canvas Contract](../contract/contract-maps-canvas.md)
