# ADR 016: Architecture Enforcement Operating Model

- Status: Accepted
- Date: 2026-04-19

## Context

SaltMarcher's architecture checks now cover source policy, compiler-resolved
signatures, bytecode dependencies, graph topology, repository topology, and
Gradle-owned resource policy.

ADR 003 and ADR 006 assigned those rule shapes to the right engines, but the
implementation surface was still harder to change than the owner model implied:
the build harness carried many unrelated repository rules in one class, and
the Gradle quality convention mixed invocation policy, tool installation,
architecture gates, metrics gates, and resource-policy wiring in one long
procedural flow.

External Gradle references were mirrored locally before this decision under
`/home/aaron/Schreibtisch/projects/references/build-tooling/`. They support keeping stable public
entrypoints while moving implementation detail into reusable convention and
task logic.

## Decision

SaltMarcher keeps the existing multi-engine architecture enforcement model and
improves its internal operating structure.

- Public Gradle gate names remain stable: `compileJava`, `architectureTest`,
  `pmdArchitectureMain`, `checkViewArchitecture`, `checkArchitecture`,
  `check`, and `build`.
- New architecture rules must first be classified by rule shape, then added to
  the owning engine named by the architecture harness standard.
- `build-harness` rules are organized behind a small internal rule API:
  `ArchitectureRule`, `ArchitectureContext`, and `ViolationSink`.
- `ArchitectureChecker` is the orchestrator. Concrete repository-topology,
  source-layout, domain-document, shell-surface, and persistence-topology rules
  live in separate rule-group classes.
- The Gradle quality convention remains a precompiled convention plugin, but
  its implementation is organized by policy area: invocation policy, shared
  inputs, tool configurations, compiler gates, jQAssistant graph analysis,
  quality metrics, architecture aggregates, resource policy, and the central
  `check` aggregate.

## Consequences

- The architecture harness remains locally reproducible and keeps the same
  failure surface for developers.
- New repository-topology rules no longer need to extend a single large
  checker class.
- The project avoids adding Semgrep, Checkstyle, OpenRewrite, JPMS, or a
  Gradle module split just to improve maintainability.
- Fixture-based harness selftests remain forbidden. Build-harness validation is
  still verified through the normal local quality gates and targeted manual
  negative probes when needed.

## Alternatives Considered

### Consolidate all architecture checks into one engine

Rejected because no single current engine fits every SaltMarcher rule shape.
jQAssistant is strong for graph topology, ArchUnit for bytecode dependencies,
Error Prone for compiler-resolved signatures, PMD for source policy, and the
build harness for file-tree and documentation-marker topology.

### Move to Gradle subprojects or JPMS modules

Rejected for this change because it would alter application packaging and
repository architecture rather than simply making the accepted check model
easier to extend.

### Add a new generic rule engine

Rejected because the existing accepted engines already cover the current rule
shapes, and another platform would increase operational surface without
removing the need for the existing compiler, bytecode, graph, and topology
checks.

## Related Documents

- [Architecture Enforcement Harness Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-harness.md:1)
- [Architecture Enforcement Coverage Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/architecture-enforcement-coverage.md:1)
- [Quality Platforms Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/verification/quality-platforms.md:1)
- [ADR 003: Architecture Rule Ownership By Enforcement Layer](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-003-architecture-rule-ownership.md:1)
- [ADR 006: Layered View-Architecture Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/adr-006-jqassistant-owns-view-architecture-enforcement.md:1)
