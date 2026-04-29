Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Bootstrap-layer responsibilities, desktop launch framing,
discovery contracts, instantiation rules, registration order, and startup
resolution for passive shell contributions.

# Bootstrap Standard

## Goal

Bootstrap discovers and registers shell-facing UI contributions and backend
service contributions generically and owns desktop launch framing around shell
startup without becoming a feature registry or a second UI layer.

Bootstrap owns desktop startup framing, startup composition, and generic
discovery only. It does not own shell behavior, feature behavior, business
rules, or view-layer presentation logic.

## Layer Scope

The bootstrap layer is the outer composition and launch boundary under
`bootstrap/**`.

It may contain:

- desktop application launch framing around `AppShell`
- packaged startup-preloader framing
- generic discovery helpers for documented view and data registration roots
- startup resolution and deterministic registration sequencing

It must not become:

- a feature registry with handwritten per-feature wiring
- a shell-host extension surface
- a feature-logic or presentation-state home
- a second generic JavaFX feature layer beside `src/view/**`

## Bootstrap Responsibilities

`AppBootstrap` is responsible for:

- discovering exported `*ServiceContribution` roots
- building the shared shell `ServiceRegistry`
- constructing `AppShell` with that registry
- discovering shell-facing `*Contribution` roots
- resolving contribution metadata and bindings
- registering each resolved contribution by contribution kind
- selecting startup landing and navigating to it

Routine feature addition must not require manual bootstrap registries,
feature-specific bootstrap imports, or handwritten per-feature shell wiring.

## Desktop Launch Framing

Bootstrap also owns the desktop launch surface around shell startup.

When the desktop app launch surface exists, bootstrap:

- creates the JavaFX stage and scene around the composed `AppShell`
- applies global startup resources such as the centralized stylesheet and
  desktop window icon
- coordinates packaged preloader handoff around shell startup

This launch framing stays outer and technical. It must not absorb feature
views, feature workflow, or shell-host behavior beyond creating and showing the
shell.

## Discovery Contracts

### UI Contribution Discovery

Bootstrap:

- scans `src/view/leftbartabs/<entry>/`, `src/view/statetabs/<entry>/`, and
  `src/view/dropdowns/<entry>/`
- considers only direct concrete classes named `*Contribution`
- expects each contribution to implement `shell.api.ShellContribution`
- expects a public no-arg constructor unless the generic registration
  contract changes explicitly
- instantiates discovered contributions reflectively and generically

`src/view/slotcontent/**` is not a bootstrap discovery root.

### Service Discovery

Bootstrap:

- scans `src/data/<feature>/` root classes
- expects exactly one root class whose name ends with `ServiceContribution`
- expects that class to implement `shell.api.ServiceContribution`
- expects a public no-arg constructor
- registers exported capabilities into the shared shell service registry

Bootstrap must not discover or register feature-internal view or data roles
such as `*Binder`, `*View`, `*ContributionModel`, `*ContentModel`,
`*IntentHandler`, `repository/`, `query/`, `gateway/`, `model/`, or `mapper/`
as bootstrap entrypoints.

## Instantiation Rules

- discovery loads contribution classes through the application classloader
- interfaces and abstract classes are ignored as non-instantiable roots
- missing or non-public generic constructors are bootstrap errors
- unsupported contribution kinds are bootstrap errors

Current bootstrap behavior may eagerly resolve discovered contributions. That
is current behavior, not the long-term public contract.

## Registration Order

Target registration order:

1. discover service contributions
2. populate the shared shell service registry
3. construct the shell with that registry
4. discover UI contributions
5. sort UI contributions by contribution key
6. register them by contribution kind:
   left-bar tab, global state tab, top-bar dropdown window

The key sort is deterministic registration policy, not a user-visible
navigation-order contract.

## Startup Resolution

- only left-bar tab contributions may become startup landing targets
- exactly one left-bar contribution may declare `defaultLanding=true`
- multiple default-landing tab contributions are bootstrap errors
- if none declare `defaultLanding=true`, startup falls back to the first tab
  in sorted navigation order
- state tabs and top-bar dropdown windows are never startup landing targets

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/overview.md:1)
- [Layering Architecture Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/layering-architecture.md:1)
- [Shell Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/shell-layer.md:1)
- [View Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/view-layer.md:1)
- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Bootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-enforcement.md:1)
- [Bootstrap AppBootstrap Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/bootstrap-app-bootstrap-enforcement.md:1)
