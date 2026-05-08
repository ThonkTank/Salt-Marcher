Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-30
Source of Truth: Role-local enforcement inventory and focused verification
surface for exported `published/**` boundary carriers in `src/domain/**`.

# Domain Published Enforcement

## Goal

Architectural truth for the `published/**` role lives only in the
[Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1).
This document owns only the role-local enforcement inventory, focused
verification surface, and current mechanical drift for that role.

It answers four questions for every published boundary carrier:

- when the role MAY contain one published carrier family rather than another
- what the role MUST contain
- what the role MUST NOT contain
- which signatures and communication surfaces the role itself MAY expose

This document does not own root `ApplicationService` method shape, use case
internals, named tactical model-role semantics, or layer-wide domain
communication boundaries. Those live in the Domain Layer Standard and
neighboring enforcement owners.

Unified focused bundle entrypoint:

- `./gradlew checkDomainPublishedEnforcement --rerun-tasks --console=plain`
  runs the currently active Domain Published-focused build-harness, Error
  Prone, and enforcement-documentation coverage checks through one root task.
  Canonical compile-side blocking behavior remains at `./gradlew compileJava`;
  the focused bundle proof route adds the role-owned topology and
  documentation coverage checks without pulling the broader architecture
  aggregates.

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-carrier-family-allowlist` | Review-Owned | every `published/**` carrier family | none | none | `published/**` may contain commands, results, snapshots, ids, statuses, enums, sealed carrier abstractions, simple public boundary records, and direct read-side `*Model` publication handles. |
| `domain-published-observable-state-handle-necessity` | Review-Owned | every `published/**` carrier family that exposes read-only boundary handles | none | none | Read-only boundary handles are allowed only when a context must expose observable current state without leaking private model internals. `published/*Model` remains the one-way outward feedback seam and must not become a consumer-private answer channel for imperative query/response roundtrips. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-direct-file-placement` | Enforced | every Java type under `src/domain/<context>/published/` | domain-published bundle build-harness `DomainPublishedTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDomainPublishedEnforcement` | Published boundary carriers are direct files under `published/` rather than nested helper packages. |
| `domain-published-top-level-public-surface` | Enforced | every top-level type under `src/domain/<context>/published/` | domain-published bundle Error Prone `DomainPublishedCarrierShape` | `./gradlew compileJava` and `./gradlew checkDomainPublishedEnforcement` | Top-level published carriers are explicitly `public` so `published/**` remains an exported boundary surface rather than a package-private helper bucket. |
| `domain-published-carrier-shape` | Enforced | every public type under `src/domain/<context>/published/` | domain-published bundle Error Prone `DomainPublishedCarrierShape` | `./gradlew compileJava` and `./gradlew checkDomainPublishedEnforcement` | Public published carriers stay boundary-shaped: non-`*Model` carriers are records, enums, or sealed abstractions, while `*Model` handles stay narrow dedicated readback types rather than mutable helper buckets. |
| `domain-published-read-model-handle-shape` | Enforced | every public `src/domain/<context>/published/*Model` type | domain-published bundle Error Prone `DomainPublishedReadModelShape` | `./gradlew compileJava` and `./gradlew checkDomainPublishedEnforcement` | Read-side `published/*Model` handles expose public readback only through `current()` and `subscribe(...)`; their public surface does not leak wrapper-style collaborator accessors. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-no-callable-contracts` | Enforced | every Java type under `src/domain/<context>/published/` | domain-published bundle build-harness `DomainPublishedTopologyRules` | `./gradlew checkArchitecture` and `./gradlew checkDomainPublishedEnforcement` | `published/` does not contain callable services, facades, repositories, ports, gateways, factories, locators, or policy contracts. |
| `domain-published-nonmodel-passive-only` | Enforced | every public `published/**` type whose simple name does not end with `Model` | domain-published bundle Error Prone `DomainPublishedReadModelShape` | `./gradlew compileJava` and `./gradlew checkDomainPublishedEnforcement` | Non-`*Model` published carriers stay passive and do not expose `current()/subscribe()` read-side handle semantics. |
| `domain-published-domain-facts-only` | Review-Owned | every `published/**` carrier family | none | none | Published carriers describe domain facts and boundary language only. Passive non-`*Model` carriers stay minimal shared fact surfaces rather than mirrors of broader internal work or display forms, and they do not encode render-layer terms, widget state, canvas cells, storage DTOs, or other outer-format convenience shapes. |
| `domain-published-passive-boundary-language` | Review-Owned | every `published/**` carrier family | none | none | Published carriers remain passive boundary language rather than invariant-owning objects hidden behind otherwise legal record, enum, or sealed shapes. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-public-boundary-signature-purity` | Enforced | every public or protected published boundary signature | domain-published bundle Error Prone `DomainPublishedBoundarySignaturePurity` | `./gradlew compileJava` and `./gradlew checkDomainPublishedEnforcement` | Published carriers do not communicate outer-layer, private same-context domain, infrastructure, or foreign `published/**` types through public boundary signatures. |
| `domain-published-read-model-feedback-ownership` | Enforced Elsewhere | every same-context outward feedback path from domain work into external consumers | `domain-applicationservice-public-input-carriers`; `domain-applicationservice-command-no-direct-return`; `domain-usecase-no-same-context-published-dependencies`; `view-layer-no-direct-applicationservice-result-to-viewstate-readback`; `data-query-no-foreign-published-reply-channel-roundtrip` | `./gradlew compileJava`, `./gradlew checkDomainApplicationServiceEnforcement`, `./gradlew checkDomainUseCaseEnforcement`, `./gradlew checkViewBinderEnforcement`, and `./gradlew checkDataQueryEnforcement` | Mutation feedback reaches outer consumers only through real read-side published state changes instead of direct command returns, root readback methods, top-level internal workflow publication, or foreign query-adapter reply-channel polling. |

## Review-Owned

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-published-ubiquitous-language-stability` | Review-Owned | every `published/**` carrier family | none | none | A structurally legal carrier still uses stable ubiquitous language rather than accidental internal naming. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
