# Recovery

## Purpose

`features.encountertable.recovery` owns backup, restore, and unresolved-report workflows for encounter-table recovery around creature imports.

## Canonical Types and APIs

- `RecoveryObject` - canonical recovery root for beginning recovery sessions and restoring from a persisted backup artifact.
- `repository/RecoveryRepository` - persistence boundary for encounter snapshot loading and restore writes.
- `service/EncounterRecoveryBackupStore` - backup file read/write helper under recovery ownership.
- `service/EncounterRecoveryReportWriter` - unresolved-entry report writer under recovery ownership.

## Where New Code Goes

- Put encounter-table backup orchestration, restore transactions, and recovery report semantics here.
- Keep creature identity rebinding on the creature-owned `IdentityObject`; recovery may consume it but must not re-own that policy.

## Forbidden Drift

- Do not move encounter-table recovery orchestration back into `api` or importer-local helpers.
- Do not make backup/report helpers the public recovery root.
