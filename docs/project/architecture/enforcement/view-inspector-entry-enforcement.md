Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-03
Source of Truth: Complete invariant catalog for the reusable
`*InspectorEntry` role itself in `src/view/slotcontent/details/**`.

# View InspectorEntry Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`*InspectorEntry` role itself.

It answers four questions for every `*InspectorEntry` surface:

- when the adapter MAY exist
- what the adapter MUST contain
- what the adapter MUST NOT contain
- which direct communication boundaries the adapter itself MAY and MUST NOT
  cross

This document does not own generic `slotcontent/**` topology, reusable-unit
role counts, Binder-owned inspector push wiring, or the wider shell/details
lifecycle. Those stay in the view-layer and neighboring role-enforcement
documents.

`*InspectorEntry` is current-state legacy role inventory, not target
reusable-slotcontent architecture. The target reusable unit is
`View + ViewInputEvent + ContentModel`; this document remains only because the
repo still carries dedicated current-state gates for `*InspectorEntry`.

Unified focused bundle entrypoint:

- `./gradlew checkViewInspectorEntryEnforcement --rerun-tasks --console=plain`
  runs the currently active InspectorEntry-focused Error Prone,
  build-harness, and jQAssistant checks through one root task. Canonical
  blocking behavior remains at `./gradlew compileJava`,
  `./gradlew checkViewInspectorEntryEnforcement`, `./gradlew checkArchitecture`,
  and `./gradlew build` as listed below.

## Invariant Catalog

### May Exist

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-inspectorentry-slotcontent-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` | `view-inspector-entry-enforcement` bundle build-harness `ViewInspectorEntryTopologyRules` | `./gradlew checkViewInspectorEntryEnforcement` | `*InspectorEntry.java` files may exist only inside reusable `slotcontent/**` units. Active roots and non-slotcontent view paths do not admit the role. |
| `view-inspectorentry-details-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` | Error Prone `ViewInspectorEntryDependencyBoundary` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | `*InspectorEntry.java` files may exist only inside reusable `slotcontent/details/**` units. Other reusable `slotcontent` families do not admit the role. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-inspectorentry-one-top-level-type-per-file` | Enforced | every `*InspectorEntry.java` under `src/view/**` | `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryOneTopLevelTypePerFile` | `./gradlew checkViewInspectorEntryEnforcement` | Each `*InspectorEntry` source file defines exactly one top-level adapter type, and that type itself is the file's `*InspectorEntry` role owner. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-inspectorentry-no-bootstrap-or-data-dependencies` | Enforced | every `*InspectorEntry.java` under `src/view/**` | Error Prone `ViewInspectorEntryDependencyBoundary` and `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryDependencies` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | An `InspectorEntry` does not depend on `bootstrap/**` or `src/data/**`. The role does not become an outer-layer or source-facing adapter. |
| `view-inspectorentry-no-shell-runtime-or-host-dependencies` | Enforced | every `*InspectorEntry.java` under `src/view/**` | Error Prone `ViewInspectorEntryShellApiAllowlist` and `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryDependencies` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | An `InspectorEntry` does not depend on `ShellRuntimeContext`, `InspectorSink`, `ShellSlot`, other shell API families, or `shell.host/**`. |
| `view-inspectorentry-javafx-node-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` that references JavaFX types | Error Prone `ViewInspectorEntryDependencyBoundary` | `./gradlew compileJava` | An `InspectorEntry` does not become a general JavaFX assembly root. From JavaFX it may use only `javafx.scene.Node` as the shell content boundary type. |
| `view-inspectorentry-domain-published-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` that references `src.domain/**` | Error Prone `ViewInspectorEntryDependencyBoundary` and `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryDependencies` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | An `InspectorEntry` depends only on read-side domain `published/**` carriers and does not import domain internals, write/query carriers outside that published boundary, or root `*ApplicationService` types. |
| `view-inspectorentry-same-unit-view-surface-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` that references `src.view/**` | Error Prone `ViewInspectorEntryDependencyBoundary` and `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryDependencies` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | An `InspectorEntry` may reference only its own reusable details unit's `*View`, `*ContentModel`, and same-unit nested/private `*InspectorEntry` support inside that role file. It does not import `*Contribution`, `*Binder`, `*ContributionModel`, legacy `*ViewModel` or `*PresentationModel`, `*IntentHandler`, `*ViewInputEvent`, `*PublishedEvent`, foreign view units, or separate same-unit helper top-levels such as `*Support`, `*Helper`, or `*Assembler`. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-inspectorentry-shell-boundary-is-passive-descriptor-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` | Error Prone `ViewInspectorEntryShellApiAllowlist` and `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryDependencies` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | The direct shell boundary vocabulary of an `InspectorEntry` is limited to `shell.api.InspectorEntrySpec`. It does not directly depend on `InspectorSink`, `ShellRuntimeContext`, shell slots, or shell host surfaces. |
| `view-inspectorentry-domain-boundary-is-read-side-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` that reaches `src.domain/**` | Error Prone `ViewInspectorEntryDependencyBoundary` and `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryDependencies` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | The direct domain boundary vocabulary of an `InspectorEntry` is limited to read-side `published/**` carriers. It does not directly depend on root `*ApplicationService` boundaries, domain internals, or other write-side backend seams. |

## Review-Owned

- `view-inspectorentry-thin-adapter-shape`
  a mechanically legal `InspectorEntry` stays a thin local adapter that
  assembles one inspector entry from same-unit view parts and read-side
  carriers. It does not become hidden workflow orchestration, cross-feature
  composition, service lookup, or a Binder/shell substitute.

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
