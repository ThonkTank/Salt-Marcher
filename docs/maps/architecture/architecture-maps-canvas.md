Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Target ownership, dependency direction, and composition for the
reusable passive map canvas.

# Maps Canvas Architecture

## Purpose And Concerns

This specification defines reusable mechanisms owned by `platform.ui.mapcanvas`. It
serves maintainers of map presentation and adopting features that translate
their own map facts into canvas-native scenes.

It answers:

- where passive camera, drawing, hit-testing, and pointer capture belong
- how an adopter supplies a scene without exposing its domain to Maps
- how canvas input returns to an adopter without Maps learning adopter meaning
- how the application composes the canvas and its adopters explicitly

It does not own dungeon or hex behavior, coordinates, persistence, commands, or
domain invariants.

## Target Ownership

```text
platform/ui/mapcanvas/
  camera and viewport values
  bounded viewport caches
  logical paint phases on one bounded JavaFX canvas host
  technical scene, hit, and pointer values
```

The platform package is a feature-neutral mechanism boundary. JavaFX adapters
may depend on it; it must not import any adopter API or implementation.

## Boundaries

- All scene geometry and pointer coordinates crossing the mechanism boundary are
  canvas-native.
- One immutable scene revision supplies both draw order and ordered hit evidence.
- The JavaFX adapter renders the supplied scene and captures technical input. It
  does not interpret dungeon-grid, hex-grid, editing, or travel meaning.
- Camera, pan, zoom, viewport, resize, and reset behavior remain Maps-owned
  passive presentation behavior.
- Each adopter owns one translation boundary in its `adapter/javafx` package
  between its feature API and canvas-native values.
- Adopter domain and application packages never depend on JavaFX or Maps
  presentation types.
- Maps owns no SQLite state under the current contract.
- Maps therefore has no SQLite adapter. Target roles follow owned capability;
  empty form packages are forbidden.

## Composition View

`app` constructs adopter features. Their JavaFX adapters instantiate passive
map-canvas mechanisms directly; the platform mechanism has no feature entry
point, lifecycle, discovery, or service lookup.

## Capability Paths

### Surface Read

`adopter API state -> adopter JavaFX translation -> platform map canvas`

### Pointer Input

`platform pointer sample -> adopter JavaFX translation -> adopter API command`

### Draw And Hit

`one canvas scene revision -> ordered draw primitives + ordered hit evidence -> bounded JavaFX canvas`

Base, interaction, and actor paint remain separate invalidation phases. They
share one backing surface so each open editor does not multiply a full-window
pixel buffer; transient repaint replays the retained base phase first.

The adopter translation boundary derives canvas-native geometry and stable hit
references from adopter API state. It also translates a technical hit reference
back to an adopter API command or query. Maps does not reconstruct either
translation.

## Decisions And Rationale

- A feature-owned API keeps cross-feature dependencies compile-time visible.
- One scene revision prevents draw and hit state from diverging.
- One adopter translation boundary prevents competing coordinate and identity
  mappings.
- Explicit application composition exposes lifecycle and dependencies without a
  runtime registry or classpath convention.
- A JavaFX adapter, rather than a role-name convention, owns technical rendering
  and input capture.

Rejected target forms include shared adopter-native payloads, direct Maps access
to adopter application services, multiple projection owners for one surface,
and runtime discovery or service lookup.

## Verification

- `architectureTest` checks the target feature and cross-feature dependency
  direction.
- Production-route JUnit tests prove shared scene draw/hit consistency, passive
  camera behavior, empty scenes, and adopter coordinate translation.
- Review rejects a second scene-to-hit owner or adopter implementation imports
  from Maps.

## References

- [Maps Canvas Requirements](../requirements/requirements-maps-canvas.md)
- [Maps Canvas Contract](../contract/contract-maps-canvas.md)
- [Dungeon Map Adoption Architecture](architecture-maps-dungeon-adoption.md)
- [Hex Map Adoption Architecture](architecture-maps-hex-adoption.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
- [Application Composition Standard](../../project/architecture/patterns/application-composition.md)
