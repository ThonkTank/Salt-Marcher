# Campaign Registry Persistence Contract

## Purpose And Boundary

The Campaign feature owns the installation-wide registry of stable Campaign
identities and names plus the single durable active-Campaign pointer. The
registry lives in `installation.sqlite`; Campaign-authored truth remains in the
physically separate store for that Campaign. Consumers receive only
`CampaignRegistryApi`, never JDBC, a database path, or another owner's handle.

## Stored Truth

- `campaign_registry_campaigns` stores one non-blank display name for each
  stable Campaign identity. Duplicate display names are valid.
- `campaign_registry_activation` stores at most one pointer and its strictly
  positive activation generation. Its target must exist in the Campaign table.
- Registering a Campaign and committing its first active pointer is one
  transaction. A failed or stale commit cannot leave a new registry row behind.

## Schema Ownership And Validation

The two tables, their columns, primary keys, checks, foreign key, automatic
SQLite indexes, and the complete persistent `campaign_registry_*` object
inventory form one exact schema. Readiness compares that target to a separately
derived SQLite reference schema without mutating the installation store.
Malformed or adjacent owner objects make the registry unavailable; they are
not repaired, dropped, or ignored.

## Compatibility And Initialization

Compatibility obligations begin with the first released format.
Before the first released format, the Campaign registry has one disposable current format:
owner version `1`. Its single initializer requires an empty
`campaign_registry_*` namespace and creates the complete current target
directly. An unversioned partial namespace and a malformed recorded version `1`
fail without schema, row, or ledger mutation. A recorded version above `1`
fails as newer without downgrade.

Until activation there is no predecessor conversion, compatibility reader,
backfill, or repair path. After activation, future format changes are governed
by project `TN-18` and `TN-19` and must introduce explicit qualified
preservation behavior rather than changing the meaning of version `1`.

## Error And Consistency Behavior

Registry operations fail through Campaign result statuses and do not expose
SQLite exceptions. Pointer compare-and-set uses the expected generation; a
stale generation returns current durable activation truth. Shutdown rejects
new work and prevents an accepted mutation from committing after terminal
revocation.

## References

- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)

- [Source Architecture](../../project/architecture/source-architecture.md)
- [Program Capability Requirements](../../project/requirements/requirements-program-capabilities.md)
