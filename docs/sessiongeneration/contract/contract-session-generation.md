# Session Generation API And Persistence Contract

Status: Active contract with implemented Godot version-1 owner format
Owner: Session Generation
Last Reviewed: 2026-07-28
Source of Truth: This document

## Owner And Consumers

Session Generation owns this boundary and all stored generation-run truth.
Session Planner is the primary consumer. Only Session Generation writes its
normalized run schema. Encounter consumes encounter intents only through the
Session Planner preparation workflow and never writes generation storage.

## Non-Blocking Godot Boundary

The native feature exposes the following semantic operations through pure
policies, one bounded preparation coordinator, and the admitted Campaign
writer:

```text
draft(GenerationRequest) -> GenerationDraftResponse
commit(CommitGenerationRunCommand) -> GenerationRunResponse
load(GenerationRunId) -> GenerationRunResponse
loadRewards(GenerationRewardBatchQuery) -> GenerationRewardBatchResponse
```

Drafting and foreign snapshot work run off the scene-tree thread. Campaign
publication is ticketed through the serial runtime writer. No Godot path opens
SQLite, JDBC, JavaFX, or the legacy owner.

`GenerationRequest` contains one opaque preparation identity, ordered unique
party-level counts, exact adventure-day fraction, optional encounter count, and
seed. It contains no SQL, JavaFX, Session Planner persistence, or foreign
domain carriers.

A successful draft response contains one complete structured
`GeneratedRunDraft` with stable run identity and normalized content
fingerprint. Commit accepts that draft, validates it again, and returns its
durable identity. Load returns the immutable structured run. Batch reward reads
accept unique run-and-treasure identities and preserve request order.

Public statuses distinguish success, invalid request, not found, catalog
failure, generation failure, identity conflict, and storage failure. A
non-success result contains no partial draft, run, or reward list.

## Draft Identity And Commit

Run identity is assigned only after a complete draft passes hard audits and is
stable for preparation identity, engine version, and catalog content hash. The
content fingerprint covers normalized inputs and every semantic persisted
child in stable order. It excludes creation time and optional formatted text.

Commit is idempotent:

- a new identity and valid draft insert the root and every child once
- an existing identity with the same fingerprint and reconstructed semantic
  value returns success without rewriting rows
- an existing identity with different content returns `IDENTITY_CONFLICT`
- no consumer must load the just-committed run to continue the same workflow

## Structured File Persistence

The Campaign partition owner key is `session_generation`; its only current
payload format is `saltmarcher.session-generation-runs.v1`. The partition is a
checksummed immutable Campaign object selected by a later Campaign commit.
Semantic validation remains on typed owner read/write paths and fails closed.

The logical schema stores:

- run identity, content fingerprint, engine version, catalog version and
  content hash, seed, exact adventure-day fraction, session summary, reward
  summary, and optional formatted output
- normalized party-level counts
- ordered encounter targets, encounters, and selected role/CR blocks
- ordered treasures, concrete loot item lines, and packing rows
- ordered typed warnings and audits

Every child uses the run identity plus generation-local identity and explicit
array order where order affects behavior. Exact fractions and capacities use
fixed-point integer units; money uses copper-piece units; enums use constrained
canonical codes. Owner validation prevents cross-run anchors and packing
references.

The payload MUST NOT store Java serialization, delimiter-packed facts, copied
catalog families, unselected candidate search space, or formatted text as the
only representation of structured facts. JSON is the explicit typed native
file representation, not an opaque aggregate hidden behind another schema.

One run and all children enter one owner-partition candidate. A Campaign commit
publishes that candidate atomically; a failure leaves no visible partial root.
Load reconstructs normalized typed values and fails on corrupt, orphaned,
duplicate, fingerprint-mismatched, or out-of-order content.

## Catalog Boundary

The shipped catalog remains a read-only versioned artifact. Its content hash is
SHA-256 over catalog version plus the canonical filename-sorted inventory,
dimensions, and per-file hashes. Resource validation is all-or-nothing and
includes required families, identities, vocabularies, ordering, and
cross-references before one immutable snapshot is cached.

Runs pin catalog version and content hash. Source URL and source-file hash are
provenance and do not replace runtime artifact identity.

## Precompletion Format Lifecycle

Before full feature completion there is no released Session Generation data to
preserve. The first write creates the complete version-1 partition directly
from the exact empty payload. There are no native predecessor formats and no
`session_generation_*` tables.

Every current run stores a non-null content fingerprint. Reads validate that
fingerprint against reconstructed typed rows; no predecessor row without the
fingerprint is accepted and no fingerprint is derived as a compatibility
fallback.

Unversioned, partial, predecessor, structurally damaged, adjacent-owner, and
newer shapes fail closed unchanged. Startup performs no repair, backfill,
legacy read, dual write, or version claim. Precompletion Java/SQLite shapes are
discarded rather than imported into this first native format.

## Diagnostics And Errors

Diagnostics may record operation, stable run or catalog identity, stage,
duration, cardinality, and failure class. They exclude generated item text,
authored session content, SQL, exception payloads, secrets, and local paths.
Public messages are display-safe.


## Sources

- [Shared Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Domain](../domain/domain-session-generation.md)
- [Source Architecture](../../project/architecture/source-architecture.md)
