Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Role-local enforcement inventory and focused verification
surface for exported `published/**` boundary carriers in `src/domain/**`.

# Domain Published Enforcement

## Goal

Architectural truth for `published/**` lives only in the
[Domain Layer Standard](docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical drift.

It answers four questions for every published boundary carrier:

- when the role MAY contain one published carrier family rather than another
- what the role MUST contain
- what the role MUST NOT contain
- which signatures and communication surfaces the role itself MAY expose

Technical diagnostic route:

- `./gradlew checkDomainEnforcement --rerun-tasks --console=plain`

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-carrier-family-allowlist` | Review-Owned | every `published/**` carrier family | none | none | `published/**` may contain commands, ids, statuses, enums, sealed carrier abstractions, passive public records, and direct same-context `*Model` publication handles. |
| `domain-published-observable-state-handle-necessity` | Review-Owned | every `published/**` carrier family that exposes read-only boundary handles | none | none | Read-only boundary handles are allowed only when a context must expose observable current state without leaking private model internals. `published/*Model` remains the one-way outward feedback seam and must not become a private query/response channel. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-direct-file-placement` | Enforced | every Java type under `src/domain/<context>/published/` | domain-published bundle build-harness `DomainPublishedTopologyRules` | `./gradlew checkDomainEnforcement` | Published boundary carriers are direct files under `published/` rather than nested helper packages. |
| `domain-published-top-level-public-surface` | Enforced | every top-level type under `src/domain/<context>/published/` | domain-published bundle Error Prone `DomainPublishedCarrierShape` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Top-level published carriers are explicitly `public` so `published/**` remains an exported boundary surface rather than a package-private helper bucket. |
| `domain-published-carrier-shape` | Enforced | every public type under `src/domain/<context>/published/` | domain-published bundle Error Prone `DomainPublishedCarrierShape` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Public published carriers stay boundary-shaped: non-`*Model` carriers are records, enums, or sealed abstractions, while `*Model` handles stay narrow outward publication types rather than mutable helper buckets. |
| `domain-published-read-model-handle-shape` | Enforced | every public `src/domain/<context>/published/*Model` type | domain-published bundle Error Prone `DomainPublishedReadModelShape` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Same-context `published/*Model` handles expose public readback only through `current()` and `subscribe(...)`; their public surface does not leak wrapper-style collaborator accessors. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-no-callable-contracts` | Enforced | every Java type under `src/domain/<context>/published/` | domain-published bundle build-harness `DomainPublishedTopologyRules` | `./gradlew checkDomainEnforcement` | `published/` does not contain callable services, facades, repositories, ports, gateways, factories, locators, or policy contracts. |
| `domain-published-nonmodel-passive-only` | Enforced | every public `published/**` type whose simple name does not end with `Model` | domain-published bundle Error Prone `DomainPublishedReadModelShape` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Non-`*Model` published carriers stay passive and do not expose `current()/subscribe()` handle semantics. |
| `domain-published-readback-seam-exclusive` | Enforced | every public domain type under `src/domain/**` | domain-published bundle Error Prone `DomainPublishedReadbackSeamBoundary` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Public `current()` and `subscribe(...)` readback APIs exist only on same-context `published/*Model` handles, so root services, use cases, repositories, ports, helpers, and models cannot create competing readback seams. |
| `domain-published-domain-facts-only` | Review-Owned | every `published/**` carrier family | none | none | Published carriers describe domain facts and boundary language only. Passive non-`*Model` carriers stay minimal shared fact surfaces rather than mirrors of broader internal working state or outer-format convenience shapes. |
| `domain-published-passive-boundary-language` | Review-Owned | every `published/**` carrier family | none | none | Published carriers remain passive boundary language rather than invariant-owning active objects hidden behind otherwise legal shapes. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-public-boundary-signature-purity` | Enforced | every public or protected published boundary signature | domain-published bundle Error Prone `DomainPublishedBoundarySignaturePurity` | `./gradlew compileJava` and `./gradlew checkDomainEnforcement` | Published carriers do not communicate outer-layer, private same-context domain, infrastructure, or foreign `published/**` types through public boundary signatures. |
| `domain-published-read-model-feedback-ownership` | Enforced Elsewhere | every same-context outward feedback path from domain work into external consumers | `domain-applicationservice-public-input-carriers`; `domain-applicationservice-command-no-direct-return`; `domain-usecase-no-same-context-published-dependencies`; `view-layer-no-direct-applicationservice-result-to-viewstate-readback` | `./gradlew compileJava`, `./gradlew checkDomainEnforcement`, `./gradlew checkDomainEnforcement`, and `./gradlew checkViewEnforcement` | Mutation feedback reaches outer consumers through real `published/*Model` state change instead of direct command returns, publisher-shaped domain roots, root readback methods, or imperative reply-channel polling. |

### Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-ubiquitous-language-stability` | Review-Owned | every `published/**` carrier family | none | none | A structurally legal carrier still uses stable ubiquitous language rather than accidental internal naming. |

## References

- [Domain Layer Standard](docs/project/architecture/patterns/domain-layer.md:1)
- [Domain ApplicationService Enforcement](docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain Layer Enforcement](docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
