Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-15
Source of Truth: Target source shape, dependency direction, and
architecture-significant quality constraints for the SaltMarcher desktop app.

# Source Architecture

## Purpose And Concerns

This specification serves maintainers changing features, persistence, the
JavaFX shell, and application startup. It answers where behavior belongs, how
features collaborate, and which boundaries protect UI responsiveness, local
data, and diagnosability.

SaltMarcher remains one local JavaFX desktop process, one SQLite database, and
one Gradle application. The target is a modular monolith, not a distributed
system or a set of Gradle subprojects.

## Target Shape

```text
app/       explicit application composition and lifecycle
shell/     passive JavaFX host and shell contracts
platform/  execution, persistence, diagnostics, and state mechanisms
features/  capability-driven feature roles and required adapters
resources/ static resources and centralized application styling
docs/      durable product, domain, contract, architecture, and proof truth
tools/     retained build and development tooling
```

Feature roles follow owned behavior rather than a mandatory folder template. A
feature publishes `api` only for capabilities consumed outside its
implementation, owns `domain` only for business truth and invariants, and owns
`application` only for use-case orchestration. A feature with stored truth owns
an `adapter/sqlite`; a feature with JavaFX presentation owns an
`adapter/javafx`. Empty role packages are forbidden. Dungeon remains one
feature and publishes separate Authored, Editor, and Travel APIs.

## Permanent Boundaries

- `app` MUST compose platform services, feature entry points, and shell
  contributions explicitly and deterministically. It may depend on every
  target root but MUST NOT own feature behavior or long-lived feature state.
- `shell` MUST remain independent from feature implementations. Features may
  use `shell.api` contracts; the shell receives already constructed
  contributions and MUST NOT locate feature services. Shell internals may use
  feature-neutral platform mechanisms; `shell.api` contracts remain free of
  platform implementation types.
- `platform` MUST contain only feature-neutral mechanisms. It MUST NOT import
  `app`, `shell`, or feature code. Its capability packages are
  `platform.execution`, `platform.persistence`, `platform.diagnostics`,
  `platform.state`, and `platform.ui`; new catch-all packages are forbidden.
- A feature MUST expose cross-feature capabilities only from its `api` package.
  Application and composition code may consume foreign APIs; the Dungeon and
  Hex JavaFX adapters may additionally consume the Maps API for their shared
  passive canvases. Other roles MUST NOT import foreign features, and no
  consumer may import another feature's domain, application, adapters, or
  composition entry point.
- Feature API and domain roles MUST remain independent from `platform`.
  Application code may use execution, state, and diagnostics contracts; SQLite
  adapters may use persistence and diagnostics; JavaFX adapters may use UI
  contracts; feature composition may wire any platform capability.
- Feature API calls that can touch persistence or files MUST be non-blocking.
  JavaFX state changes MUST be dispatched explicitly to the UI thread.
- Published feature state MUST be immutable and revisioned. A late asynchronous
  result MUST NOT overwrite newer state.
- Feature SQLite adapters own their stored truth and migration steps. Shared
  connection, integrity, backup, and recovery mechanisms belong to `platform`.
  JDBC and SQLite driver APIs are allowed only in feature SQLite adapters and
  `platform.persistence`.
- Technical diagnostics MUST remain local and MUST NOT record feature payloads,
  secrets, or user-authored content.

Internal Java types have no compatibility obligation while all consumers move
atomically in one green slice. Persisted data and observable behavior retain
their contract and requirement owners.

## Delivery State

Temporary repository state, verification scope, and the next deletion boundary
live only in [Active Delivery](../delivery/README.md). They do not modify this
target.

The target-package ArchUnit rules are mechanically enforced by
`architectureTest` and `check`.

## Rationale

Vertical ownership keeps one behavior change local to its feature. Explicit
composition makes dependencies visible to the compiler. Non-blocking I/O keeps
the JavaFX event thread responsive. Versioned persistence and local diagnostics
make failures recoverable without transmitting user data.

Generic classpath discovery, a shell-owned service locator, horizontal
domain/view/data roots, and package-form compatibility were rejected because
they hide dependencies, fragment ownership, and make safe migration harder.

## References

- [Feature Boundary Standard](patterns/feature-boundaries.md)
- [Application Composition Standard](patterns/application-composition.md)
- [Shell Layer Standard](patterns/shell-layer.md)
- [Styling Standard](patterns/styling.md)
- [Verification Core Architecture](verification-core.md)
- [Documentation Standard](../documentation.md)
