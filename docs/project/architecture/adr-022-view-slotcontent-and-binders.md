# ADR 022: View Slotcontent And Binders

- Status: Superseded by [ADR 027: PresentationModel And IntentHandler View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-027-presentationmodel-intenthandler-view-layer.md:1)
- Date: 2026-04-20

## Historical Context

ADR 022 recorded the step from contribution-owned shell wiring toward active
roots plus reusable `slotcontent`. It replaced flat reusable-view ownership and
made `*Binder` the root runtime composition role.

That decision is still historically relevant because it introduced:

- active roots under `leftbartabs`, `statetabs`, and `dropdowns`
- reusable `slotcontent`
- shell-discovery-only `*Contribution` classes
- `*Binder` as the composition owner

## Why It Is Superseded

ADR 022 still described target `*ViewModel` roles and allowed runtime domain
knowledge that is no longer part of the current target model.

The current target model is defined by ADR 027 and the active view-layer
standards:

- `*PresentationModel` replaces target `*ViewModel`
- `*IntentHandler` is the optional input-side role
- the Binder performs one-time wiring and owns the explicitly allowed
  domain-facing seams
- reusable generic components live under `slotcontent/**`, while feature-owned
  one-offs are colocated in their active-root package
- canonical reusable primitive ownership moved away from `src/view/primitives`
  toward `src/view/slotcontent/primitives`

## Historical Consequences That Still Matter

- shell discovery remains generic and scans only active roots for
  `*Contribution` classes
- detail content remains published through shell-owned details/history APIs
  rather than bootstrap discovery
- quality gates must distinguish active roots, optional dropdown
  contributions, and reusable `slotcontent` roots

## Related Documents

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer.md:1)
- [View Layer Role Contracts](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer-role-contracts.md:1)
- [ADR 027: PresentationModel And IntentHandler View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-027-presentationmodel-intenthandler-view-layer.md:1)
