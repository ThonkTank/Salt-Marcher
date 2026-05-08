Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
Source of Truth: Complete invariant catalog for the `*Binder` role itself in
active view roots under `src/view/**`.

# View Binder Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`*Binder` role itself.

It answers five questions for every active-root `*Binder` surface:

- what the role MUST contain
- which direct dependency/content surface the role MAY contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross
- which remaining Binder semantics are still review-owned

This document does not own active-root or `slotcontent/**` file-role topology
such as `view-binder-count` or `view-slotcontent-no-binder`, passive `View`
outward seam shape, `*ViewInputEvent` carrier existence or carrier shape,
`*PublishedEvent` carrier shape or producer ownership, `IntentHandler`
entrypoint shape, or domain-side behavior behind a legal Binder seam. Those
stay in `view-layer-enforcement.md` and in the neighboring role-enforcement
documents.

Unified focused bundle entrypoint:

- `./gradlew checkViewBinderEnforcement --rerun-tasks --console=plain`
  runs the currently active Binder-focused Error Prone, ArchUnit, and
  jQAssistant checks through one root task. Canonical blocking behavior
  remains at `./gradlew compileJava` and `./gradlew checkArchitecture` as
  listed below.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-binder-own-contributionmodel-dependency` | Enforced | every active-root `*Binder.java` under `src/view/**` | jQAssistant `saltmarcher:ViewBinderUsesOwnModelAndSlotSurface` | `./gradlew checkViewBinderEnforcement` | A Binder has a direct dependency on its co-located aggregate `*ContributionModel`. The active-root runtime composition role does not hide its model ownership behind only foreign helpers or indirect assembly seams. |
| `view-binder-own-passive-surface-dependency` | Enforced | every active-root `*Binder.java` under `src/view/**` | jQAssistant `saltmarcher:ViewBinderUsesOwnModelAndSlotSurface` | `./gradlew checkViewBinderEnforcement` | A Binder has a direct dependency on at least one passive same-root `*View` or reusable passive `slotcontent/**` `*View` surface, so the role really owns visible runtime binding for one active root. |

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-binder-shell-public-contract-surface` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary` and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava` and `./gradlew checkViewBinderEnforcement` | A Binder may directly depend on the documented shell public contract subset only: `ShellRuntimeContext`, `ShellBinding`, `ShellSlot`, `ServiceRegistry`, and the documented shell contribution/navigation/inspector value types. |
| `view-binder-same-root-runtime-role-surface` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary` and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava` and `./gradlew checkViewBinderEnforcement` | A Binder may directly depend on its own same-root `*ContributionModel`, optional same-root `*IntentHandler`, same-root passive `*View`, same-root `*ViewInputEvent`, and optional same-root `*PublishedEvent` types. |
| `view-binder-reusable-slotcontent-surface` | Enforced | every active-root `*Binder.java` under `src/view/**` that reuses `slotcontent/**` | Error Prone `ViewBinderDependencyBoundary` and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava` and `./gradlew checkViewBinderEnforcement` | The target reusable-slotcontent surface for a Binder is the closed reusable-unit surface `*View`, `*ContentModel`, and reusable `*ViewInputEvent`. The current mechanical gate still reflects the older model and therefore admits `*InspectorEntry` and primitive support-value seams while forbidding direct reusable `*ViewInputEvent` dependencies; that is current drift, not target truth. |
| `view-binder-domain-public-boundary-surface` | Enforced | every active-root `*Binder.java` under `src/view/**` that crosses the backend boundary | Error Prone `ViewBinderDependencyBoundary`, ArchUnit `bindersMustNotReachDataOrShellHost`, and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewBinderEnforcement` | A Binder may directly depend on root domain `*ApplicationService` boundaries and on domain `published/**` carrier types only. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-binder-no-bootstrap-or-data-dependencies` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary`, ArchUnit `bindersMustNotReachDataOrShellHost`, and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewBinderEnforcement` | A Binder does not depend on `bootstrap/**` or `src/data/**`. Startup wiring and outbound adapter implementation stay outside the role. |
| `view-binder-no-shell-host-or-nonapi-shell-dependencies` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary`, ArchUnit `bindersMustNotReachDataOrShellHost`, and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewBinderEnforcement` | A Binder does not depend on `shell.host/**` or other non-`shell.api/**` shell internals. Shell communication stays on the documented public shell contract only. |
| `view-binder-no-nonpublic-domain-dependencies` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary`, ArchUnit `bindersMustNotReachDataOrShellHost`, and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewBinderEnforcement` | A Binder does not depend on domain internals outside root `*ApplicationService` boundaries and domain `published/**` carriers. |
| `view-binder-no-foreign-active-root-role-dependencies` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary` and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava` and `./gradlew checkViewBinderEnforcement` | A Binder does not depend on foreign active-root `*ContributionModel`, `*IntentHandler`, `*View`, `*ViewInputEvent`, or `*PublishedEvent` types from another view root. |
| `view-binder-no-illegal-reusable-view-role-dependencies` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary` and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava` and `./gradlew checkViewBinderEnforcement` | The current gate still forbids direct reusable `*ViewInputEvent` dependencies together with reusable `*IntentHandler` and `*PublishedEvent` families. Target architecture keeps the bans on reusable `*IntentHandler` and reusable `*PublishedEvent`, but it needs direct reusable `*ViewInputEvent` dependencies for same-root event forwarding. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-binder-shell-public-contract-communication-only` | Enforced | every Binder-owned shell-facing seam in an active root | Error Prone `ViewBinderDependencyBoundary`, ArchUnit `bindersMustNotReachDataOrShellHost`, and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewBinderEnforcement` | A Binder communicates with the shell only through documented `shell.api/**` contracts and binding surfaces. It does not communicate with concrete shell host internals. |
| `view-binder-viewinputevent-forwarding-only-through-onviewinputevent-consume` | Enforced | every Binder-owned passive-`View` to same-root `IntentHandler` input seam | Error Prone `ViewBinderViewInputEventWiring` | `./gradlew compileJava` | A Binder wires a passive `View` to its same-root `IntentHandler` only through `view.onViewInputEvent(intentHandler::consume)`. The target architecture applies that same forwarding rule to reused `slotcontent/**` Views too, even where current gate coverage still lags. |
| `view-binder-publishedevent-sink-injection-only` | Enforced | every Binder-owned outward seam from a local `IntentHandler` toward Binder-mediated outer work | Error Prone `ViewBinderApplicationSinkWiring` | `./gradlew compileJava` | A Binder injects Binder-mediated outward seams into a same-root `IntentHandler` only by calling `onPublishedEventRequested(Consumer<SameRootPublishedEvent>)`. It does not install other callback or result protocols as hidden outward-work paths into the handler. |
| `view-binder-no-projectionmodel-request-protocol-consumption` | Enforced | every Binder-owned listener or callback seam that touches a same-root or reusable projection model | Error Prone `ViewBinderProjectionModelRequestProtocol` | `./gradlew compileJava` | A Binder does not subscribe to `*Request*Property()`, `*TokenProperty()`, or equivalent request-style outward protocol members on `*ContributionModel` or reusable `*ContentModel` surfaces. Binder-mediated outer work must start from the local `IntentHandler` through `Consumer<SameRootPublishedEvent>` only. |
| `view-binder-domain-boundary-communication-only` | Enforced | every Binder-owned direct domain seam in an active root | Error Prone `ViewBinderDependencyBoundary`, ArchUnit `bindersMustNotReachDataOrShellHost`, and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewBinderEnforcement` | A Binder communicates directly with the backend only through root `*ApplicationService` boundaries and domain `published/**` carrier types. It does not communicate directly with `src/data/**` or non-public domain internals. |

## Review-Owned

| Invariant ID | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- |
| `view-binder-shell-lookup-and-lifecycle-ownership` | every active-root `*Binder.java` under `src/view/**` | none | none | Shell runtime lookup, shell-facing slot binding, lifecycle-owned activation wiring, and role instantiation stay in the Binder instead of leaking into `*Contribution`, passive `*View`, or domain-facing helpers. |
| `view-binder-no-local-contribution-or-second-binder-dependency` | every active-root `*Binder.java` under `src/view/**` | none | none | The view-layer standard says a Binder may know only its same-root model, optional handler, passive views, same-root carriers, and intentional reusable slotcontent seams directly. Same-root `*Contribution` or second-`*Binder` knowledge remains review-rejected until a narrower blocker exists. |
| `view-binder-slotcontent-reuse-intentionality` | every Binder-owned direct dependency on reusable `slotcontent/**` surfaces | none | none | A mechanically legal reusable-slotcontent dependency exists only when the reused surface is genuinely intentional reusable UI and not just hidden feature-specific assembly split across packages. |
| `view-binder-readback-intake-minimality` | every Binder-owned readback seam from domain `published/**` facts into a co-located `ContributionModel` | none | none | A mechanically legal Binder still keeps readback wiring at the minimum listener-facing model intake seams for one root instead of growing broad imperative update APIs. |
| `view-binder-no-projection-backchannel-semantics` | every Binder-owned local model and published-event seam in an active root | none | none | A Binder treats the co-located `ContributionModel` only as a projection target fed by `published/*Model` readback. It does not use projection getters, request tokens, or view-local caches as a second command/session source when translating `*PublishedEvent` into one root `*ApplicationService` call. |
| `view-binder-readback-source-is-domain-model-handle` | every Binder-owned domain-state intake path in an active root | none | none | Domain-backed view state and domain-owned feedback are consumed only from a direct same-context read-side `published/*Model` runtime service, then read only through `current()` and `subscribe(...)`. Readback must not cross the same root `*ApplicationService` boundary a second time, and direct one-shot `*Result`, `*Snapshot`, `*Payload`, `*SearchResult`, `*CalculationResult`, or `*Preview` responses are not used as authoritative view-state or feedback sources. |
| `view-binder-single-root-applicationservice-call-per-publication` | every Binder-owned sink that translates one published event into domain work | none | none | One publication of one same-root `*PublishedEvent` becomes one root `*ApplicationService` entrypoint call rather than a hidden fan-out workflow. |
| `view-binder-one-carrier-family-per-root-entrypoint` | every same-root Binder/ApplicationService write seam fed by `*PublishedEvent` carriers | none | none | One root `*ApplicationService` entrypoint is fed by at most one same-root `*PublishedEvent` type. Needing several carriers for one entrypoint is a Binder-owned modelling error. |
| `view-binder-local-view-effect-sink-thinness` | every Binder-owned non-domain local effect sink injected into a same-root `*IntentHandler` | none | none | A Binder may wire a same-root local view-effect sink only for passive-View effects that stay entirely local to the active root, such as viewport reset. The sink must not mutate projection models, stand in for a domain write seam, or grow into a second workflow protocol beside `PublishedEvent`. |
| `view-binder-thin-runtime-composition-semantics` | every active-root `*Binder.java` under `src/view/**` | none | none | A Binder stays a thin runtime composition adapter and does not turn legal listener, sink, shell, and readback seams into long-lived workflow orchestration. This also excludes using `PublishedEvent` sinks for shell/view effects or using direct `ApplicationService` responses as an ad-hoc state-transport protocol into the view layer. |

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
- [PublishedEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-published-event-enforcement.md:1)
