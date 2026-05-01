Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-30
Source of Truth: Complete architecture-enforcement catalog for the bootstrap
layer itself: desktop launch framing, generic startup discovery roots, and
bootstrap-layer instantiation constraints outside the `AppBootstrap` role.

# Bootstrap Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
bootstrap layer itself.

It answers three questions for `bootstrap/**` as one layer:

- what the layer MUST contain
- what the layer MUST NOT contain
- which direct communication seams the layer MAY cross

This document does not own the `AppBootstrap` role contract itself, shell host
privacy, individual desktop-launch role APIs, `*Contribution` role shape,
`*ServiceContribution` role shape, or the global repository layer model. Those
stay in the neighboring AppBootstrap, shell, view, data, and layering
enforcement documents.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `bootstrap-desktop-launch-framing-ownership` | Review-Owned | the repository ships a desktop app entrypoint or packaged startup preloader under `bootstrap/**` | none | none | Desktop launch framing lives in the bootstrap layer and stays limited to shell startup framing such as stage/scene creation, startup resource application, and preloader handoff rather than becoming feature UI or shell-host behavior. |
| `bootstrap-view-discovery-root-set` | Enforced | bootstrap discovers shell-facing UI registration roots | bootstrap-layer bundle build-harness `BootstrapLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkBootstrapLayerEnforcement` | Bootstrap discovery sees only active-root `*Contribution` entrypoints under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**`; reusable `slotcontent/**` is not a bootstrap discovery root. |
| `bootstrap-data-service-discovery-root-set` | Enforced | bootstrap discovers backend runtime-registration roots | bootstrap-layer bundle build-harness `BootstrapLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkBootstrapLayerEnforcement` | Bootstrap discovery sees only root `src/data/<feature>/<Feature>ServiceContribution.java` entrypoints for backend runtime registration. |
| `bootstrap-generic-discovery-instantiation-contract` | Enforced | bootstrap instantiates discovered view or data registration roots | bootstrap-layer bundle build-harness `BootstrapLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkBootstrapLayerEnforcement` | Bootstrap consumes the documented generic discovery contract: direct concrete registration roots implementing the required shell API, with public no-arg construction and no feature-specific factory protocol. |
| `bootstrap-discovery-classloading-and-instantiation-policy` | Review-Owned | bootstrap loads and instantiates documented view or data registration roots | none | none | Bootstrap discovery loads registration roots through the application classloader, ignores non-instantiable roots such as interfaces and abstract classes, and treats missing or non-public generic discovery constructors as bootstrap errors rather than silently inventing fallback instantiation behavior. |
| `bootstrap-startup-defaultlanding-uniqueness` | Enforced | every discovered left-bar `ShellLeftBarTabSpec` root that bootstrap may select as startup landing | bootstrap-layer bundle build-harness `BootstrapLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkBootstrapLayerEnforcement` | Bootstrap startup resolution sees at most one left-bar root declaring `defaultLanding=true`. |
| `bootstrap-startup-defaultlanding-literal` | Enforced | every discovered left-bar `ShellLeftBarTabSpec` root that bootstrap may select as startup landing | bootstrap-layer bundle build-harness `BootstrapLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkBootstrapLayerEnforcement` | Left-bar startup metadata exposes a literal `defaultLanding` boolean so bootstrap startup uniqueness remains mechanically checkable. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `bootstrap-no-feature-implementation-dependencies` | Enforced | every active Java source under `bootstrap/**` | bootstrap-layer bundle ArchUnit `bootstrapMustStayOutsideFeatureCode` | `./gradlew checkArchitecture` and `./gradlew checkBootstrapLayerEnforcement` | Bootstrap code stays outside concrete feature implementation code instead of becoming a handwritten feature registry or feature behavior host. |
| `bootstrap-no-feature-specific-business-or-presentation-ownership` | Review-Owned | every bootstrap type under `bootstrap/**` | none | none | A mechanically legal bootstrap type still does not absorb feature-specific business rules, presentation-state mutation, or feature-local runtime policy. |
| `bootstrap-no-feature-internal-entrypoint-discovery` | Enforced | every type or package that bootstrap could treat as a registration root | bootstrap-layer bundle build-harness `BootstrapLayerTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkBootstrapLayerEnforcement` | Bootstrap does not discover or register feature-internal roles such as `*Binder`, `*View`, `*ContributionModel`, `*ContentModel`, `*IntentHandler`, `repository/`, `query/`, `gateway/`, `model/`, or `mapper/` as bootstrap entrypoints. |
| `bootstrap-no-second-feature-ui-layer` | Review-Owned | every desktop-launch or startup-framing type under `bootstrap/**` that uses JavaFX APIs | none | none | Bootstrap JavaFX launch framing stays outer and technical; it does not become a second feature-owned UI layer beside `src/view/**`. |

### Communication Contract

The bootstrap layer has no remaining layer-wide direct communication rows
beyond the discovery-root and instantiation-contract invariants above. Direct
runtime-composition seams belong to
`bootstrap-app-bootstrap-enforcement.md`.

## Candidate

- proving the documented classloader route and non-instantiable-type handling
  through one dedicated bootstrap-layer blocker instead of leaving that part of
  the contract review-owned

## References

- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [Shell AppShell Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-app-shell-enforcement.md:1)
- [View Contribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Bootstrap AppBootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-app-bootstrap-enforcement.md:1)
