Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-17
Source of Truth: Platform contract for passive map scenes, hits, and pointer
samples shared with adopting feature adapters.

# Maps Canvas Contract

## Purpose, Owners, And Consumers

This technical contract defines canvas-native values exchanged through
`platform.ui.mapcanvas`.

- provider: platform map-canvas mechanism
- consumers: adopting feature JavaFX adapters
- non-owners: adopter domain, application, persistence, and gameplay semantics

The API owns technical scene, camera, hit, and pointer semantics. It does not own
dungeon-grid or hex-grid coordinates, adopter commands, adopter identities, or
stored truth.

## Contract Surface

### Canvas Point

Required fields:

- finite `x`
- finite `y`

### Canvas Hit

Required fields:

- opaque adopter-provided `hitRef`
- canvas-native hit primitive or area

Optional fields:

- opaque adopter-provided `selectionRef`

References identify content only within the scene revision that carries them.
Maps may return them to the producing adopter but must not interpret them.

### Canvas Scene

Required fields:

- monotonically comparable scene revision
- ordered draw primitives
- ordered hit evidence derived from those primitives

Optional families:

- surfaces and boundaries
- glyphs and text
- relations
- actors and markers
- overlays
- explicit empty-state presentation

All geometry is canvas-native. Draw order and hit order come from the same
immutable scene revision.

### Canvas Pointer Sample

Required fields:

- phase: press, drag, release, move, or level-scroll
- pressed buttons
- modifiers
- canvas point
- scene revision observed during hit-testing

Optional fields:

- canvas hit
- scroll delta when the phase carries scrolling

One pointer-sample family covers all phases. This is an API payload decision,
not a naming rule for adapter classes or callbacks.

### Canvas Capability

The capability accepts a current canvas scene and publishes technical pointer
samples. Camera and viewport changes may publish canvas state but never mutate
adopter truth.

## Validation And Error Behavior

- Non-finite coordinates or geometry are rejected at the map-canvas boundary.
- A pointer sample without a hit still carries a valid canvas point and scene
  revision.
- A hit whose revision is stale or unknown is returned as no-hit; Maps does not
  guess an adopter target.
- Missing optional fields mean absence, not adopter-specific defaults.
- An empty scene remains renderable and hittable as no-hit.
- Duplicate scene revisions with different content are rejected.
- Adapter failures must not mutate the last accepted scene or adopter state.

## Compatibility And Versioning

Internal Java types may change atomically with all consumers in one green slice.
The semantic obligations in this contract remain stable: canvas-native exchange,
one scene revision for draw and hit, opaque adopter identity, passive camera
behavior, and no adopter meaning inside Maps.

Adding optional primitive families is backward-compatible. Changing coordinate,
revision, identity, or hit-order semantics requires an explicit contract
migration with every adopter updated together.

## Verification

- Production-route JUnit tests cover empty and populated scenes, draw/hit
  consistency, every pointer phase, stale revisions, camera stability, and
  adopter round-trip identity.
- `architectureTest` checks that only adopting JavaFX adapters depend on
  `platform.ui.mapcanvas` and that the platform mechanism has no feature
  dependency.
- This contract is Review-Owned for payload semantics not expressed by those
  tests.

## References

- [Maps Canvas Requirements](../requirements/requirements-maps-canvas.md)
- [Maps Canvas Architecture](../architecture/architecture-maps-canvas.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
