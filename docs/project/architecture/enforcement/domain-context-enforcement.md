Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for domain context
documents and the canonical context map described by the Domain Layer Standard.

# Domain Context Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for domain
context documentation and for the context-level public-boundary map in
`docs/project/architecture/patterns/domain-layer.md`.

It answers three questions for every active domain context:

- which context documents and markers MUST exist
- which documented context shapes MUST be present for each role family
- which context-to-context public-boundary statements are mechanically covered

This document does not own the code-level role contracts of `ApplicationService`,
`UseCase`, `published/`, `port/`, or tactical domain types. Those live in the
neighboring role-specific owner docs.

## Invariant Catalog

### Must Exist

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-context-document-presence` | Enforced | every active domain context under `src/domain/**` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Every active domain context has a `DOMAIN.md` contract document. |
| `domain-context-name-marker` | Enforced | every `src/domain/<context>/DOMAIN.md` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Each context document declares exactly one `Context Name: <PascalContext>` marker. |
| `domain-context-role-marker` | Enforced | every `src/domain/<context>/DOMAIN.md` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Each context document declares exactly one allowed `Context Role: ...` marker. |
| `domain-context-standard-role-coverage` | Enforced | the `## Context Roles` section in the Domain Layer Standard | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | The canonical context-role map lists every active domain context exactly once and does not keep stale context bullets. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-context-base-sections` | Enforced | every `src/domain/<context>/DOMAIN.md` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Every context document includes non-empty `Context Role`, `Published Language`, `Application Boundary`, and `Ubiquitous Language` sections. |
| `domain-context-authored-truth-required-sections` | Enforced | every context whose `Context Role:` owns authored truth | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Authored-truth contexts include non-empty `Aggregate Model`, `Commands And Invariants`, and `Consistency Model` sections. |
| `domain-context-authored-truth-write-model-required` | Enforced | every context whose `Context Role:` owns authored truth | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Authored-truth contexts do not declare `Write Model: None`. |
| `domain-context-aggregate-root-marker-shape` | Enforced | every context whose `Context Role:` owns authored truth | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Authored-truth contexts declare at least one `Aggregate Root: <TypeName>` marker that resolves to a named-module tactical-role type. |
| `domain-context-generation-policy-required-sections` | Enforced | every `Generation Policy Context` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Generation-policy contexts include non-empty `Commands And Invariants` and `Consistency Model` sections. |
| `domain-context-generation-policy-write-model-none` | Enforced | every `Generation Policy Context` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Generation-policy contexts explicitly declare `Write Model: None`. |
| `domain-context-generation-policy-ephemeral-rationale` | Enforced | every `Generation Policy Context` | build-harness `DomainFeatureRules` | `./gradlew checkArchitecture` | Generation-policy contexts include a non-empty `Ephemeral Policy Rationale` section. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-context-standard-relationship-coverage` | Enforced | the `## Context Relationships` section in the Domain Layer Standard | build-harness `DomainFeatureRules` and ArchUnit `domainFeaturesMustOnlyUseForeignFeatureApis` | `./gradlew checkArchitecture` | The canonical context-relationship map lists every active context exactly once, keeps role markers aligned, and is paired with a build gate that restricts foreign context access to public boundaries only. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-context-relationship-prose-accuracy` | Review-Owned | every relationship bullet in the Domain Layer Standard | none | none | The documented prose still describes real ownership and collaboration rather than merely passing the mechanical marker and stale-context checks. |
| `domain-context-foreign-service-documentation` | Review-Owned | any context that injects a foreign root `*ApplicationService` | none | none | A legal foreign root dependency is still semantically documented by the owning context relationship prose rather than only type-compatible. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
