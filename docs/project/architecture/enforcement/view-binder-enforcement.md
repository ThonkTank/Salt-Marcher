Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-13
Source of Truth: Complete invariant catalog for the `*Binder` role itself in
active view roots under `src/view/**`.

# View Binder Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`*Binder` role itself.

Architectural truth for the Binder role lives only in the
[View Layer Standard](docs/project/architecture/patterns/view-layer.md:1).
This document owns only Binder-local enforcement inventory and current
mechanical drift.

It answers five questions for every active-root `*Binder` surface:

- what the role MUST contain
- which direct dependency/content surface the role MAY contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross
- which remaining Binder semantics are still review-owned

This document does not own active-root or `slotcontent/**` file-role topology
such as `view-binder-count` or `view-slotcontent-no-binder`, passive `View`
outward seam shape, `*ViewInputEvent` carrier existence or carrier shape,
`IntentHandler` entrypoint shape, or domain-side behavior behind a legal Binder
seam. Those stay in `view-layer-enforcement.md` and in the neighboring
role-enforcement documents.

Technical diagnostic route:

- `./gradlew checkViewEnforcement --rerun-tasks --console=plain`
  runs the View enforcement diagnostic surface, including Binder-owned checks
  selected by the Binder role bundle. Canonical compile-side integrity remains
  at `./gradlew compileJava`; project-local Error Prone and bundle-owned
  blocking behavior enters through `./gradlew checkViewEnforcement` and
  `./gradlew check`.

Row-level documentation coverage for this Binder catalog is review-owned until
a dedicated `DocumentationCoverageCatalog` spec registers this document.
`checkDocumentationEnforcement` does not currently prove every Binder row,
status, owner, or route in this table.

## Invariant Catalog

### Must Contain

