# ADR 0003: Archive incompatible Loot receipts during schema migration

## Status

Accepted on 2026-08-17.

## Context

Campaign schema 30 stored Loot operation receipts whose result envelopes copied
item names, values, magic metadata, and other facts. Schema 31 replaced those
copies with canonical `ItemReference` values. Replaying an old receipt as a
current result would therefore violate the current contract and could expose a
result different from the migrated aggregate.

Deleting the receipt rows would remove useful idempotency and diagnostic
evidence without being necessary for the migration.

## Decision

The named `campaign-30-to-31-canonical-item-references` migration renames the
complete legacy table to `loot_operation_receipt_v30_archive`. It does not
interpret, replay, or delete those rows. Current schema initialization then
creates a new `loot_operation_receipt` table with the versioned result envelope
required by schema 31 and later.

Archived rows are historical evidence only. They cannot authorize a retry or
be returned through the current capability contract. A future incompatible
receipt migration must likewise choose and test one explicit path: lossless
upcast, typed rejection with retained rows, or an archive table whose version
is present in its name.

## Consequences

- Migrated campaigns retain every pre-schema-31 receipt byte for diagnosis.
- Current commands cannot confuse an incompatible old receipt with a current
  idempotency result.
- The schema-30 fixture verifies both canonical item readback and preservation
  of the archived receipt identity.
