# Release maintenance acceptance matrix

Scope: [canonical roadmap](release-maintenance-roadmap.md) and
[detailed target](release-maintenance-target.md). Target release: 0.3.0;
version/tag checked free on 2026-09-08, recheck before publication.
Status below is evidence classification, not a declaration of passing execution.

| ID  | Required behavior                             | Existing evidence / gap                                                                                  | Owning phase and required proof                                                                     |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| M01 | Preserve baseline 39/34                       | release-baseline.test.ts; fixture already at current schema                                              | 1/5: run baseline, extend exact settings/content assertions                                         |
| M02 | Real forward migration and skipped version    | loot-schema-31-migration.test.ts covers a domain transition; synthetic AppImages share schemas           | 5: immutable historical schema artifacts A→B→C and A→C; compare semantic state                      |
| M03 | No downgrade/missing path/reset               | persistence-preflight.ts rejects incompatible inputs                                                     | 2/5: source byte comparison for missing edge/newer schema/corruption                                |
| M04 | One Local/Release transaction                 | profile-transaction.ts, release/deployment.ts and local-installation/recovery.ts have separate authority | 2: both adapters run identical fault table and use one authoritative journal                        |
| M05 | Durable intent and recovery at every boundary | release-recovery.test.ts covers some activation failures                                                 | 2/5: kill before/after intent, moves, startup/commit and recovery itself; restart repeatedly        |
| M06 | Never rollback accepted later work            | release-maintenance.test.ts and release-recovery.test.ts                                                 | 2/5: commit, edit, crash, restart; exact later-state comparison                                     |
| M07 | Safe source import across channels/aliases    | import test uses quiet source; SingletonLock check insufficient                                          | 3: parallel Development/Local/Release processes; canonical aliases; source hashes unchanged         |
| M08 | Full profile preservation                     | snapshot inventory and domain readback exist                                                             | 3/5: exact preferences, inactive/trash campaigns, user files, own content and resumable live state  |
| M09 | Consistent legacy export only                 | diagnostic JSON is explicitly unsupported                                                                | 3: qualify producer+format or reject; no unsupported direct-folder fallback                         |
| M10 | Restore plus prior backup                     | release-maintenance.test.ts includes corrupt-current preservation                                        | 3/5: compare both retained current state and migrated restored state; reject newer backup           |
| M11 | Recovery without campaign DB                  | lifecycle recovery and error UI exist                                                                    | 3/4: launch with damaged profile, enumerate backups, restore through UI                             |
| M12 | Reuse installed executable for restore        | controller currently stages deployment                                                                   | 2: unchanged executable deployment count and identity after restore                                 |
| M13 | Resolve all drafts                            | dirty-ID guard currently blocks only                                                                     | 4: multi-editor save/discard/cancel, partial save failure, edit barrier                             |
| M14 | Explicit download/install; offline usable     | transport/controller tests exist                                                                         | 4/5: UI and feed demonstrate no automatic download/install or shutdown install                      |
| M15 | Verify origin/manifest/arch/size/hash         | release-contract.test.ts, release-transport.test.ts                                                      | 5: damaged/truncated/wrong-origin payload never executed; progress/errors actionable                |
| M16 | WAL, disk/access failure, concurrent start    | partial snapshot and profile-lock tests                                                                  | 2/3/5: real WAL and fault injection before backup and during stage/activation                       |
| M17 | Empty, existing, damaged initial profile      | installed-profile-readbacks.test.ts and maintenance tests                                                | 5: separate packaged cases, no artificial campaign to pass empty verification                       |
| M18 | Test immutable inputs                         | existing exact-SHA Handoff                                                                               | 6: immutable checkout; preflight tools/auth/display/disk/version before expensive run               |
| M19 | Risk-based CI, unknown means full             | current mandatory full Check remains                                                                     | 6: dependency mapping tests, central required-proof aggregate, AGENTS/workflow alignment            |
| M20 | Build once, same bytes published              | release.yml/publish-release.yml scaffold                                                                 | 6: draft/hash/acceptance checks, actual protected environment; no version overwrite                 |
| M21 | Explicit baseline selection                   | package-release-baseline.ts hardcodes 0.2.0                                                              | 6: release request records commits/versions/assets; legacy manifestless release excluded            |
| M22 | Real-data live acceptance                     | earlier synthetic campaign/local Handoff insufficient                                                    | 7: copy existing user campaign, save/update/continue/restore, record exact hash and manual approval |
| M23 | Public usable release                         | no new public Electron release acceptance                                                                | 7: anonymous download, verified hash, user installation without developer tooling                   |

## Fixture and comparison selection

Retain tests/fixtures/release-0.2.0 unchanged as internal 39/34 baseline. Do not
rename its historical metadata to imply it was generated by the new release.
Use its exact campaign ID and add separate richer profile fixtures with asserted
settings, active/inactive/trash campaigns, custom files and ongoing encounter state.
The existing 0.1.99→0.2.0 package pair remains transport-only evidence.

Phase 5 must build immutable source stands with genuine schema edges. Inspect and
qualify repository history (including the schema-31 loot transition) for compatible
standalone artifacts; record exact commits and hashes. If historical packaging
needs a harness, record that harness separately and retain each stand's original
schema/migration semantics. No invented production migration merely to pass a test.
Choose three actual schema stands for skipped-release qualification. Exact artifact
commits are an open Phase 5 deliverable, not existing evidence.

## Current owner to target owner

| Existing implementation                                          | Target responsibility                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| core/maintenance/profile-snapshot.ts                             | Utility snapshot, migrations, validation primitives                                   |
| core/maintenance/profile-transaction.ts                          | Shared transaction phases and authoritative journal via explicit ports                |
| main/release/deployment.ts and recovery.ts                       | Executable/lifecycle adapter; no independent recovery authority                       |
| scripts/local-installation/recovery.ts and campaign-migration.ts | Delegate to shared coordinator; validated legacy journal drain only during transition |
| main/release/controller.ts                                       | User-request lifecycle/network, shared coordinator invocation                         |
| utility/maintenance/worker.ts                                    | Utility entry with validated contracts                                                |
| renderer maintenance draft guards                                | Narrow editor participant interface, central decision dialog                          |

Implementation, automated verification, Local handoff, live acceptance and publication
are separate statuses. A test filename is a coverage lead until its execution and
assertions have been audited for the associated requirement.

Selected historical sources (Phase 1 audit): A=52a0cc28cdb332406a4d03e0a14cc005eb7a0ff0
(37/34), B=6e84a12c1c83cd6437680ae70529cdc9723c353b (38/34),
C=c583e05506e10d8446a4e210fa0603e3be53d63a (39/34). Their schema metadata and
production migration edges were inspected; packaged execution remains unqualified.
