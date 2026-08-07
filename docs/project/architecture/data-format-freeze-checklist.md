# Data format freeze checklist

Status: required before the first release that promises persistence of user
data. Until this checklist is signed off, development schema resets remain
allowed and are not migrations.

## Freeze prerequisites

- [ ] Product owners approve the persisted aggregates, identifiers, ordering
      rules, nullability and canonicalization rules.
- [ ] `PRAGMA user_version` is separated from development-only resets and has a
      monotonic supported migration chain.
- [ ] Every schema change has forward migration, rollback/recovery guidance and
      fixtures from every previously released version.
- [ ] Migrations run transactionally where SQLite permits it and are proven
      restart-safe at interruption boundaries.
- [ ] Foreign keys, uniqueness constraints, check constraints and indexes are
      verified against corrupt and adversarial fixtures.
- [ ] Backup/restore and export/import behavior is documented and tested on the
      packaged application.
- [ ] The diagnostic JSON export is explicitly either promoted to a supported,
      versioned interchange format or retained as unsupported diagnostics.
- [ ] Data retention and deletion behavior is reviewed for campaign trash,
      receipts, history, imported symbols and cached/generated data.
- [ ] Golden-Master fixtures cover a realistic large campaign and all optional
      relationships.
- [ ] Upgrade qualification includes disk-full, permission, crash, stale-lock
      and interrupted-write cases on all supported operating systems.
- [ ] Release notes state the first stable format version and the oldest
      directly supported upgrade version.

## Development commands before the freeze

`pnpm dev:data:seed` recreates only the explicit seed target (default:
`.tmp/development-data-seed`; pass `--force` to replace it). It never guesses
Electron's user-data directory.

Before intentionally resetting a development data root, an optional diagnostic
snapshot can be generated with:

```sh
pnpm dev:data:export -- --data-root=/absolute/path/to/development-data \
  --output=/absolute/path/to/diagnostic.json
```

The output contains raw installation and campaign tables for diagnosis. It is
not a migration, backup, or import contract.
