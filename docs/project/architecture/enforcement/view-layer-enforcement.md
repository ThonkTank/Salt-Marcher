Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Mechanical enforcement for cross-role topology, file-role
allowlists, and role-cardinality invariants in `src/view/**`, owned by the
focused `view-layer-enforcement` bundle.

# View Layer Enforcement

## Goal

This document owns the mechanical enforcement for view-unit shape rather than
one specific role contract. It answers two questions:

- which role files may exist in one active root or reusable `slotcontent` unit
- how many files of each role that unit may or must define

Role-local API and dependency rules, plus `*ViewInputEvent` and
`*PublishedEvent` protocol rules, live in the dedicated role- and
event-specific enforcement documents. `*InspectorEntry` placement and
dependency rules live in the dedicated InspectorEntry bundle. The focused root entrypoint is
`./gradlew checkViewLayerEnforcement --console=plain`; `checkArchitecture`,
`check`, and `build` include the same bundle transitively.

## Enforced

| Rule ID | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- |
| `view-layer-active-root-file-role` | `view-layer-enforcement` bundle build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Active roots contain only `*Contribution.java`, `*Binder.java`, `*ContributionModel.java`, optional `*IntentHandler.java`, passive `*View.java`, optional `*ViewInputEvent.java`, and optional write-side `*PublishedEvent.java` files. |
| `view-layer-slotcontent-file-role` | `view-layer-enforcement` bundle build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Reusable `slotcontent/**` units contain only passive `*View.java`, optional `*ContentModel.java`, optional `*IntentHandler.java`, optional `*ViewInputEvent.java`, optional write-side `*PublishedEvent.java`, and the allowed shared mapcanvas support carriers. |
| `view-layer-contribution-count` | `view-layer-enforcement` bundle build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Each active root defines exactly one `*Contribution.java`. |
| `view-layer-binder-count` | `view-layer-enforcement` bundle build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Each active root defines exactly one `*Binder.java`. |
| `view-layer-contributionmodel-count` | `view-layer-enforcement` bundle build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Each active root defines exactly one `*ContributionModel.java`. |
| `view-layer-contentmodel-forbidden` | `view-layer-enforcement` bundle build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Active roots do not define reusable `*ContentModel.java` files. |
| `view-layer-view-required` | `view-layer-enforcement` bundle build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Each active root defines at least one passive `*View.java` surface. |
| `view-layer-slotcontent-no-contribution` | `view-layer-enforcement` bundle build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Reusable `slotcontent/**` units do not define `*Contribution.java`. |
| `view-layer-slotcontent-no-binder` | `view-layer-enforcement` bundle build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Reusable `slotcontent/**` units do not define `*Binder.java`. |
| `view-layer-slotcontent-no-contributionmodel` | `view-layer-enforcement` bundle build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Reusable `slotcontent/**` units do not define active-root `*ContributionModel.java` files. |
| `view-layer-slotcontent-contentmodel-count` | `view-layer-enforcement` bundle build-harness `ViewLayerTopologyRules` | `./gradlew checkViewLayerEnforcement` | Each reusable `slotcontent/**` unit defines at most one `*ContentModel.java`. |
| `view-layer-slotcontent-contentmodel-required` | `view-layer-enforcement` bundle ArchUnit `interactiveSlotcontentViewsMustOwnExactlyOneContentModel` | `./gradlew checkViewLayerEnforcement` | Interactive reusable `slotcontent/**` units that expose `onViewInputEvent(...)` define exactly one `*ContentModel.java`. |

## Candidate

- emitting a dedicated diagnostic for “non-rollentragende eigenstaendige
  Datei” instead of proving the same violation through the closed file-role
  allowlists above
- proving that a legal `slotcontent/**` unit is genuinely reusable rather than
  a hidden feature-specific one-off

## Review-Owned

- whether a legal split into several passive `*View` files is understandable
  or should be simplified
- whether a reusable unit really deserves its own `ContentModel` or remains
  effectively stateless

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [View Contribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-enforcement.md:1)
- [View Binder Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-binder-enforcement.md:1)
- [View ContributionModel Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-model-enforcement.md:1)
- [View ContentModel Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-content-model-enforcement.md:1)
- [View InspectorEntry Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-inspector-entry-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [View Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
- [PublishedEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-published-event-enforcement.md:1)
