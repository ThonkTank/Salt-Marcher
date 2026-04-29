Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Complete invariant catalog for reusable `*InspectorEntry`
adapters in `src/view/slotcontent/**`.

# View InspectorEntry Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`*InspectorEntry` role itself.

It answers four questions for every `*InspectorEntry` surface:

- when the adapter MAY exist
- what the adapter MUST contain
- what the adapter MUST NOT contain
- which direct communication boundary the adapter itself MAY cross

This document does not own generic `slotcontent/**` topology, Binder-owned
inspector push wiring, or the wider shell/details lifecycle. Those stay in the
view-layer and neighboring role-enforcement documents.

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
| `view-inspectorentry-details-only` | Review-Owned | every `*InspectorEntry.java` under `src/view/**` | none | none | `view-layer.md` narrows the role to inspector/details publication, but the live gates do not currently prove a stricter `slotcontent/details/**`-only placement. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-inspectorentry-one-top-level-type-per-file` | Enforced | every `*InspectorEntry.java` under `src/view/**` | `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryOneTopLevelTypePerFile` | `./gradlew checkViewInspectorEntryEnforcement` | Each `*InspectorEntry` source file defines exactly one top-level `InspectorEntry` type rather than several peer adapter types in one source file. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-inspectorentry-shell-spec-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` | Error Prone `ViewInspectorEntryShellApiAllowlist` and `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryDependencies` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | An `InspectorEntry` may use `shell.api.InspectorEntrySpec` only. It does not import `ShellRuntimeContext`, `InspectorSink`, `ShellSlot`, other shell API families, or `shell.host/**`. |
| `view-inspectorentry-javafx-node-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` that references JavaFX types | Error Prone `ViewInspectorEntryDependencyBoundary` | `./gradlew compileJava` | An `InspectorEntry` does not become a general JavaFX assembly root. From JavaFX it may use only `javafx.scene.Node` as the shell content boundary type. |
| `view-inspectorentry-domain-published-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` that references `src.domain/**` | Error Prone `ViewInspectorEntryDependencyBoundary` and `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryDependencies` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | An `InspectorEntry` depends only on read-side domain `published/**` carriers and does not import domain internals, write/query carriers outside that published boundary, or root `*ApplicationService` types. |
| `view-inspectorentry-same-unit-view-surface-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` that references `src.view/**` | Error Prone `ViewInspectorEntryDependencyBoundary` and `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryDependencies` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | An `InspectorEntry` may reference only its own reusable unit's `*View`, `*ContentModel`, and same-unit `*InspectorEntry` support. It does not import `*Contribution`, `*Binder`, `*ContributionModel`, `*IntentHandler`, `*ViewInputEvent`, `*PublishedEvent`, or foreign view units. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `view-inspectorentry-passive-shell-descriptor-only` | Enforced | every `*InspectorEntry.java` under `src/view/**` | Error Prone `ViewInspectorEntryShellApiAllowlist` and `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryDependencies` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | An `InspectorEntry` communicates to the shell only by constructing or returning the passive descriptor type `InspectorEntrySpec`. |
| `view-inspectorentry-no-direct-shell-push-or-domain-call` | Enforced | every `*InspectorEntry.java` under `src/view/**` | Error Prone `ViewInspectorEntryShellApiAllowlist`, Error Prone `ViewInspectorEntryDependencyBoundary`, and `view-inspector-entry-enforcement` bundle jQAssistant `saltmarcher:ViewInspectorEntryDependencies` | `./gradlew compileJava` and `./gradlew checkViewInspectorEntryEnforcement` | An `InspectorEntry` does not push itself through shell runtime APIs and does not call domain application boundaries directly. Binder-owned shell push and Binder-owned application-service communication stay outside this role. |
| `view-inspectorentry-thin-adapter-shape` | Review-Owned | every `*InspectorEntry.java` under `src/view/**` | none | none | A mechanically legal `InspectorEntry` should stay a thin adapter that assembles one inspector entry from local reusable view parts and read-side carriers. It should not become a hidden workflow, lookup, or cross-feature composition root. |

## References

- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [View Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/view-layer-enforcement.md:1)
