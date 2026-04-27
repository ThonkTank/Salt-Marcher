Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-27
Source of Truth: Repository structure, feature layout, and public entrypoint
rules for active application code.

# Repository Structure Standard

## Goal

Feature code must stay inside `src/`, and application startup and shell hosting
must stay outside feature slices.

The active view target is organized by shell-discovered active roots and
reusable generic `slotcontent` families:

- `src/view/leftbartabs`
- `src/view/statetabs`
- `src/view/dropdowns`
- `src/view/slotcontent`

`src/view/primitives/` is no longer a canonical target root. Reusable generic
components that used to fit that role belong under
`src/view/slotcontent/primitives/`.

## Repository Layout

```text
bootstrap/
shell/
src/
  view/
  domain/
  data/
resources/
docs/
  project/
    architecture/
    requirements/
    contract/
    domain/
    delivery/
    verification/
  <feature>/
  compat/
tools/
  gradle/
  quality/
    skills/
```

Additional constraints:

- `salt-marcher/` is legacy reference material, not the active implementation
  target
- new top-level feature code must be addable inside `src/`
- do not create alternate top-level architecture roots for active feature code
- stylesheet files for active code must be centralized in
  `resources/salt-marcher.css`
- `tools/gradle/` owns included Gradle builds and verification harnesses
- `tools/quality/` owns quality-platform configuration, rules, and helper
  scripts
- `tools/quality/skills/` owns repo-versioned Codex skills and their bundled
  references
- `/home/aaron/Schreibtisch/projects/references/` owns local-only source
  mirrors and readable extracts for source-backed decisions
- `docs/compat/` is reserved for deprecated compatibility stubs and must not
  become canonical again

## Feature Layout

```text
src/
  view/
    leftbartabs/
      <entry>/
        <PascalEntry>Contribution.java
        <PascalEntry>Binder.java
        <PascalEntry>PresentationModel.java
        <PascalEntry>IntentHandler.java    # optional when the root is purely passive
        <PascalEntry>*View.java            # feature-specific colocated views
    statetabs/
      <entry>/
        <PascalEntry>Contribution.java
        <PascalEntry>Binder.java
        <PascalEntry>PresentationModel.java
        <PascalEntry>IntentHandler.java    # optional when the root is purely passive
        <PascalEntry>*View.java
    dropdowns/
      <entry>/
        <PascalEntry>Contribution.java     # optional shell-discovered adapter
        <PascalEntry>Binder.java
        <PascalEntry>PresentationModel.java
        <PascalEntry>IntentHandler.java    # optional when the root is purely passive
        <PascalEntry>*View.java
    slotcontent/
      controls/<entry>/
        <PascalEntry>View.java
        <PascalEntry>PresentationModel.java
        <PascalEntry>IntentHandler.java
      main/<entry>/
        <PascalEntry>View.java
        <PascalEntry>PresentationModel.java
        <PascalEntry>IntentHandler.java
      state/<entry>/
        <PascalEntry>View.java
        <PascalEntry>PresentationModel.java
        <PascalEntry>IntentHandler.java
      details/<entry>/
        <PascalEntry>View.java
        <PascalEntry>PresentationModel.java
        <PascalEntry>IntentHandler.java
        <PascalEntry>InspectorEntry.java
      topbar/<entry>/
        <PascalEntry>View.java
        <PascalEntry>PresentationModel.java
        <PascalEntry>IntentHandler.java
      primitives/<entry>/
        <PascalEntry>View.java
        <PascalEntry>PresentationModel.java
        <PascalEntry>IntentHandler.java
  domain/
    <feature>/
      <PascalFeatureName>ApplicationService.java
      published/
      application/
      <domain-module>/
  data/
    <feature>/
      <PascalFeatureName>ServiceContribution.java
      repository/
      query/
      gateway/
      model/
      mapper/
```

Notes:

- feature-specific one-off components belong directly in the owning
  `leftbartabs`, `statetabs`, or `dropdowns` package
- `slotcontent/**` is reserved for generic reusable components only
- reusable `slotcontent` units may be fully passive or may also own reusable
  `PresentationModel` and `IntentHandler` roles when they publish reusable
  state or input behavior
- feature-specific `*View`, `*PresentationModel`, and `*IntentHandler` classes
  may extend reusable generic bases from `slotcontent/**`

## Public Entrypoints

