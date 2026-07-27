# Persistence Lifecycle

Status: Active migration contract
Owner: Platform Persistence
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Boundary

SaltMarcher persists installation and Campaign truth in a Godot-native,
versioned file store. This contract owns storage location, immutable commit
publication, validation, recovery, backup, trash, portability, and lifecycle.
Capability owners own their document schemas and semantic validation. UI and
model code never perform file I/O.

SQLite, JDBC, embedded database extensions, and mutable database files are not
part of the target runtime.

## Storage Roots

All writable state lives below `user://salt-marcher/`:

```text
installation/
  registry/generation-<20 digit generation>.json
  shared-definitions/
    generations/generation-<20 digit generation>.json
    objects/<definition id>/<definition checksum>.json
campaigns/<campaign id>/
  manifest.json
  commits/generation-<20 digit generation>.json
  objects/<owner>/<content id>.json
  chunks/<owner>/<content id>.bin
  assets/<asset id>/<original file name>
backups/campaigns/<campaign id>/points/<backup id>.verified.json
backups/campaigns/<campaign id>/blobs/sha256/<content checksum>.blob
recovery/campaigns/<campaign id>/<restore identity>/original/...
trash/campaigns/<campaign id>-<deletion identity>/...
staging/<operation identity>/...
diagnostics/...
```

Paths stored in documents are normalized relative identities. Absolute paths,
parent traversal, device names, links which escape an owned root, and aliases
which collide after target-platform normalization are rejected.

## Immutable Generation Protocol

Every committed document envelope contains a format identifier, an owned
payload, and a SHA-256 checksum of its canonical serialized payload. Generation
numbers are positive, monotonic integers represented losslessly as decimal
strings in JSON and zero-padded in filenames.

A commit follows this order:

1. validate the command against the currently admitted generation;
2. write every new owner document, chunk, and asset under a fresh identity;
3. flush and close each file, validate it by readback, and retain prior files;
4. write the complete next-generation manifest to a fresh pending filename;
5. flush, close, and atomically rename it to its final generation filename;
6. read and validate the published generation before reporting stored success.

Existing generation files and referenced content are never overwritten. A
pending file or unreferenced content is not committed truth. Startup and later
maintenance may remove such orphaned staging data after proving that no
manifest references it.

Every owned write and portability destination is capacity-admitted before file
or staging creation. The working-volume reserve is the greater of 2 GiB or five
percent of total volume capacity. A rejected operation publishes no new truth,
does not consume the reserve, and keeps safe read, export to another destination,
and explicit retry available.

The installation registry applies the same protocol. It selects Campaign
membership, the active pointer, and one immutable Shared-Definition generation.
Creating a Campaign first stages its root and manifest, then commits registry
membership and the initial active pointer in one registry generation. Import
prepares both its independent Campaign and definition generation before one
registry publication makes either visible. A failed registry commit cannot
publish a new registry row or definition generation. Duplicate display names
are valid; stable Campaign identities are unique.

## Campaign Commit Manifest

A Campaign generation names its parent, active runtime/focus state, every
capability partition and format, indexes needed for bounded reads, asset
closure, and the checksum of each referenced unit. Changed units receive new
identities while unchanged units remain referenced. Cross-capability and
reusable-definition references use stable logical identities and are validated
by their owners before commit. Campaign generations store definition identities,
never installation-owned definition copies. Current reads resolve against the
registry-selected definition generation; completed facts are Campaign-owned
snapshots and are not recalculated.

Capability partitions are independently readable and replaceable. Unknown or
disabled partitions remain opaque bytes in the manifest closure and survive
backup, trash, export, import, and compaction.

Large spatial truth is chunked by stable map coordinates. Large reference
collections and histories use bounded immutable segments plus derived indexes;
startup never parses an entire representative or extraordinary Campaign into
one Variant tree.

## Admission And Ordering

There is one installation writer and at most one admitted writer generation per
active Campaign. Commands carry the Campaign activation generation and expected
Campaign generation. Stale work fails before publication. Background results
also carry their input revision and cannot replace newer state.

Campaign switching drains accepted writes, commits the installation active
pointer, publishes the selected Campaign root, and only then acknowledges the
switch. Restart follows the durable pointer. No manual Save action is required.

## Validation And Recovery

Opening a generation verifies its envelope, checksum, format, owner inventory,
references, path safety, required files, and capability validations. Discovery
is read-only. A malformed newest generation is never repaired in place.

Startup scans newest-first and opens the newest uniquely safe generation. It
discloses rejected generations and any unavailable data. If no unique safe
choice exists, the application remains read-only and asks the GM to choose
between named recovery candidates. Damage in one optional partition disables
that capability when the remaining manifest and core survivor journeys remain
safe; damage never silently truncates a document.

Backups are immutable manifest closures created on a schedule and before a
released-format conversion. A backup is successful only after an isolated
restore validates. Retention and compaction preserve at least the active
generation, the newest validated recovery points, recoverable trash, and every
format required by the released compatibility policy.

## Format Policy

Before the first-real-user/data cutover, development formats and data are
disposable. The Godot migration therefore does not convert Java SQLite files.
Current-format restart, recovery, export, and import still require proof.

At first-real-use approval, every installation, Campaign, capability partition,
and export format receives a frozen version. Later conversion stages a complete
new closure, restore-tests the pre-conversion backup, validates the result, and
publishes only the new manifest. Failure leaves prior bytes usable by the prior
compatible application. Recorded versions never change meaning.

## Export, Import, And Trash

Export traverses a validated Campaign manifest closure and writes one bounded,
versioned package containing Campaign truth, resumable state, local assets, and
required shared definitions. It records checksums and rejects source changes
during export.

