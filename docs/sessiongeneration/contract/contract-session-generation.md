Status: Active Target
Owner: Session Generation Feature
Last Reviewed: 2026-07-18
Source of Truth: Session Generation API, persistence, compatibility, and error
semantics.

# Session Generation API And Persistence Contract

## Owner And Consumers

Session Generation owns this boundary and all stored generation-run truth.
Session Planner is the primary consumer. Only Session Generation writes its
normalized run schema. Encounter consumes encounter intents only through the
Session Planner preparation workflow and never writes generation storage.

## Non-Blocking API

`SessionGenerationApi` exposes:

```text
draft(GenerationRequest) -> GenerationDraftResponse
commit(CommitGenerationRunCommand) -> GenerationRunResponse
load(GenerationRunId) -> GenerationRunResponse
loadRewards(GenerationRewardBatchQuery) -> GenerationRewardBatchResponse
```

Every operation completes asynchronously and performs no file or SQLite work
on the JavaFX thread.

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

## Normalized Persistence

The persistence lifecycle owner key remains `session-generation`. The logical
schema stores:

- run identity, content fingerprint, engine version, catalog version and
  content hash, seed, exact adventure-day fraction, session summary, reward
  summary, and optional formatted output
- normalized party-level counts
- ordered encounter targets, encounters, and selected role/CR blocks
- ordered treasures, concrete loot item lines, and packing rows
- ordered typed warnings and audits

Every child uses the run identity plus generation-local identity and explicit
ordering where order affects behavior. Exact decimals are lossless; money uses
copper-piece units; enums use constrained canonical codes. Composite foreign
keys prevent cross-run anchors and packing references.

The schema MUST NOT store JSON aggregates, Java serialization, delimiter-packed
records, copied catalog families, unselected candidate search space, or
formatted text as the only representation of structured facts.

One run and all children insert in one transaction. A failure leaves no visible
partial root. Load reconstructs typed values and fails on corrupt, orphaned,
duplicate, unknown-enum, fingerprint-mismatched, or out-of-order rows.

## Catalog Boundary

The shipped catalog remains a read-only versioned artifact. Its content hash is
SHA-256 over catalog version plus the canonical filename-sorted inventory,
dimensions, and per-file hashes. Resource validation is all-or-nothing and
includes required families, identities, vocabularies, ordering, and
cross-references before one immutable snapshot is cached.

Runs pin catalog version and content hash. Source URL and source-file hash are
provenance and do not replace runtime artifact identity.

## Compatibility And Migration

Migrations remain contiguous and monotonic under the existing owner key. An
applied migration is never rewritten. A newer database version fails closed.

Existing canonical runs remain loadable with their recorded engine and catalog
meaning. Canonical migrations may add content fingerprints and indexes but MUST
NOT reinterpret existing rows. When a canonical run lacks a stored fingerprint,
the adapter derives it from its validated typed rows for comparison without
rewriting the run.

Unadopted proof-of-concept schemas, files, JSON shapes, Java carriers, and
tables have no compatibility status and are never accepted as canonical input.
Only the normalized contract in this document and canonical migrations under
the `session-generation` owner key are durable.

## Diagnostics And Errors

Diagnostics may record operation, stable run or catalog identity, stage,
duration, cardinality, and failure class. They exclude generated item text,
authored session content, SQL, exception payloads, secrets, and local paths.
Public messages are display-safe.

## Verification Ownership

Production-route proof covers async completion, deterministic draft equality,
idempotent and conflicting commit, normalized round-trip, atomic rollback,
batch reward ordering, catalog failure, empty canonical migration, and load of
existing canonical runs. Architecture enforcement owns the absence of JavaFX,
foreign implementation imports, and opaque aggregate storage.

## Sources

- Readable catalog and data-contract evidence:
  `/home/aaron/Schreibtisch/projects/references/saltmarcher/session-generation/encounter-loot-generation-design.md`
- Preserved original:
  `/home/aaron/Schreibtisch/projects/references/.tools/markdown/saltmarcher-encounter-loot-generation-design-2026-07-16.md`
- [Shared Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Domain](../domain/domain-session-generation.md)
- [Source Architecture](../../project/architecture/source-architecture.md)
