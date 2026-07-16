Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Target ownership, dependency direction, and composition for the
reusable passive map canvas.

# Maps Canvas Architecture

## Purpose And Concerns

This specification defines the reusable canvas owned by the Maps feature. It
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
features/maps/
  api/             immutable canvas scene, hit, pointer, and capability types
  domain/          canvas-native camera and viewport invariants
  application/     passive scene, camera, hit, and input orchestration
  adapter/javafx/  rendering, viewport observation, and pointer capture
  <feature root>   Maps composition entry point used by app
```

The Maps API is the only cross-feature boundary. Adopters may depend on
`features.maps.api`; Maps must not import an adopter's API or implementation.

## Boundaries

- All scene geometry and pointer coordinates crossing the Maps API are
  canvas-native.
- One immutable scene revision supplies both draw order and ordered hit evidence.
- The JavaFX adapter renders the supplied scene and captures technical input. It
  does not interpret dungeon-grid, hex-grid, editing, or travel meaning.
- Camera, pan, zoom, viewport, resize, and reset behavior remain Maps-owned
  passive presentation behavior.
- Each adopter owns one translation boundary in its `adapter/javafx` package
  between its feature API and the Maps API.
- Adopter domain and application packages never depend on JavaFX or Maps
  presentation types.
- Maps owns no SQLite state under the current contract.
- Maps therefore has no SQLite adapter. Target roles follow owned capability;
  empty form packages are forbidden.

## Composition View

`app` constructs the Maps feature explicitly, obtains its typed canvas
capability, and passes that capability to each adopting feature entry point. An
adopter entry point constructs its own API, application, adapters, and shell
contribution. The shell receives already constructed contributions and does not
discover or locate canvas or adopter services.

## Capability Paths

### Surface Read

`adopter API state -> adopter JavaFX adapter -> Maps API scene -> Maps application -> Maps JavaFX adapter`

### Pointer Input

`Maps JavaFX adapter -> Maps API pointer sample -> adopter JavaFX adapter -> adopter API command`

### Draw And Hit

`one Maps API scene revision -> ordered draw primitives + ordered hit evidence -> Maps JavaFX adapter`

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
