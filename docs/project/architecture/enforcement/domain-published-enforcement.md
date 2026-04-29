Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for exported
`published/**` boundary carriers in `src/domain/**`.

# Domain Published Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`published/**` role itself.

It answers three questions for every published boundary carrier:

- what the role MUST contain
- what the role MUST NOT contain
- which signatures and communication surfaces the role itself MAY expose

This document does not own root `ApplicationService` method shape, use case
internals, or named tactical model-role semantics. Those live in the
neighboring owner docs.

## Invariant Catalog

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-direct-file-placement` | Enforced | every Java type under `src/domain/<context>/published/` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Published boundary carriers are direct files under `published/` rather than nested helper packages. |
| `domain-published-carrier-shape` | Enforced | every public type under `src/domain/<context>/published/` | Error Prone `DomainPublishedCarrierShape` | `./gradlew compileJava` | Public published carriers are records, enums, or sealed abstractions rather than mutable helper-shaped containers. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-no-callable-contracts` | Enforced | every Java type under `src/domain/<context>/published/` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | `published/` does not contain callable services, facades, repositories, ports, gateways, factories, locators, or policy contracts. |
| `domain-published-no-foreign-published-signatures` | Enforced | every public or protected published boundary signature | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Published carriers do not expose foreign published carriers in public signatures. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-public-boundary-signature-purity` | Enforced | every public or protected published boundary signature | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Published carriers do not leak outer-layer, private domain, or infrastructure types through their public boundary signatures. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-ubiquitous-language-stability` | Review-Owned | every `published/**` carrier family | none | none | A structurally legal carrier still uses stable ubiquitous language rather than accidental internal naming. |
| `domain-published-passive-boundary-language` | Review-Owned | every `published/**` carrier family | none | none | Published carriers remain passive boundary language rather than invariant-owning objects hidden behind legal record, enum, or sealed shapes. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
