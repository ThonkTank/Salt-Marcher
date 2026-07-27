# Persistence Lifecycle

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
  definitions/...
campaigns/<campaign id>/
  manifest.json
  commits/generation-<20 digit generation>.json
  objects/<owner>/<content id>.json
  chunks/<owner>/<content id>.bin
  assets/<asset id>/<original file name>
backups/campaigns/<campaign id>/<backup id>.saltmarcher
backups/campaigns/<campaign id>/<backup id>.verified.json
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

The installation registry applies the same protocol. Creating a Campaign first
stages its root and manifest, then commits registry membership and the initial
active pointer in one registry generation. A failed registry commit cannot
publish a new registry row. Duplicate display names are valid; stable Campaign
identities are unique.

## Campaign Commit Manifest

A Campaign generation names its parent, active runtime/focus state, every
capability partition and format, indexes needed for bounded reads, asset
closure, and the checksum of each referenced unit. Changed units receive new
identities while unchanged units remain referenced. Cross-capability references
use stable logical identities and are validated by their owners before commit.

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
definition conflicts remain staged until the GM explicitly resolves them.

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
current-format Campaign bundle. Import validates declared paths, counts, sizes,
byte lengths, checksums, identity, and semantic Campaign state in isolated
staging, then creates a new independent Campaign identity.

A Campaign runtime coordinator now prepares a target before committing its
active pointer, revokes the prior synchronous writer, admits exactly one new
activation generation, and rejects late writes from the detached session. The
backup engine creates immutable full-Campaign bundles, counts them only after
an isolated restore validation, verifies durable receipt checksums when listing,
requires revoked write authority for restore, publishes recovery above the
replaced live generation, and retains the replaced Campaign root unchanged. A
background scheduler discovers existing Campaigns at startup and queues every
confirmed new generation until the current truth has a restore-tested point;
changed truth becomes due when the prior verified point reaches 60 seconds.

Backup retention and storage-pressure policy, asynchronous accepted-write
drain, shared-definition conflict staging, cancellable/progress-reporting
portability work, compaction, released-format conversion, cross-OS
qualification, and representative scale proof remain open roadmap work. The
old Java/SQLite implementation does not satisfy this target contract.

## References

- [Program Capability Requirements](../requirements/requirements-program-capabilities.md)
- [Program Technical Needs](../architecture/program-technical-needs.md)
- [Source Architecture](../architecture/source-architecture.md)
- [Godot Cutover Roadmap](../delivery/roadmap-godot-cutover.md)
