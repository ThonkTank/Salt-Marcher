Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-17
Source of Truth: Centralized JavaFX styling rules and blocking checks for active
application code.

# Styling Standard

## Goal

SaltMarcher styling must be authored centrally so feature code does not carry
its own inline presentation rules.

## Rules

- Stylesheet files must live directly under `resources/`.
- Active application code under `bootstrap/`, `shell/`, and `src/` must not use
  `setStyle(...)`.
- View code should express presentation through style classes and shared
  selectors in the central stylesheet set.

## Enforcement

- `checkArchitecture` fails when active Java sources use inline JavaFX styling.
- Gradle `check` fails when stylesheet files exist outside the top-level
  `resources/` directory.

## References

- [Architecture Overview](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/overview.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/architecture/standards/quality-platforms.md:1)
