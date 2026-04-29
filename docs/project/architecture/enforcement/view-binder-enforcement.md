Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the `*Binder` role itself in
active view roots under `src/view/**`.

# View Binder Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`*Binder` role itself.

It answers four questions for every active-root `*Binder` surface:

- what the role MUST contain
- what the role MUST NOT contain
- which direct communication boundaries the role itself MAY cross
- which remaining Binder semantics are still review-owned or candidate-only

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
| `view-binder-own-model-and-slot-surface-dependencies` | Enforced | every active-root `*Binder.java` under `src/view/**` | jQAssistant `saltmarcher:ViewBinderUsesOwnModelAndSlotSurface` | `./gradlew checkViewBinderEnforcement` | A Binder has a direct dependency on its co-located `*ContributionModel` and on at least one passive same-root or reusable `slotcontent/**` `*View` surface, so the role really acts as the runtime composition and binding owner of one active root. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-binder-dependency-boundary` | Enforced | every active-root `*Binder.java` under `src/view/**` | Error Prone `ViewBinderDependencyBoundary`, ArchUnit `bindersMustNotReachDataOrShellHost`, and jQAssistant `saltmarcher:ViewBinderDependencies` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkViewBinderEnforcement` | A Binder depends only on documented shell public contracts, its own same-root `*ContributionModel`, optional same-root `*IntentHandler`, same-root `*View`, same-root `*ViewInputEvent`, optional same-root `*PublishedEvent`, reusable `slotcontent/**` roles, root `*ApplicationService` boundaries, and domain `published/**` carriers. It does not depend on `bootstrap/**`, `src/data/**`, `shell.host/**` or other shell internals, foreign view units, or non-public domain internals. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-binder-viewinputevent-forwarding-only-through-onviewinputevent-consume` | Enforced | every Binder-owned same-root passive-`View` to local-`IntentHandler` input seam | Error Prone `ViewBinderViewInputEventWiring` | `./gradlew compileJava` | A Binder wires a passive same-root `View` to its local `IntentHandler` only through `view.onViewInputEvent(intentHandler::consume)`. It does not attach alternate direct handler callbacks to that `View`. |
| `view-binder-publishedevent-sink-injection-only` | Enforced | every Binder-owned write seam from a local `IntentHandler` toward domain work | Error Prone `ViewBinderApplicationSinkWiring` | `./gradlew compileJava` | A Binder injects domain-write seams into a same-root `IntentHandler` only as `Consumer<SameRootPublishedEvent>`. It does not install other callback or result protocols as hidden write paths into the handler. |

## Review-Owned

| Invariant ID | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- |
| `view-binder-readback-intake-minimality` | every Binder-owned readback seam from domain `published/**` facts into a co-located `ContributionModel` | none | none | A mechanically legal Binder still keeps readback wiring at the minimum listener-facing model intake seams for one root instead of growing broad imperative update APIs. |

## Candidate

| Invariant ID | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- |
| `view-binder-thin-runtime-composition-semantics` | every active-root `*Binder.java` under `src/view/**` | none | none | A Binder stays a thin runtime composition adapter and does not turn legal listener, sink, and readback seams into long-lived workflow orchestration. |

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
- [View IntentHandler Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-intent-handler-enforcement.md:1)
- [ViewInputEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-view-input-event-enforcement.md:1)
- [PublishedEvent Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-published-event-enforcement.md:1)
