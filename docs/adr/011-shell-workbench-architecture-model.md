# ADR 011: Passive Workbench Shell Architecture Model

- Status: Accepted
- Date: 2026-04-18

## Context

This ADR remains the shell workbench model. Its `assembly/`-specific,
component-root, and pre-Binder view composition details are superseded by
[ADR 022: View Slotcontent And Binders](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/022-view-slotcontent-and-binders.md:1).

SaltMarcher already uses a passive shell with generic discovery, fixed slot
surfaces, and shell-scoped runtime services. However, the architecture has so
far described those ideas through project-local wording and a combined
shell/discovery standard instead of a single explicit workbench model.

That leaves three problems:

- shell host roles, contribution roles, and bootstrap mechanics are mixed in
  one document
- the repository lacks a professional architecture vocabulary for shell-owned
  workbench responsibilities and contribution boundaries
- the current standards series is not strict enough yet about contribution-root
  composition boundaries
- current eager screen creation in bootstrap is an implementation detail, but
  the model does not yet make clear whether lazy shell-managed realization is a
  valid future behavior

SaltMarcher needs a binding shell model that matches the current code without
forcing an open named-region framework or manual feature registries.

## Decision

SaltMarcher adopts a passive workbench shell as the canonical shell
architecture model.

- `AppShell` is the workbench root that owns navigation, toolbar, workspace,
  inspector/details hosting, runtime-state hosting, activation/deactivation,
  and layout persistence.
- `ShellContributionSpec` and its concrete types are pure registration
  metadata. `ShellTabSpec` may carry a feature-owned navigation-graphic
  supplier as part of that registration metadata.
- Shell-facing view registration belongs in `*Contribution` classes under
  `src/view/featuretabs`, `src/view/runtimetabs`, and shell-contributed
  `src/view/dropdowns`; runtime composition belongs in the co-located
  `*Binder`.
- `ShellScreen` is the current Java API name for prepared contribution
  content. Only `ShellTabSpec` contributions are navigable workbench parts;
  top-bar and auxiliary contributions project content into fixed shell-owned
  surfaces.
- `ShellRuntimeContext` is the single shell-scoped runtime gateway for
  inspector publishing, backend capability lookup, and typed per-shell runtime
  sessions. The runtime-capability lookup API is
  `services()` / `ServiceRegistry`.
- The fixed shell contract is binding and workbench-facing:
  global toolbar, control rail, primary work surface, inspector panel, and
  auxiliary panel. The current Java slot names remain
  `TOP_BAR`, `COCKPIT_CONTROLS`, `COCKPIT_MAIN`, `COCKPIT_DETAILS`, and
  `COCKPIT_STATE`.
  `COCKPIT_DETAILS` remains shell-owned and is populated only through
  inspector APIs.
- Generic discovery and bootstrap mechanics remain a separate concern under
  ADR 002 and the shell discovery/bootstrap standard.
- Current eager `createScreen(...)` calls remain valid, but the model also
  permits future shell-owned lazy first-activation realization and caching.

This model is informed by established patterns without adopting any external
framework as-is:

- composite-application shell and declarative composition vocabulary
- workbench part and lifecycle vocabulary
- declarative contribution points and scoped runtime services

## Consequences

- Shell architecture now has one canonical standard for role ownership,
  dependency rules, lifecycle expectations, and forbidden patterns.
- The discovery/bootstrap standard can focus only on scanning, instantiation,
  registration, and startup resolution.
- Features must treat the shell as a fixed typed workbench contract rather than
  an open-ended named-region system.
- The target responsibility split is: shell registration in Contributions,
  runtime composition and binding in Binders, presentation state and actions in
  ViewModels, passive JavaFX behavior in Views, and business behavior in domain
  application services.
- Feature code must not import `AppShell` or concrete shell pane classes as
  extension points.
- Contribution roots are expected to remain stateless and safe for future
  shell-managed lazy realization.
- The current Java API names stay valid for the first pass even where the
  architectural vocabulary is broader or more neutral than the code symbols.

## Alternatives Considered

### Keep the existing combined shell-and-discovery document

Rejected because it mixes shell role ownership with bootstrap mechanics and
keeps the architecture vocabulary too weak.

### Adopt open named-region composition as the primary shell contract

Rejected because SaltMarcher already relies on a small fixed set of shell-owned
surfaces and wants those surfaces to remain the binding public contract.

### Keep project-local ad hoc shell terminology

Rejected because the current model aligns more clearly with established
workbench and composite-application patterns than with a repository-specific
vocabulary.

### Use manual bootstrap registries for feature wiring

Rejected because routine feature registration would stop being generic and the
shell boundary would become less passive.

## Related Documents

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Passive Workbench Shell Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-workbench.md:1)
- [ADR 019: Shell Cockpit MVVM Contribution View Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/019-shell-cockpit-tab-model-view-layer.md:1)
- [ADR 020: View Contributions And ViewModels](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/020-view-contributions-and-viewmodels.md:1)
- [ADR 022: View Slotcontent And Binders](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/022-view-slotcontent-and-binders.md:1)
- [Shell Discovery And Bootstrap Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/shell-and-discovery.md:1)
- [ADR 002: Passive Shell With Generic Feature Discovery](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/002-passive-shell-and-discovery.md:1)
- [ADR 004: Shared Runtime Session Store](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/adr/004-shared-runtime-session-store.md:1)

## External Research Basis

- Prism view composition:
  <https://prismlibrary.github.io/docs/wpf/view-composition.html>
- Prism modules and module catalog:
  <https://prismlibrary.github.io/docs/wpf/legacy/Modules.html>
- Eclipse workbench views extension point:
  <https://archive.eclipse.org/eclipse/downloads/documentation/2.0/html/plugins/org.eclipse.platform.doc.isv/reference/extension-points/org_eclipse_ui_views.html>
- Eclipse workbench internals:
  <https://www.eclipse.org/articles/Article-UI-Workbench/workbench.html>
- IntelliJ tool windows:
  <https://plugins.jetbrains.com/docs/intellij/tool-windows.html?from=IJPluginTemplate>
- IntelliJ services:
  <https://plugins.jetbrains.com/docs/intellij/plugin-services.html>
- IntelliJ extension points:
  <https://plugins.jetbrains.com/docs/intellij/plugin-extension-points.html>
- VS Code contribution points:
  <https://code.visualstudio.com/api/references/contribution-points>
- VS Code views and workbench UX:
  <https://code.visualstudio.com/api/ux-guidelines/views>
