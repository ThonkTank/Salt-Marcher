Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-29
Source of Truth: Complete invariant catalog for the `query/` read-port adapter
role in data features under `src/data/**`.

# Data Query Enforcement

## Goal

This document owns the complete architecture-enforcement catalog for the
`query/` role itself.

It answers four questions for every concrete query adapter under
`src/data/**/query/`:

- when the role MAY exist
- what the role MUST contain
- what the role MUST NOT contain
- which direct communication seams the role MAY use

This document does not own feature-root topology, repository write semantics,
layer-wide shell/view/bootstrap isolation, foreign-feature data boundaries,
gateway-owned source-adapter boundaries, or source-model ownership. Those stay
in the neighboring data enforcement documents.

Unified focused bundle entrypoint:

- `./gradlew checkDataQueryEnforcement --rerun-tasks --console=plain`
  runs the currently active Data Query-focused Error Prone, PMD, build-harness
  topology, and documentation-coverage checks through one root task.
  Canonical compile-side and architecture-aggregate blocking behavior remains
  at `./gradlew compileJava` and `./gradlew checkArchitecture`; the focused
  bundle proof route keeps the query-role checks colocated without pulling the
  broader architecture bundles.
- `./gradlew checkDataQueryPublishedCarrierCandidates --rerun-tasks --console=plain`
  runs the report-only build-harness candidate surface for shared foreign
  published carrier partial-use diagnostics without attaching that surface to
  `checkArchitecture`, `check`, `build`, or staged `production-handoff`.

## Invariant Catalog

### May Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-query-separate-read-adapter-necessity` | Review-Owned | every current `src/data/**/query/` package and every query adapter under it | none | none | A data feature uses `query/` only when it owns a separate read-only lookup, search, paging, or projection adapter need; `query/` is not a generic convenience bucket, a second `repository/`, or a write boundary. |

### Must Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-query-role-contract` | Enforced | every public concrete adapter under `src/data/**/query/` | data-query bundle Error Prone `DataQueryRoleContract` | `./gradlew compileJava` and `./gradlew checkDataQueryEnforcement` | Public concrete query adapters implement matching own-feature read-only domain ports whose names end in `Lookup`, `Catalog`, or `Search`. |

### Must Not Contain

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-query-no-source-mechanics` | Source-Pattern Enforced | every Java type under `src/data/**/query/` | data-query bundle PMD `DataQueryNoSourceMechanicsRule` | `./gradlew checkArchitecture` and `./gradlew checkDataQueryEnforcement` | Query adapters do not reference narrow concrete source APIs directly. |
| `data-query-no-public-non-adapter-boundary-types` | Enforced | every public type under `src/data/**/query/` that is not a public concrete adapter | data-query bundle Error Prone `DataQueryRoleContract` | `./gradlew compileJava` and `./gradlew checkDataQueryEnforcement` | `query/` exposes no public boundary types except public concrete adapter classes. |
| `data-query-read-only-source-shape` | Enforced | every public/protected method declaration or own-feature gateway call under `src/data/**/query/` | data-query bundle PMD `DataQueryReadOnlySourceShapeRule` and data-query bundle Error Prone `DataQueryGatewayMutationBoundary` | `./gradlew compileJava`, `./gradlew checkArchitecture`, and `./gradlew checkDataQueryEnforcement` | Query adapters stay mechanically read-only: they do not expose mutation-shaped public/protected methods and do not call mutation-shaped operations on own-feature gateway types. |
| `data-query-read-only-role-semantics` | Review-Owned | every query adapter under `src/data/**/query/` | none | none | A mechanically legal query adapter still remains a read-only lookup, search, paging, or projection adapter rather than a write boundary, policy helper, or generic data convenience wrapper. |

### Communication Contract

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-query-public-port-surface-only` | Enforced | every public concrete query adapter under `src/data/**/query/` | data-query bundle Error Prone `DataQueryRoleContract` | `./gradlew compileJava` and `./gradlew checkDataQueryEnforcement` | Public/protected query adapter methods, including inherited public/protected superclass methods, are limited to the matching own-feature read-only domain port contracts. |
| `data-query-public-signature-boundary` | Enforced | every public/protected query adapter API | data-query bundle Error Prone `DataQueryPublicSignatureBoundary` | `./gradlew compileJava` and `./gradlew checkDataQueryEnforcement` | Public/protected query adapter signatures, including inherited public/protected superclass methods, do not leak source-local `model/`, `gateway/`, or `persistencecore` types. |
| `data-query-no-foreign-published-reply-channel-roundtrip` | Enforced | every query-adapter path that reaches a foreign domain context | data-query bundle Error Prone `DataQueryForeignPublishedReplyChannelRoundTrip` | `./gradlew compileJava` and `./gradlew checkDataQueryEnforcement` | Query adapters do not use a foreign root `ApplicationService` command plus later same-path foreign `published/*Model.current()` polling as a synchronous reply channel. The blocker is path-sensitive inside one method and same-file inlineable helpers. Cross-context communication stays one-way: command into the foreign context, feedback out only through durable published state changes. |
| `data-query-no-overbroad-foreign-published-payload-surface` | Enforced | every foreign published passive payload carrier that is consumed by query adapters | data-query bundle build-harness `DataQueryForeignPublishedPayloadSurfaceRules` | `./gradlew checkArchitecture` and `./gradlew checkDataQueryEnforcement` | Foreign published passive payload carriers consumed by query adapters do not export accessor surface that no foreign query consumer uses. Shared cross-context payloads stay minimal instead of relaying broader internal-shaped carrier facts. |
| `data-query-gateway-collaborator-boundary` | Enforced | every query adapter dependency into its own feature gateway code | data-query bundle Error Prone `DataQueryGatewayCollaboratorBoundary` | `./gradlew compileJava` and `./gradlew checkDataQueryEnforcement` | Query adapters depend on own-feature source-adapter facade types ending in `Gateway`, not internal source-mechanics collaborators under `gateway/`. |

## Candidate

| Invariant ID | Status | Applies When | Mechanical Owner | Blocking Entrypoint | What It Proves |
| --- | --- | --- | --- | --- | --- |
| `data-query-foreign-published-carrier-thinning-candidate` | Candidate | every query adapter that reads a globally shared foreign passive published carrier through only part of that carrier's globally used accessor surface | none | none | The query adapter may be rebuilding own-feature facts from only a narrow subset of a broader shared foreign published carrier whose full accessor surface is still globally used elsewhere. This is report-only refactor guidance for the foreign published carrier thinning pattern, not a blocker. |

`./gradlew checkDataQueryPublishedCarrierCandidates --console=plain` runs the
report-only build-harness candidate scan backed by the same symbol-resolved
`DataQueryPublishedCarrierAnalysis` engine as the blocker. It reports only
true shared-carrier partial-use cases: the carrier has no globally unused
accessors, but this one consumer still reads only a subset of the carrier's
globally used accessor surface. The findings name the foreign carrier, the
consumer-local accessor subset, the globally used accessor surface, and the
correct target pattern: keep the shared carrier minimal, or split a thinner
foreign published sub-carrier for the narrower consumer slice.

## References

- [Data Layer Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/patterns/data-layer.md:1)
- [Domain Port Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/domain-port-enforcement.md:1)
- [Data Layer Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-layer-enforcement.md:1)
- [Data Gateway Enforcement](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/project/architecture/enforcement/data-gateway-enforcement.md:1)