Import treats every byte and reference as untrusted, enforces declared count
and size limits before allocation, stages only inside its owned directory,
executes nothing, resolves no external path or URI, and never mutates existing
Campaign truth. A successful import creates a new Campaign identity. Shared
definition conflicts remain checksummed, marked staging across restart until
the GM explicitly keeps the existing variant, uses the imported variant, keeps
both under distinct identities, or discards the import. Consequences name every
affected existing Campaign before resolution. One registry generation exposes
the new Campaign and selected Shared-Definition generation together.

The production Campaign desk submits portability work to a single background
worker. File inventory, extraction, and Shared-Definition preparation report
determinate unit progress. Competing create, activate, export, and import actions
remain disabled while work is active. Cancellation at a natural pre-commit
boundary removes unmarked staging and publishes no registry truth; a staged
definition conflict remains explicitly resumable or discardable. Atomic commit
is the linearization boundary, so a later cancellation request reports the
completed outcome.

Campaign deletion atomically removes it from the live registry and publishes
its complete root in recoverable trash. Permanent deletion is a separate,
explicit operation and reports exactly what was removed.

## Current Implementation Boundary

The Godot runtime currently implements the immutable installation Campaign
registry; name-only Campaign creation; owner-partitioned Campaign generations;
atomic runtime-state commits; activation and mutation generation checks;
restart readback; checksum validation; continuation above retained corrupt
generations; recoverable Campaign trash and restoration; explicit confirmed
permanent deletion with a removal report; and a streaming, checksummed
current-format Campaign bundle. Campaign generations now carry reusable
definition identities. The installation store publishes immutable,
content-addressed Shared Definitions through a registry-selected generation.
Export closes over exactly the definitions required by the Campaign. Import
validates declared paths, counts, sizes, byte lengths, checksums, identity,
semantic Campaign state, and definition closure in isolated staging. Missing
definitions join the installation; conflicts survive restart without mutating
truth and support explicit keep-existing, use-imported, retain-both, and
discard paths. Successful resolution atomically selects the definition
generation while registering a new independent Campaign identity.

The production Campaign desk now exposes complete export/import through an
off-main-thread portability controller with progress, cancellation, truthful
failure copy, and one active-operation admission. Its 1366 x 768 transfer docket
and blocking conflict ledger are keyboard-focusable; the ledger displays all
consequences and affected Campaign names before enabling completion.

A Campaign runtime coordinator now prepares a target before committing its
active pointer, revokes the prior synchronous writer, admits exactly one new
activation generation, and rejects late writes from the detached session. The
backup engine creates immutable content-addressed Campaign closures: each point
is a checksummed file inventory, while unchanged bytes are shared by checksum
inside that Campaign's backup pool. A point counts only after isolated
reconstruction and semantic restore validation. Listing revalidates referenced
blob sizes and checksums. Restore requires revoked write authority, publishes
recovery above the replaced live generation, and retains the replaced Campaign
root unchanged. Portable `.saltmarcher` bundles remain the independent
export/import format rather than the rolling-backup representation. A background
scheduler discovers existing Campaigns at startup and queues every confirmed
new generation until the current truth has a restore-tested point; changed truth
becomes due when the prior verified point reaches 60 seconds.

Godot writes now enforce the 2 GiB reserve floor before immutable JSON,
Campaign creation, export, import extraction, and backup publication. When a
platform capacity probe supplies total volume size, the same admission path
enforces the exact five-percent half of the rule. Under backup storage pressure,
maintenance quarantines and removes at most the oldest verified point per
attempt, rolls an interrupted point quarantine back after restart, never touches
rejected or damaged backup evidence, preserves at least three verified points,
garbage-collects only blobs unreferenced by every remaining valid point, and
retries backup publication. Campaign creation itself now stages and validates
its complete root before live promotion and removes it again when registry
publication fails.

Normal maintenance applies configurable time and count retention. The safe
default keeps every verified point for one hour, one point per hour through one
day, one per day through 30 days, and one per week through 26 weeks, with an
absolute 160-point ceiling and a hard floor of three recovery-newest points,
preferring distinct Campaign generations when available. Count limits win when
they intersect a time tier. Every individual removal first
isolates its receipt; a durable tombstone distinguishes committed cleanup from
rollback after a crash. Blob collection still touches only bytes unreferenced by
every remaining valid receipt. The capacity reserve remains the independent
storage-pressure limit.

The explicit Campaign-history compactor requires revoked write authority, an
unchanged expected generation, and a restore-tested point of that exact active
generation. It validates every local commit before planning; any damaged commit
defers the operation unchanged. It keeps at least the newest three valid local
generations and every partition they reference, never traverses assets, trash,
exports, retained restore originals, or backup storage, and removes only older
commit and owner-partition files whose exact size and checksum occur in the
protected backup. Unknown object files also fail closed. Candidates move into a
checksummed quarantine receipt. An interruption before the durable commit marker
rolls the complete set back; one after the marker finishes deletion. Before that
marker is written, the compacted live root is semantically revalidated and
receives its own isolated restore-tested point.

The production cross-platform total-volume-capacity probe, asynchronous
accepted-write drain and automatic active-Campaign compaction scheduling,
asset/chunk compaction, released-format conversion, cross-OS qualification,
representative scale, and the repeated-cancellation resource-envelope proof
remain open roadmap work.
The old Java/SQLite implementation does not satisfy this target contract.

## References

- [Program Capability Requirements](../requirements/requirements-program-capabilities.md)
- [Program Technical Needs](../architecture/program-technical-needs.md)
- [Source Architecture](../architecture/source-architecture.md)
- [Godot Cutover Roadmap](../delivery/roadmap-godot-cutover.md)