Every shell-registered UI contribution is represented by one contribution
root:

- `src/view/leftbartabs/<entry>/<PascalEntry>Contribution.java` for one
  left-bar tab
- `src/view/statetabs/<entry>/<PascalEntry>Contribution.java` for one global
  state tab
- `src/view/dropdowns/<entry>/<PascalEntry>Contribution.java` for one
  shell-discovered dropdown; dropdown roots may omit this file when another
  Binder invokes them

A contribution class is `public final`, has a public no-arg constructor,
implements `shell.api.ShellContribution`, and defines exactly one shell
contribution.

Every active root owns exactly one `*Binder.java` file. The Binder owns
runtime service lookup, same-root role construction, optional reusable
`slotcontent` construction, listener wiring, slot binding, details
publication, and lifecycle hooks.

Every active root also owns exactly one `*PresentationModel.java` file in the
same root. It owns aggregate observable presentation state and projection
logic, not shell discovery, view instantiation, or application-service access.

Interactive roots may additionally own one `*IntentHandler.java` file in the
same root. It owns component-local input interpretation only.

Reusable generic single-slot content lives under
`src/view/slotcontent/<slot>/<entry>/`. Detail slotcontent may also provide a
`*InspectorEntry.java` adapter that builds shell Inspector entry specs from
Binder-supplied loader functions.

Every service-exporting data feature exposes exactly one service-registration
entrypoint:

- `src/data/<feature>/<PascalFeatureName>ServiceContribution.java`, or
  `src/data/<feature>/<Context Name>ServiceContribution.java` when the domain
  context declares a machine-readable `Context Name:` marker
- `public final`
- public no-arg constructor
- implements `shell.api.ServiceContribution`

## Enforcement Notes

- The canonical owner model, rule-status vocabulary, and blocking-task mapping
  for these checks live in the
  [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
- The concrete per-rule status and owner mapping for repository-structure
  rules lives in the
  [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage.md:1)
- Current live harness rules still reflect parts of the pre-cleanup topology in
  some areas. The target package model documented here is the canonical owner
  for the next harness-alignment step
- A feature root may contain Markdown documents with the standard co-located
  filenames without counting as alternate Java entrypoints

## Packaging Rules

- active target view code lives under `src/view/leftbartabs`,
  `src/view/statetabs`, `src/view/dropdowns`, or `src/view/slotcontent`
- active-root Java files are direct files under `src/view/<area>/<entry>/`
- reusable generic slotcontent Java files are direct files under
  `src/view/slotcontent/<slot>/<entry>/`
- a root under `leftbartabs` or `statetabs` owns exactly one shell-registered
  contribution
- a root under `dropdowns` owns zero or one shell-registered contribution
- every active root owns exactly one `*Binder` and one aggregate
  `*PresentationModel`
- interactive active roots may own exactly one `*IntentHandler`
- a feature-specific `*View` file belongs in its owning active root package
- reusable generic `*View` files belong under `slotcontent/**`
- reusable generic `*PresentationModel` and `*IntentHandler` files belong under
  `slotcontent/**` only when the reusable component actually owns reusable
  state or input behavior
- Contributions may depend on shell public contracts and their own Binder
- Binders may depend on shell public contracts, same-root
  `PresentationModels`, optional same-root `IntentHandlers`, same-root
  feature-specific Views, reusable `slotcontent` roles, JavaFX `Node`, root
  domain application-service boundaries, and explicit domain `published/**`
  carriers
- `PresentationModels` may depend on JavaFX beans/collections, same-surface
  local support types, and read-side domain `published/**` carriers, but not
  shell, views, data, `*ApplicationService` types, or published write/query
  carriers
- `IntentHandlers` may depend only on their co-located
  `PresentationModel`, same-surface local support types, and ordinary JDK
  support
- passive Views may depend on JavaFX UI APIs, observable
  `PresentationModel` state surfaces, reusable `slotcontent` bases, and narrow
  listener/callback/property types, but must not depend on shell, domain,
  data, or `*ApplicationService` types
- existing `src/view/<component>/`, `*ViewContribution.java`, `View/`,
  `ViewModel/`, `assembly/`, non-shared view `api/`, `Model/`, `Controller/`,
  `interactor/`, and canonical `src/view/primitives/**` ownership are migration
  debt, not target topology

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/documentation.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/view-layer.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/shell-and-discovery.md:1)
