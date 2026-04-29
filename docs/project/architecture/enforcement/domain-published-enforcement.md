Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete architecture-enforcement catalog for exported
`published/**` boundary carriers in `src/domain/**`.

# Domain Published Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`published/**` role itself.

It answers four questions for every published boundary carrier:

- when the role MAY contain one published carrier family rather than another
- what the role MUST contain
- what the role MUST NOT contain
- which signatures and communication surfaces the role itself MAY expose

This document does not own root `ApplicationService` method shape, use case
internals, or named tactical model-role semantics. Those live in the
neighboring owner docs.

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-observable-state-handle-necessity` | Review-Owned | every `published/**` carrier family that exposes current-state handles, models, or snapshots | none | none | `published/**` may expose commands, queries, results, snapshots, ids, statuses, enums, sealed carrier abstractions, and simple public boundary records. Read-only current-state handles or model-shaped carriers are allowed only when a context must expose observable current state without leaking private model internals. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-direct-file-placement` | Enforced | every Java type under `src/domain/<context>/published/` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | Published boundary carriers are direct files under `published/` rather than nested helper packages. |
| `domain-published-top-level-public-surface` | Enforced | every top-level type under `src/domain/<context>/published/` | Error Prone `DomainPublishedCarrierShape` | `./gradlew compileJava` | Top-level published carriers are explicitly `public` so `published/**` remains an exported boundary surface rather than a package-private helper bucket. |
| `domain-published-carrier-shape` | Enforced | every public type under `src/domain/<context>/published/` | Error Prone `DomainPublishedCarrierShape` | `./gradlew compileJava` | Public published carriers are records, enums, or sealed abstractions rather than mutable helper-shaped containers. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-no-callable-contracts` | Enforced | every Java type under `src/domain/<context>/published/` | build-harness `SourceLayoutRules` | `./gradlew checkArchitecture` | `published/` does not contain callable services, facades, repositories, ports, gateways, factories, locators, or policy contracts. |
| `domain-published-domain-facts-only` | Review-Owned | every `published/**` carrier family | none | none | Published carriers describe domain facts and boundary language only. They do not encode render-layer terms, widget state, canvas cells, storage DTOs, or other outer-format convenience shapes. |
| `domain-published-passive-boundary-language` | Review-Owned | every `published/**` carrier family | none | none | Published carriers remain passive boundary language rather than invariant-owning objects hidden behind otherwise legal record, enum, or sealed shapes. |
| `domain-published-no-foreign-published-signatures` | Enforced | every public or protected published boundary signature | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Published carriers do not expose foreign published carriers in public signatures. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-public-boundary-signature-purity` | Enforced | every public or protected published boundary signature | Error Prone `DomainPublicBoundarySignaturePurity` | `./gradlew compileJava` | Published carriers do not leak outer-layer, private domain, or infrastructure types through their public boundary signatures. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-ubiquitous-language-stability` | Review-Owned | every `published/**` carrier family | none | none | A structurally legal carrier still uses stable ubiquitous language rather than accidental internal naming. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