No additional Binder-local containment invariant is mechanically enforced
after the bundle merge. Ownership of local `*ContributionModel` and passive
`*View` wiring remains visible through the legal dependency surfaces and
through review-owned role semantics below.

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-binder-shell-public-contract-surface` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder may directly depend on the documented shell public contract subset: `ShellRuntimeContext`, `ShellBinding`, `ShellControls`, `ShellSlot`, `ServiceRegistry`, and the documented shell contribution/navigation/inspector value types. |
| `view-binder-same-root-runtime-role-surface` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder may depend on its own same-root aggregate `*ContributionModel`, same-root `*ContentModel` surfaces, optional same-root `*IntentHandler`, same-root passive `*View`, and same-root `*ViewInputEvent` types. Same-root `*PublishedEvent` is not part of the legal Binder role surface. |
| `view-binder-reusable-slotcontent-surface` | Enforced | every active-root `*Binder.java` under `src/view/**` that reuses `slotcontent/**` | Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | The reusable-slotcontent surface for a Binder is the closed reusable-unit surface `*View`, `*ContentModel`, and reusable `*ViewInputEvent`. Direct reusable `*IntentHandler`, `*PublishedEvent`, and foreign helper-role dependencies are forbidden. |
| `view-binder-domain-public-boundary-surface` | Enforced | every active-root `*Binder.java` under `src/view/**` that crosses the backend boundary | Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder may directly depend on root domain `*ApplicationService` boundaries and on domain `published/**` carrier types only. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-binder-no-bootstrap-or-data-dependencies` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder does not depend on `bootstrap/**` or `src/data/**`. Startup wiring and outbound adapter implementation stay outside the role. |
| `view-binder-no-shell-host-or-nonapi-shell-dependencies` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder does not depend on `shell.host/**` or other non-`shell.api/**` shell internals. Shell communication stays on the documented public shell contract only. |
| `view-binder-no-nonpublic-domain-dependencies` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder does not depend on domain internals outside root `*ApplicationService` boundaries and domain `published/**` carriers. |
| `view-binder-no-foreign-active-root-role-dependencies` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder does not depend on foreign active-root `*ContributionModel`, `*ContentModel`, `*IntentHandler`, `*View`, or `*ViewInputEvent` types from another view root. Same-root `*ContentModel` surfaces are legal only as the Binder-owned model side of its same-root passive Views. |
| `view-binder-no-illegal-reusable-view-role-dependencies` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder may depend directly on reusable `*View`, `*ContentModel`, and `*ViewInputEvent` surfaces, but not on reusable `*IntentHandler`, reusable `*PublishedEvent`, foreign active-root roles, or illegal helper-role spillover. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-binder-shell-public-contract-communication-only` | Enforced | every Binder-owned shell-facing seam in an active root | Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder communicates with the shell only through documented `shell.api/**` contracts and binding surfaces. It does not communicate with concrete shell host internals. |
| `view-binder-contentmodel-binding-only` | Enforced Elsewhere | every Binder-owned passive-`View` binding seam in an active root or reusable `slotcontent/**` unit | Error Prone `PassiveViewSurfaceBoundary`; Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder wires prepared render state by binding each passive `View` to its own same-stem `ContentModel`. The passive-View API gate blocks imperative render commands and callback/result protocols as replacements for model binding. |
| `view-binder-viewinputevent-forwarding-only-through-onviewinputevent-consume` | Enforced | every Binder-owned passive-`View` or reusable `slotcontent/**` `View` to same-root `IntentHandler` input seam | Error Prone `ViewBinderViewInputEventWiring` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder wires a passive `View` only through `view.onViewInputEvent(intentHandler::consume)`, including reused `slotcontent/**` Views. |
| `view-binder-no-legacy-intenthandler-write-sink-injection` | Enforced | every Binder-owned outward seam from a local `IntentHandler` toward Binder-mediated outer work | Error Prone `ViewBinderApplicationSinkWiring` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder does not inject legacy outward-work sinks such as `onPublishedEventRequested(...)` or other `PublishedEvent`-based callback seams into a same-root `IntentHandler`. Domain writes leave directly from the handler through the matching root `*ApplicationService`. |
| `view-binder-no-projectionmodel-request-protocol-consumption` | Enforced | every Binder-owned listener or callback seam that touches a same-root or reusable projection model | Error Prone `ViewBinderProjectionModelRequestProtocol` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder does not subscribe to `*Request*Property()`, `*TokenProperty()`, or equivalent request-style outward protocol members on `*ContributionModel` or reusable `*ContentModel` surfaces. Outward work must not be reconstructed from projection-model request protocols. |
| `view-binder-domain-boundary-communication-only` | Enforced | every Binder-owned direct domain seam in an active root | Error Prone `ViewBinderDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewEnforcement` | A Binder communicates directly with the backend only through root `*ApplicationService` boundaries and domain `published/**` carrier types. It does not communicate directly with `src/data/**` or non-public domain internals. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-binder-own-contributionmodel-dependency` | Review-Owned | every active-root `*Binder.java` under `src/view/**` | none | none | A Binder still has obvious direct ownership of its co-located aggregate `*ContributionModel` and same-root child `*ContentModel` surfaces instead of hiding them behind only foreign helpers or indirect assembly seams. |
| `view-binder-own-passive-surface-dependency` | Review-Owned | every active-root `*Binder.java` under `src/view/**` | none | none | A Binder still has obvious direct ownership of at least one same-root passive `*View` or intentionally reused `slotcontent/**` `*View` surface, so the role really owns visible runtime binding for one active root. |
| `view-binder-shell-lookup-and-lifecycle-ownership` | Review-Owned | every active-root `*Binder.java` under `src/view/**` | none | none | Shell runtime lookup, shell-facing slot binding, lifecycle-owned activation wiring, and role instantiation stay in the Binder instead of leaking into `*Contribution`, passive `*View`, or domain-facing helpers. |
| `view-binder-no-local-contribution-or-second-binder-dependency` | Review-Owned | every active-root `*Binder.java` under `src/view/**` | none | none | The view-layer standard says a Binder may know only its same-root aggregate model, same-root child content models, optional handler, passive views, same-root carriers, and intentional reusable slotcontent seams directly. Same-root `*Contribution` or second-`*Binder` knowledge remains review-rejected until a narrower blocker exists. |
| `view-binder-slotcontent-reuse-intentionality` | Review-Owned | every Binder-owned direct dependency on reusable `slotcontent/**` surfaces | none | none | A mechanically legal reusable-slotcontent dependency exists only when the reused surface is genuinely intentional reusable UI and not just hidden feature-specific assembly split across packages. |
| `view-binder-readback-intake-minimality` | Review-Owned | every Binder-owned readback seam from domain `published/**` facts into a co-located `ContributionModel` or child `ContentModel` wiring point | none | none | A mechanically legal Binder still keeps its work to the minimum one-time runtime lookup and listener installation needed for one root instead of growing broad imperative update APIs or becoming the semantic owner of readback projection. |
| `view-binder-no-projection-backchannel-semantics` | Review-Owned | every Binder-owned local model seam in an active root | none | none | A Binder treats the co-located `ContributionModel` only as a projection target fed by `published/*Model` readback. It does not use projection getters, request tokens, or view-local caches as a second command/session source. |
| `view-binder-readback-source-is-domain-model-handle` | Review-Owned | every Binder-owned domain-state wiring path in an active root | none | none | Domain-backed view state and domain-owned feedback are sourced only from a direct same-context read-side `published/*Model` runtime service, then consumed through `current()` and `subscribe(...)`. The Binder may wire that readback, but the model side remains the owner of the live projection reaction. Direct one-shot `*Result`, `*Snapshot`, `*Payload`, `*SearchResult`, `*CalculationResult`, or `*Preview` responses are not used as authoritative view-state or feedback sources. |
| `view-binder-local-view-effect-sink-thinness` | Review-Owned | every Binder-owned non-domain local effect sink injected into a same-root `*IntentHandler` | none | none | A Binder may wire a same-root local view-effect sink only for passive-View effects that stay entirely local to the active root, such as viewport reset. The sink must not mutate projection models or stand in for a domain write seam. |
| `view-binder-thin-runtime-composition-semantics` | Review-Owned | every active-root `*Binder.java` under `src/view/**` | none | none | A Binder stays a thin runtime composition adapter and does not turn legal listener, sink, shell, and readback seams into long-lived workflow orchestration. This also excludes using direct `ApplicationService` responses as an ad-hoc state-transport protocol into the view layer. |

## References

- [View Layer Standard](docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](docs/project/architecture/patterns/shell-layer.md:1)
- [View Layer Enforcement](docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [View IntentHandler Enforcement](docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [ViewInputEvent Enforcement](docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
