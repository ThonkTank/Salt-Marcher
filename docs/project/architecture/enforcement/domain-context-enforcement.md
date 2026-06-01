Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-05-08
Source of Truth: Complete architecture-enforcement catalog for domain context
documents and the canonical context-role and context-relationship maps in the
Domain Layer Standard.

# Domain Context Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for active
domain-context contracts in `src/domain/**/DOMAIN.md` and for the semantic
context map in
`docs/project/architecture/patterns/domain-layer.md`.

It answers four questions for every active domain context:

- which context documents and markers MUST exist
- what each context contract MUST contain
- what each context contract MUST NOT claim
- which public communication statements the canonical context map MUST carry

This document does not own code-level role contracts for family
`*ApplicationService`, `UseCase`, `published/`, `Port`, `Repository`, or
subordinate model/helper types. It also does not own build-gated cross-context
type legality. Those live in the neighboring role-specific owner docs.

## Invariant Catalog

### Must Exist

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-context-document-presence` | Enforced | every active domain context under `src/domain/**` | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | Every active domain context has a `DOMAIN.md` contract document. |
| `domain-context-name-marker` | Enforced | every `src/domain/<context>/DOMAIN.md` | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | Each context document declares exactly one `Context Name: <PascalContext>` marker. |
| `domain-context-role-marker` | Enforced | every `src/domain/<context>/DOMAIN.md` | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | Each context document declares exactly one allowed `Context Role: ...` marker. |
| `domain-context-standard-role-coverage` | Enforced | the `## Context Roles` section in the Domain Layer Standard | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | The canonical context-role map lists every active domain context exactly once and does not keep stale context bullets. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-context-base-sections` | Enforced | every `src/domain/<context>/DOMAIN.md` | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | Every context document includes non-empty `Context Role`, `Published Language`, `Application Boundary`, and `Ubiquitous Language` sections. |
| `domain-context-application-service-marker` | Enforced | every `src/domain/<context>/DOMAIN.md` | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | Every context document declares at least one `Application Service: <TypeName>` marker inside `## Application Boundary`. |
| `domain-context-authored-truth-required-sections` | Enforced | every context whose `Context Role:` owns authored truth | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | Authored-truth contexts include non-empty `Aggregate Model`, `Commands And Invariants`, and `Consistency Model` sections. |
| `domain-context-aggregate-root-marker-shape` | Enforced | every context whose `Context Role:` owns authored truth | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | Authored-truth contexts declare at least one `Aggregate Root: <TypeName>` marker that resolves to an owned internal model type in canonical `model/<family>/model/**` topology or, while legacy topology remains, to an older named-module role type. |
| `domain-context-generation-policy-required-sections` | Enforced | every `Generation Policy Context` | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | Generation-policy contexts include non-empty `Commands And Invariants` and `Consistency Model` sections. |
| `domain-context-generation-policy-ephemeral-rationale` | Enforced | every `Generation Policy Context` | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | Generation-policy contexts include a non-empty `Ephemeral Policy Rationale` section. |
| `domain-context-party-owned-truth` | Review-Owned | the `party` bullet in `## Context Roles` and the matching `src/domain/party/DOMAIN.md` contract | none | none | The `Party Character State Context` contract explicitly owns roster truth, membership, XP progression, rest cadence, adventuring-day policy, and character-specific runtime travel state. |
| `domain-context-creatures-owned-reference-scope` | Review-Owned | the `creatures` bullet in `## Context Roles` and the matching `src/domain/creatures/DOMAIN.md` contract | none | none | The `creatures` reference-catalog contract explicitly scopes itself to imported creature catalog lookup language and encounter-candidate reference profiles. |
| `domain-context-encounter-owned-roster-truth` | Review-Owned | the `encounter` bullet in `## Context Roles` and the matching `src/domain/encounter/DOMAIN.md` contract | none | none | The `encounter` roster-truth contract explicitly owns saved encounter-plan roster truth and keeps encounter-generation policy inside the encounter context. |
| `domain-context-encountertable-owned-reference-scope` | Review-Owned | the `encountertable` bullet in `## Context Roles` and the matching `src/domain/encountertable/DOMAIN.md` contract | none | none | The `encountertable` reference-catalog contract explicitly scopes itself to authored encounter-table membership as read-only reference-catalog truth. |
| `domain-context-dungeon-owned-world-space-truth` | Review-Owned | the `dungeon` bullet in `## Context Roles` and the matching `src/domain/dungeon/DOMAIN.md` contract | none | none | The `dungeon` authored world-space contract explicitly owns core dungeon truth, map topology, rooms or spaces, connections, stable identity, and map mutation rules while keeping editor and travel runtime state outside authored persistence. |
| `domain-context-sessionplanner-owned-session-record-truth` | Review-Owned | the `sessionplanner` bullet in `## Context Roles` and the matching `src/domain/sessionplanner/DOMAIN.md` contract | none | none | The `sessionplanner` roster-truth contract explicitly owns one persisted session plan for participant references, encounter allocations, rest placement, placeholders, and selected-encounter state. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-context-authored-truth-write-model-required` | Enforced | every context whose `Context Role:` owns authored truth | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | Authored-truth contexts do not declare `Write Model: None`. |
| `domain-context-generation-policy-write-model-none` | Enforced | every `Generation Policy Context` | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | Generation-policy contexts explicitly declare `Write Model: None` instead of smuggling in a persistent authored write model. |
| `domain-context-creatures-no-encounter-or-lifecycle-truth` | Review-Owned | the `creatures` bullet in `## Context Roles` and the matching `src/domain/creatures/DOMAIN.md` contract | none | none | The `creatures` reference-catalog contract does not claim encounter ranking, encounter choice, or creature lifecycle truth. |
| `domain-context-encounter-no-foreign-truth-ownership` | Review-Owned | the `encounter` bullet in `## Context Roles` and the matching `src/domain/encounter/DOMAIN.md` contract | none | none | The `encounter` roster-truth contract does not claim party truth, creature truth, or encounter-table membership truth. |
| `domain-context-encountertable-no-creature-or-generation-policy-truth` | Review-Owned | the `encountertable` bullet in `## Context Roles` and the matching `src/domain/encountertable/DOMAIN.md` contract | none | none | The `encountertable` reference-catalog contract does not claim creature truth, table mutation policy, or encounter-generation policy. |
| `domain-context-sessionplanner-no-foreign-truth-ownership` | Review-Owned | the `sessionplanner` bullet in `## Context Roles` and the matching `src/domain/sessionplanner/DOMAIN.md` contract | none | none | The `sessionplanner` roster-truth contract does not claim party membership truth, encounter rosters, creature detail, or loot-object internals as session-owned persistence. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Diagnostic/Mechanical Route | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `domain-context-standard-relationship-coverage` | Enforced | the `## Context Relationships` section in the Domain Layer Standard | `domain-context-enforcement` bundle `DomainContextDocumentationRules` | `./gradlew checkDomainEnforcement` | The canonical context-relationship map lists every active context exactly once, keeps role markers aligned, and does not keep stale relationship bullets. |
| `domain-context-party-publishes-downstream-facts` | Review-Owned | the `party` bullet in `## Context Relationships` and the matching `src/domain/party/DOMAIN.md` contract | none | none | The `party` context documents its public communication as publishing roster, membership, XP, rest-cadence, adventuring-day, and character-travel facts to downstream contexts. |
| `domain-context-creatures-publishes-policy-input-facts` | Review-Owned | the `creatures` bullet in `## Context Relationships` and the matching `src/domain/creatures/DOMAIN.md` contract | none | none | The `creatures` context documents its public communication as publishing imported creature catalog lookup facts and encounter-candidate reference profiles to downstream policy contexts. |
| `domain-context-encounter-consumes-foreign-public-boundaries` | Review-Owned | the `encounter` bullet in `## Context Relationships` and the matching `src/domain/encounter/DOMAIN.md` contract | none | none | The `encounter` context documents its foreign communication as using own repositories to trigger allowed `party`, `creatures`, and `encountertable` workflows and own ports to react to their published state. |
| `domain-context-encountertable-data-adapter-ingest-and-public-export` | Review-Owned | the `encountertable` bullet in `## Context Relationships` and the matching `src/domain/encountertable/DOMAIN.md` contract | none | none | The `encountertable` context documents its non-domain ingest as creature persistence snapshots through its data source adapter and its public export as table summaries and weighted candidate rows through its root application service. |
| `domain-context-dungeon-consumes-party-travel-position` | Review-Owned | the `dungeon` bullet in `## Context Relationships` and the matching `src/domain/dungeon/DOMAIN.md` contract | none | none | The `dungeon` context documents authored truth independently of `party`, `creatures`, and `encounter`; party-owned travel-position facts reach dungeon runtime travel only through dungeon-owned ports over party published state. |
| `domain-context-sessionplanner-consumes-party-and-encounter-public-boundaries` | Review-Owned | the `sessionplanner` bullet in `## Context Relationships` and the matching `src/domain/sessionplanner/DOMAIN.md` contract | none | none | The `sessionplanner` context documents its foreign communication as using own repositories to trigger allowed `party` and `encounter` workflows and own ports to react to their published state while keeping authored session truth local to sessionplanner. |

## References

- [Domain Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/domain-layer.md:1)
- [Domain Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-layer-enforcement.md:1)
- [Domain ApplicationService Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-application-service-enforcement.md:1)
- [Domain UseCase Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-use-case-enforcement.md:1)
- [Domain Published Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-published-enforcement.md:1)
