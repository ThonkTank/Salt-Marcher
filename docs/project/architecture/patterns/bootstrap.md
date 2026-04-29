Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-28
Source of Truth: Bootstrap responsibilities, discovery contracts,
instantiation rules, registration order, and startup resolution for passive
shell contributions.

# Bootstrap Standard

## Goal

Bootstrap discovers and registers shell-facing UI contributions and backend
service contributions generically without becoming a feature registry.

Bootstrap owns startup composition only. It does not own shell behavior,
feature behavior, business rules, or view-layer presentation logic.

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
