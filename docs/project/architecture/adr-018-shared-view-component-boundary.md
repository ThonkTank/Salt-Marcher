# ADR 018: Shared View Component Boundary

- Status: Superseded by [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-020-view-contributions-and-viewmodels.md:1)
- Date: 2026-04-19

## Supersession Note

This ADR is a historical record of the shared-component exception under the
component-local MVVM model. The current target architecture is the cockpit
contribution view layer defined by ADR 020 and the MVVM standard. Reuse should
be reconsidered as passive view contracts instead of preserving broad
component-local `api/`, `View/`, and `ViewModel/` buckets as target topology.

## Context

ADR 017 simplified the target view layer to declarative JavaFX MVVM: shell-facing
components have a root `*ViewContribution`, `View/`, `ViewModel/`, and FXML
resources. That target still needs an explicit way for Editor and Travel to
reuse and directly extend generic dungeon UI without importing another
component's private controllers or presentation models.

The dungeon map target needs reusable components that own extension slots and
overlay layers. Consumers must be able to provide tab-specific Nodes and
actions while the generic component keeps control of layout, pan/zoom, canvas
transforms, and shared controls.

## Decision

SaltMarcher introduces declared Shared View Components for reusable JavaFX/FXML
components below `src/view/**`.

- Declared shared components may contain `api/`, `View/`, `ViewModel/`, and
  `resources/view/<component>/`.
- Declared shared components do not expose or implement `*ViewContribution`.
- Their public cross-component surface is only `src.view.<component>.api.*`.
- Their private `View/` and `ViewModel/` packages remain private to the
  component.
- Normal shell-facing view components still require exactly one root
  `*ViewContribution` and must not add view `api/` packages.
- Consumers may import foreign shared APIs only from components declared by
  this ADR.

The declared shared components for the dungeon target are:

- `mapcanvas`: generic map canvas foundation with render model, viewport,
  callbacks, handle/factory API, and fixed overlay layers.
- `dungeonmap`: dungeon-specific reusable map and controls component built on
  `mapcanvas`, including dungeon render mapping, selection, shared controls,
  and named extension slots.

`dungeoncontrols` is part of the `dungeonmap` shared component surface unless
a later ADR splits it into its own declared shared component.

## Consequences

- Editor and Travel may directly extend generic dungeon panels through
  component-owned slots and layers without inheritance or private package
  imports.
- `mapcanvas` must not import dungeon, editor, travel, party, or shell types.
- `dungeonmap` may depend on dungeon domain APIs and `mapcanvas.api`, but not
  editor or travel implementation packages.
- Architecture checks distinguish normal view components from declared shared
  components.
- Existing private cross-component imports remain migration debt and should be
  moved behind shared `api/` contracts instead of grandfathered.

## Related Documents

- [Model-View-ViewModel Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-mvvm.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage.md:1)
- [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-020-view-contributions-and-viewmodels.md:1)
