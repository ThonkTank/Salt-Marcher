Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Target boundary between the shipped Hex feature and the Maps capability.

# Hex Adoption of the Maps Capability

## Purpose

Hex is a shipped feature. This specification owns how its editor and travel
surfaces adopt the target Maps API without leaking canvas mechanisms into the
Hex domain or duplicating coordinate and interaction truth.

It does not own Hex gameplay, persistence, or the generic Maps contract.

## Target Ownership

- Hex lives below `features/hex` with `api`, `domain`, `application`,
  `adapter/sqlite`, `adapter/javafx`, and an exact-root feature composition
  package.
- Maps exposes its reusable canvas capability through `features.maps.api`.
- `app` explicitly composes that capability into the Hex feature. Runtime
  discovery, registries, and service locators are forbidden.
- The Hex JavaFX adapter is the only Hex role allowed to consume the Maps API.
  The Hex domain and application layers remain independent of JavaFX, canvas,
  camera, viewport, and pointer mechanisms.

## Scene And Interaction Boundary

- One immutable, revisioned Maps scene supplies both drawing and hit testing.
  A displayed frame and its hit results therefore describe the same revision.
- Maps owns canvas coordinates, camera and viewport state, rendering mechanics,
  and technical pointer input.
- Maps returns an opaque hit identity from the displayed scene. It does not
  manufacture Hex coordinates, selections, commands, or gameplay meaning.
- The Hex JavaFX adapter translates Maps input and hit identities into typed Hex
  application input. It is the only owner of `canvas <-> Hex` conversion.
- Hex axial coordinates, snapping, selection, editing candidates, terrain,
  markers, tokens, and travel meaning remain Hex-owned.
- Hex must not reconstruct hit testing independently from the scene rendered by
  Maps or encode Hex meaning into string identifiers.

## Observable Behavior

- The editor and travel surfaces reuse the same passive Maps capability while
  retaining their distinct Hex workflows.
- Terrain, markers, tokens, selection, and travel presentation are drawn and
  hit-tested consistently for one scene revision.
- Camera and viewport changes affect presentation only; they do not mutate Hex
  gameplay state.
- Hex persistence remains behind the Hex API and Hex SQLite adapter. Maps does
  not read or write Hex records.

## References

- [Maps Canvas Architecture](./architecture-maps-canvas.md)
- [Maps Canvas Contract](../contract/contract-maps-canvas.md)
- [Hex Domain](../../hex/domain/domain-hex-map.md)
- [Hex Requirements](../../hex/requirements/requirements-hex.md)
- [Hex Persistence](../../hex/contract/contract-hex-persistence.md)
- [Feature Boundaries](../../project/architecture/patterns/feature-boundaries.md)
- [Application Composition](../../project/architecture/patterns/application-composition.md)
