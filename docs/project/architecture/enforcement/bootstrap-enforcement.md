Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for the bootstrap
layer itself: desktop launch framing, generic startup discovery roots, startup
landing policy, registration order, and the bootstrap-owned cross-layer
registration path.

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
| `bootstrap-view-discovery-root-set` | Enforced Elsewhere | bootstrap discovers shell-facing UI registration roots | build-harness `ShellSurfaceRules`; view `view-layer-contribution-count`, `view-layer-slotcontent-no-contribution`, and `view-contribution-discovery-entrypoint-shape` | see neighboring owner docs and their listed entrypoints | Bootstrap discovery sees only active-root `*Contribution` entrypoints under `src/view/leftbartabs/**`, `src/view/statetabs/**`, and `src/view/dropdowns/**`; reusable `slotcontent/**` is not a bootstrap discovery root. |
| `bootstrap-data-service-discovery-root-set` | Enforced Elsewhere | bootstrap discovers backend runtime-registration roots | build-harness `ShellSurfaceRules` and `SourceLayoutRules`; data `data-root-service-contribution-only` and `data-service-contribution-discovery-entrypoint-shape` | `./gradlew checkArchitecture` and neighboring data-role entrypoints | Bootstrap discovery sees only root `src/data/<feature>/<Feature>ServiceContribution.java` entrypoints for backend runtime registration. |
| `bootstrap-generic-discovery-instantiation-contract` | Enforced Elsewhere | bootstrap instantiates discovered view or data registration roots | view `view-contribution-discovery-entrypoint-shape`; data `data-service-contribution-discovery-entrypoint-shape` | `./gradlew checkArchitecture` and neighboring role entrypoints | Bootstrap consumes the documented generic discovery contract: direct concrete registration roots implementing the required shell API, with public no-arg construction and no feature-specific factory protocol. |
| `bootstrap-startup-defaultlanding-uniqueness` | Enforced | every discovered left-bar `ShellLeftBarTabSpec` root that bootstrap may select as startup landing | build-harness `ShellSurfaceRules` | `./gradlew checkArchitecture` | Bootstrap startup resolution sees at most one left-bar root declaring `defaultLanding=true`. |
| `bootstrap-startup-defaultlanding-literal` | Enforced | every discovered left-bar `ShellLeftBarTabSpec` root that bootstrap may select as startup landing | build-harness `ShellSurfaceRules` | `./gradlew checkArchitecture` | Left-bar startup metadata exposes a literal `defaultLanding` boolean so bootstrap startup uniqueness remains mechanically checkable. |
| `bootstrap-registration-sequencing-and-kind-routing` | Review-Owned | bootstrap registers discovered runtime contributions during startup composition | none | none | Bootstrap keeps the documented sequence: discover data `*ServiceContribution` roots, populate `ServiceRegistry`, construct the shell, discover UI `*Contribution` roots, sort by contribution key, and register only by the documented shell spec families. |
| `bootstrap-startup-target-scope` | Review-Owned | bootstrap resolves startup landing from discovered shell contributions | none | none | Bootstrap selects startup landing only from left-bar tab contributions; global state tabs and top-bar dropdown windows never become startup landing targets. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `bootstrap-no-feature-implementation-dependencies` | Enforced | every active Java source under `bootstrap/**` | ArchUnit `bootstrapMustStayOutsideFeatureCode` | `./gradlew checkArchitecture` | Bootstrap code stays outside concrete feature implementation code instead of becoming a handwritten feature registry or feature behavior host. |
| `bootstrap-no-feature-specific-business-or-presentation-ownership` | Review-Owned | every bootstrap type under `bootstrap/**` | none | none | A mechanically legal bootstrap type still does not absorb feature-specific business rules, presentation-state mutation, or feature-local runtime policy. |
| `bootstrap-no-manual-feature-registries-or-special-case-wiring` | Review-Owned | every bootstrap discovery, registration, or startup-composition path under `bootstrap/**` | none | none | Routine feature addition does not require handwritten bootstrap registries, feature-name branches, feature-specific imports, or hidden startup precedence rules. |
| `bootstrap-no-feature-internal-entrypoint-discovery` | Enforced Elsewhere | every type or package that bootstrap could treat as a registration root | build-harness `ShellSurfaceRules` and `SourceLayoutRules`; view `view-layer-slotcontent-no-contribution` and `view-contribution-discovery-entrypoint-shape`; data `data-root-service-contribution-only` | `./gradlew checkArchitecture` and neighboring owner entrypoints | Bootstrap does not discover or register feature-internal roles such as `*Binder`, `*View`, `*ContributionModel`, `*ContentModel`, `*IntentHandler`, `repository/`, `query/`, `gateway/`, `model/`, or `mapper/` as bootstrap entrypoints. |
| `bootstrap-no-second-feature-ui-layer` | Review-Owned | every desktop-launch or startup-framing type under `bootstrap/**` that uses JavaFX APIs | none | none | Bootstrap JavaFX launch framing stays outer and technical; it does not become a second feature-owned UI layer beside `src/view/**`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `bootstrap-shell-host-composition-point-only` | Enforced Elsewhere | every direct bootstrap dependency into `shell.host/**` | shell `shell-host-private-boundary` via ArchUnit `bootstrapMustOnlyUseAppShellFromShellHost` | `./gradlew checkArchitecture` | Bootstrap reaches shell host implementation only through the documented `AppShell` composition point; the Shell AppShell enforcement document owns that host-privacy proof. |
| `bootstrap-shell-public-composition-vocabulary-only` | Review-Owned | every direct bootstrap dependency into shell public contracts | none | none | Bootstrap communicates with shell only through the documented startup-composition and registration vocabulary needed at the outer boundary: `AppShell` plus the required `shell.api` contracts such as `ServiceContribution`, `ServiceRegistry`, `ShellContribution`, `ShellContributionSpec`, `ShellBinding`, `ShellRuntimeContext`, and the documented shell spec families. |
| `bootstrap-view-registration-entrypoints-only` | Enforced Elsewhere | every direct bootstrap dependency into `src/view/**` | build-harness `ShellSurfaceRules`; view `view-contribution-shell-public-contract-and-local-binder-only` and `view-contribution-discovery-entrypoint-shape` | `./gradlew checkArchitecture`, `./gradlew compileJava`, and neighboring view-role entrypoints | Bootstrap communicates with the view layer only through discovered `*Contribution` registration roots and the shell registration vocabulary they expose; it does not communicate directly with Binders, Models, Views, or reusable `slotcontent/**` internals. |
| `bootstrap-data-registration-entrypoints-only` | Enforced Elsewhere | every direct bootstrap dependency into `src/data/**` | build-harness `ShellSurfaceRules` and `SourceLayoutRules`; data `data-service-registry-root-only` and `data-service-contribution-shell-runtime-seam-subset` | `./gradlew checkArchitecture`, `./gradlew compileJava`, and neighboring data-role entrypoints | Bootstrap communicates with the data layer only through root `*ServiceContribution` registration entrypoints and `ServiceRegistry`; it does not communicate directly with repositories, queries, gateways, mappers, models, or persistence helpers. |
| `bootstrap-no-direct-domain-communication` | Review-Owned | every direct bootstrap dependency below `src/domain/**` | none | none | Bootstrap does not communicate directly with domain-layer implementation code; domain interaction stays behind the data registration seam and later runtime service lookup owned outside bootstrap. |
| `bootstrap-startup-fallback-policy` | Review-Owned | every startup where no left-bar root declares `defaultLanding=true` | none | none | Bootstrap fallback resolves startup from the documented sorted navigation order rather than from hidden feature-specific precedence rules. |

## Candidate

- proving the documented generic discovery path and registration order as one
  dedicated blocker instead of inferring parts of the path from neighboring
  owner documents
- proving the documented startup-target scope directly so non-left-bar shell
  contributions can never become startup landing candidates
- proving the bootstrap-to-view and bootstrap-to-data entrypoint subsets
  directly instead of inferring them from neighboring role and layout owners

## References

- [Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/bootstrap.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-layer-enforcement.md:1)
- [Shell AppShell Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/shell-app-shell-enforcement.md:1)
- [View Contribution Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-contribution-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Bootstrap AppBootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-app-bootstrap-enforcement.md:1)
