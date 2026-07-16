Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Session Generation public API, stored-result schema semantics,
compatibility, migration, validation, and error behavior.

# Session Generation API And Persistence Contract

## Purpose, Owners, And Consumers

`sessiongeneration` owns this feature boundary and its stored generation truth.
Session Planner is the primary API consumer. The Session Generation application
and SQLite adapter are the only writers of generation runs and catalog
snapshots.

This contract does not define the Session Planner flow, generation formulas,
Encounter import behavior, or source architecture; those remain with their
neighboring owners.

## Non-Blocking API

`SessionGenerationApi` exposes two non-blocking typed operations:

- `generate(GenerationRequest) -> GenerationResponse`
- `load(GenerationRunId) -> GenerationResponse`

Both operations complete asynchronously and MUST NOT perform file or SQLite
work on the JavaFX thread.

`GenerationRequest` requires ordered unique `PartyLevelCount` values, exact
decimal `adventureDayFraction`, optional encounter count, and seed. It contains
no JavaFX, SQL, Session Planner persistence, or foreign domain types.

A successful `GenerationResponse` contains exactly one immutable
`GenerationResult`. The result contains run identity, engine and catalog
metadata, seed, session summary, ordered encounter targets and encounters,
treasures, loot items, packing, reward summary, formatted text, and audits.
Failure contains no partial result.

The API publishes typed statuses:

- `SUCCESS`: a stored run was produced or loaded and all hard audits pass
- `NOT_FOUND`: the requested run identity does not exist
- `INVALID_REQUEST`: input validation failed
- `CATALOG_FAILURE`: no complete valid catalog snapshot could be loaded
- `GENERATION_FAILURE`: candidate coverage or another hard generation
  invariant failed
- `STORAGE_FAILURE`: migration, read, or atomic write failed

Messages are display-safe summaries. Adapter exceptions, SQL, file paths,
catalog payloads, and authored session content MUST NOT cross the API.

## Validation

- levels MUST be unique and from 1 through 20
- counts MUST be non-negative and total party count MUST be positive
- adventure-day fraction MUST be an exact non-negative decimal
- explicit encounter count MUST be from 1 through 10
- run IDs, versions, and hashes MUST be non-blank typed values
- success MUST have one result; non-success MUST have none
- all aggregate invariants in the domain owner MUST pass before persistence
- load MUST reconstruct typed values and reject corrupt, orphaned, duplicate,
  unknown-enum, or out-of-order stored rows as `STORAGE_FAILURE`

## Normalized Relational Run Persistence

The persistence-lifecycle owner key is `session-generation`. The immutable
catalog artifact is not duplicated into mutable runtime SQLite tables. Its
manifest and content-hashed TSV files are the canonical catalog owner; each
self-contained run pins the artifact version and catalog-content hash it used.
The catalog-content hash is SHA-256 over the catalog version plus the
canonical filename-sorted inventory of table names, dimensions, and per-file
SHA-256 values. It therefore identifies the shipped artifact independently of
where its source workbook was hosted. `sourceSha256` and `sourceUrl` remain
manifest provenance and MUST NOT be substituted for artifact identity.

The logical SQLite schema is:

- `session_generation_runs`: opaque run ID, engine version, catalog version
  and content hash,
  seed, exact adventure-day fraction, derived session summary, reward summary,
  and formatted output
- `session_generation_party_levels`: normalized request level counts
- `session_generation_encounter_targets`: ordered target detail
- `session_generation_encounters` and
  `session_generation_encounter_blocks`: the selected encounter and its
  ordered selected blocks per target
- `session_generation_treasures`, `session_generation_loot_items`, and
  `session_generation_packing_rows`: generated reward structure
- `session_generation_audits`: ordered typed pass, warning, or failure facts

Every child row has a foreign key to its owning run and an explicit
stable identity plus `sort_order` where ordering affects behavior. Typed
vocabulary is stored as constrained canonical codes. Exact decimals are stored
losslessly as canonical decimal text or scaled integers; money is stored in
copper-piece units. Booleans and optional references use explicit constrained
columns.

Run child primary keys are the run ID plus their generation-local identity.
Selected encounter
blocks, packing rows, and encounter anchors use composite foreign keys to
prevent cross-run references.

The canonical model MUST NOT store a generated run, catalog family, or reward
as JSON, Java serialization, delimiter-packed text, or one opaque payload
column. Human-readable formatted output is an additional derived output, not
the persistence format for structured facts.

The complete encounter candidate search space and its unselected blocks are
transient engine state and MUST NOT be persisted in normalized tables, opaque
payloads, or formatted output. Persistence retains only targets, selected
encounters, their selected blocks, and the candidate-coverage audit outcome.

Catalog artifact identity is `(catalog_version, catalog_content_hash)`. The
resource adapter validates the complete manifest, exact required table
inventory, dimensions, per-file hashes, recomputed catalog-content hash,
closed vocabularies, identities, ordering, and material cross-references before
exposing one immutable snapshot. This includes the decision-type and loot-source
families even though the generator does not publish them directly. Run children
have no update path; the root and all children are inserted once in a single
transaction.

## Migration And Initialization

Feature migrations are contiguous, monotonic, begin at version `1`, and run
through the shared persistence lifecycle under owner key `session-generation`.
Version `1` creates only the normalized immutable-run schema. Catalog loading
is a separate read-only resource boundary and fails closed unless all required
families, identities, enum codes, references, ordering constraints, and hashes
validate.

Later schema or catalog changes add a new migration; they MUST NOT rewrite an
already recorded migration or silently reinterpret stored engine or catalog
versions. A database with a newer feature version fails closed under the shared
persistence lifecycle.

There is deliberately no compatibility contract for PR #478 or any other
proof-of-concept generation schema, file, JSON shape, Java carrier, table name,
or stored run. The canonical migration MUST NOT detect, copy, dual-read,
backfill, or retain those surfaces. Existing canonical SaltMarcher data owned
by other features remains untouched.

## Atomicity And Error Behavior

- catalog artifact validation is all-or-nothing
- run generation happens over one already loaded immutable snapshot
- successful run persistence inserts the root and every child in one
  transaction; failure leaves no visible run root or partial children
- a failed load or write does not replace a previously published successful
  response
- catalog parse, validation, or reference failures surface as
  `CATALOG_FAILURE`
- no candidate coverage or hard audit failure surfaces as
  `GENERATION_FAILURE`, not a partial success
- SQLite readiness, migration, integrity, or operation failures surface as
  `STORAGE_FAILURE`

Technical diagnostics use stable run or catalog identities and failure class
only. They MUST NOT record generated item text, session-authored content,
secrets, raw SQL, or local paths.

## Compatibility And Verification

Internal Java carriers have no compatibility obligation while consumers move
atomically in one green slice. Persisted canonical rows retain their declared
engine and catalog meaning. A changed calculation profile requires a new engine
version; changed reference content requires a new catalog content hash.

This contract is review-owned except for shared lifecycle behavior and package
boundaries already enforced by project gates. Production-route tests must
cover asynchronous completion, typed status mapping, normalized round-trip,
atomic rollback, deterministic reload, migration from an empty canonical
database, and fail-closed newer versions.

## Sources

- Readable catalog and data-contract evidence:
  `/home/aaron/Schreibtisch/projects/references/saltmarcher/session-generation/encounter-loot-generation-design.md`
- Preserved original:
  `/home/aaron/Schreibtisch/projects/references/.tools/markdown/saltmarcher-encounter-loot-generation-design-2026-07-16.md`
- [Shared Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Domain Model](../domain/domain-session-generation.md)
- [Source Architecture](../../project/architecture/source-architecture.md)
