# ADR 027: PresentationModel And IntentHandler View Layer

- Status: Accepted
- Date: 2026-04-27

## Context

SaltMarcher's post-ADR-022 target still described a single `*ViewModel` role
that owned both projection logic and input handling, while reusable generic UI
pieces were split between `slotcontent` and canonical `src/view/primitives`.
That model was not sharp enough for the stricter package-based and suffix-based
role clarity the project wants before mechanical enforcement is tightened.

The project wants:

- `View` to stay passive and domain-blind
- projection logic to stay separate from input interpretation
- only explicitly documented Binder seams to know domain boundaries
- feature-specific one-off components colocated directly in their owning active
  root
- reusable generic components to live only under `src/view/slotcontent/**`
- canonical role clarity to come from package placement plus explicit suffixes

## Decision

SaltMarcher adopts the current `PresentationModel`-based view-layer model:

- `*Contribution` remains the shell-registration adapter
- `*Binder` remains the one-time runtime composition and shell-binding owner
- `*PresentationModel` replaces the target public `*ViewModel` role
- `*IntentHandler` remains the optional input-side role for interactive
  components
- `*View` remains passive JavaFX content
- the domain layer remains the `Model`

Topology consequences:

- feature-specific components live directly in `leftbartabs`, `statetabs`, or
  `dropdowns`
- reusable generic components live only under `src/view/slotcontent/**`
- canonical `src/view/primitives/**` ownership is superseded by
  `src/view/slotcontent/primitives/**`

Behavior consequences:

- `PresentationModel` owns observable projection state and read-only intake of
  read-side `published/**` facts
- `IntentHandler` owns input interpretation only; it mutates only its
  co-located `PresentationModel`
- Binder-installed callbacks are the allowed seam for domain work that starts
  from interactive view-layer behavior
- passive Views react through bindings/listeners to observable
  `PresentationModel` state; they do not use direct imperative communication
  with the `PresentationModel`

Reuse consequences:

- feature-specific `*View`, `*PresentationModel`, and `*IntentHandler` classes
  may extend reusable generic counterparts from `slotcontent/**`
- that inheritance seam does not relax shell, data, or domain dependency bans

## Consequences

- the target architecture is no longer a monolithic MVVM `ViewModel`; it is a
  `PresentationModel` plus optional `IntentHandler` model with Binder-owned
  wiring seams
- active roots now target one `*PresentationModel` file and, when interactive,
  one `*IntentHandler` file
- reusable `slotcontent` units may own reusable `PresentationModel` and
  `IntentHandler` roles when the reusable component actually needs them
- existing target `*ViewModel` files and canonical `src/view/primitives/**`
  ownership become migration debt
- future harness work can target package placement, explicit suffixes, Binder
  domain seams, reactive View behavior, and the reusable `slotcontent`
  boundary more sharply than before

## Related Documents

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer.md:1)
- [View Layer Role Contracts](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer-role-contracts.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/repository-structure.md:1)
- [ADR 022: View Slotcontent And Binders](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-022-view-slotcontent-and-binders.md:1)
- [Fowler Presentation Model](/home/aaron/Schreibtisch/projects/references/view-patterns/fowler-presentation-model.md:1)
- [Fowler Passive View](/home/aaron/Schreibtisch/projects/references/view-patterns/fowler-passive-view.md:1)
