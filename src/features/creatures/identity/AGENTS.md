# Creature Identity

## Purpose

`features.creatures.identity` owns stable creature identity resolution across import and recovery workflows: source-slug aliases, slug/name matching, and local-id assignment decisions.

## Canonical Types and APIs

- `IdentityObject` - canonical creature identity root for recovery-id resolution, import-id resolution, and source-slug alias upserts.
- `input/ResolveRecoveryIdInput` - request and result carrier for encounter-table recovery id matching.
- `input/ResolveImportIdInput` - request and result carrier for import-time local-id assignment and drift reporting.
- `input/UpsertAliasInput` - request carrier for source-slug alias persistence after a successful import write.

## Where New Code Goes

- Put new creature identity policy in this owner.
- Keep low-level slug/name/id persistence lookups behind `repository/identity`.
- Keep importer and encounter-table recovery as consumers of this creature-owned seam instead of owning identity policy themselves.

## Forbidden Drift

- Do not recreate creature identity policy in `src/importer`.
- Do not let encounter-table recovery own slug/name/id matching rules.
- Do not treat `features.creatures.api.CreatureRecoveryIdentityService` or `features.creatures.application.identity.CreatureImportIdentityService` as the canonical owner again.
