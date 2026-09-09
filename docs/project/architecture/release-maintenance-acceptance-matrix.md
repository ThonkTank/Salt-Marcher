# Release maintenance acceptance matrix

Scope: [canonical roadmap](release-maintenance-roadmap.md) and
[detailed target](release-maintenance-target.md). Target release: 0.3.0;
version/tag checked free on 2026-09-08, recheck before publication.
Status below is evidence classification, not a declaration of passing execution.

| ID  | Required behavior                             | Existing evidence / gap                                                                                  | Owning phase and required proof                                                                     |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| M01 | Preserve baseline 39/34                       | release-baseline.test.ts; fixture already at current schema                                              | 1/5: run baseline, extend exact settings/content assertions                                         |
| M02 | Real forward migration and skipped version    | Original-source AppImages passed A→B→C, A→C, 34→41 campaign migrations and schema-30 generated loot→42; UI pair 42/41→42/42 passed. Immutable sources and hashes recorded in roadmap-execution.md | 5: immutable historical schema artifacts A→B→C and A→C; compare semantic state                      |
| M03 | No downgrade/missing path/reset               | persistence-preflight.ts rejects incompatible inputs                                                     | 2/5: source byte comparison for missing edge/newer schema/corruption                                |
| M04 | One Local/Release transaction                 | Shared coordinator owns both adapters; Phase-2 completion suite passed | 2: both adapters run identical fault table and use one authoritative journal                        |
| M05 | Durable intent and recovery at every boundary | Shared forward/recovery boundary tests passed; real Local starter fault probe passed                                                 | 2/5: kill before/after intent, moves, startup/commit and recovery itself; restart repeatedly        |
| M06 | Never rollback accepted later work            | Commit/write/crash tests and damaged-accepted-AppImage probe preserve later work                                                 | 2/5: commit, edit, crash, restart; exact later-state comparison                                     |
| M07 | Safe source import across channels/aliases    | Canonical shared leases; real second processes through aliases blocked during asynchronous export (source-profile-access.test.ts); direct controller import preserves source bytes | 3: parallel Development/Local/Release processes; canonical aliases; source hashes unchanged         |
| M08 | Full profile preservation                     | Full original-runtime readbacks compare settings, active/inactive/trash campaigns, own files, world, paused journey and ongoing combat; real UI update preserves these and persists subsequent manual XP | 3/5: exact preferences, inactive/trash campaigns, user files, own content and resumable live state  |
| M09 | Consistent legacy export only                 | Qualified packaged protocol plus terminal journal/program/starter verification; unknown producers rejected; verified legacy backup import retained | 3: qualify producer+format or reject; no unsupported direct-folder fallback                         |
| M10 | Restore plus prior backup                     | Real UI restore forward-migrates the pre-update profile; an independent target-AppImage readback proves the prior backup retains the complete later state. Newer-format rejection still needs final artifact-matrix audit | 3/5: compare both retained current state and migrated restored state; reject newer backup           |
| M11 | Recovery without campaign DB                  | qualify-profile-recovery.ts passes real Release AppImage UI clicks after corrupt-data startup, pre-backup, relaunch and committed restore; artifact 87952bee17d0… | 3/4: launch with damaged profile, enumerate backups, restore through UI                             |
| M12 | Reuse installed executable for restore        | Real UI restore kept the same target deployment and AppImage hash (0.0.147); complete restored and protected-later profiles compared independently | 2: unchanged executable deployment count and identity after restore                                 |
| M13 | Resolve all drafts                            | Shared save/discard/cancel owners, partial-failure tests and ten SceneDesktop E2E cases including scene location/focus; Hex plan/receipt backend, productive command owner and persistent route drafts verified; save without travel start, central save/discard/cancel, renderer restart and closed-window travel pass; eleven Electron cases and unchanged travel visuals pass; pre-action transitions now resolve other editors and re-read command bases; partial-save and delayed/unmounted preparation tests pass; registered owners and their tests are inventoried in release-editor-inventory.md; repeated read supersession reproduces the stale error path and has a failing-before/passing-after regression; full candidate CI remains pending                                                                     | 4: multi-editor save/discard/cancel, partial save failure, edit barrier                             |
| M14 | Explicit download/install; offline usable     | Actual UI pair 0.0.146→0.0.147 passed separate check/download/install/restart/continue/restore. HTTP503 leaves the old app/profile usable. Startup/check never download; download never activates | 4/5: UI and feed demonstrate no automatic download/install or shutdown install                      |
| M15 | Verify origin/manifest/arch/size/hash         | Actual UI rejected same-size corrupted and truncated downloads, removed partial/cache files, and preserved program/data; retry with original bytes passed full update/restore. Wrong-origin/manifest/arch artifact cases remain to qualify | 5: damaged/truncated/wrong-origin payload never executed; progress/errors actionable                |
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
commits and successful historical runs are recorded in the Phase 5 execution log;
the remaining fault matrix is still open.

## Original owner to target owner (Phase-1 inventory)

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
production migration edges and packaged execution were qualified in Phase 5;
see the subsequent execution-log entries for exact artifact hashes and semantic
comparisons, including continued work between B and C.


## Phase 2 evidence update

Local and Release now use `shared/maintenance/coordinator.ts`; the obsolete Local
activation/recovery producer is removed. Legacy adapters preserve source evidence
and admit only identifiable recovery states. The shared standalone starter uses a
verified retained AppImage's Node mode, before any normal application data access.
Local startup reservations cover the handover to legacy executables. Cross-channel
canonical path/lock admission remains Phase 3.

Completion run: 159 tests in eight maintenance/adapter files passed; 91 architecture
tests and static checks passed. Real isolated Local test used the previous AppImage
`8801d0ba2a6847d48745d4af9978adbd29fbec5c7761ab6f1b8f62ffc55c6c57`
and target `0995d1b717e29a8674c393febad4fa0c0236134d30f95dbd37980be5dfc03670`.
It covered helper extraction from target bytes, a damaged unconfirmed target,
rollback and previous-runtime startup, acceptance of an intact update, normal
desktop startup, preservation of later work after accepted-program damage, and
fresh installation/startup. These are two real builds with the same package/schema
versions and a synthetic campaign. They do not establish Phase-5 historical schema
qualification or Phase-7 acceptance with the user's real campaign.

The later Release-v1 ambiguity guard was verified separately and in the 159-test
completion run. The exact Local artifact probe did not exercise that Release-only
branch. Canonical CI artifact handoff, main promotion, live acceptance and publication
remain separate, outstanding gates. See `../../roadmap-execution.md` for corrective
rounds and scope of each result.

## Phase 5 UI and transport evidence (2026-09-09)

The actual original Main source `bd8b33c4f5b6e5f064deb64278d9097f739cac6d`
(installation42/campaign41) and repaired source
`6d7889ca451762259bc4f472851c893bce57e1e0` (42/42) are packaged as distinct
0.0.146 and 0.0.147 AppImages. The external, explicitly enabled harness redirects
only test transport; UI inputs call the original production capability bridge.

`qualify-historical-ui-update.ts --transport-failures` passed HTTP503, same-size
corruption and truncation followed by check/download/install/restart, manual XP
editing, restore and independent readback of the backup protecting later work.
Report SHA256: `dbafa3ce6a35a535d45d12bb13f06453d8d69035a11f072d411c3e4fe1420a9a`.
Exact retained report location and run command are in `../../roadmap-execution.md`.
This is synthetic-data automated qualification, not user-data live acceptance,
a public release, or a completed Phase 5 interruption/capacity matrix.

## Isolated schema-changing UI qualification (2026-09-09)

The new immutable pair 0.0.148 (42/41) → 0.0.149 (42/42) passes the full UI
check/download/install/restart/continue/restore case in a bounded KVM guest.
The accepted-crash case now also passes: a deliberate SIGKILL after saved work
is followed by a full readback equal to that later state. Explicit restore
returns the complete seeded profile and first protects the complete later state.
Source-profile readback remains equal to the original. Report SHA256:
83a9c615116a180d35fc689711aa9301282d4524fddae609aad9b61fe8f97731.

This covers the explicit UI case, not the whole Phase 5 fault matrix. In
particular, the stable installed launcher still uses AppRun in Node mode and
needs the separately identified platform fix and its own packaged test. The
successful update relaunches the target directly and does not prove that path.

The revised installed shell launcher now also passes a separate KVM test without
FUSE: actual application startup confirms installation, the subsequent `root/start`
launch uses the packaged helper and retained Electron runtime, both exits are zero,
and the complete profile is unchanged. Temporary interpreter extraction is cleaned.
Report SHA256: e6f7af9f3b2a0c5427a1e238038d422244272f53a604e165e54d76a004a6fbd2.
This uses the uncommitted launcher fix with unchanged 0.0.149 runtime bytes;
it does not replace the forthcoming immutable package/handoff gates or signal
and interrupted-recovery qualification.

The installed launcher additionally passes SIGTERM after visible readiness in
KVM: only the starter receives the signal; its isolated process group exits,
no tracked application processes remain within ten seconds, temporary extraction
is removed, and a subsequent normal launch succeeds with the complete profile
unchanged and the journal still committed. Report SHA256:
9a9e8f3571952d0879ae2262b86e73ffecf3788c4fbc515ce42955a6071a4084.
Signals during extraction/startup and migration interruption remain separate cases.

The final launcher, including interruptible extraction, passes that same complete
normal-start/SIGTERM/restart/profile case in `launcher-run-10`. Report SHA256:
978b2febb8249832ebb533509c50704fd9bc6541456d97023182c2cc5b022980.
The preceding failed runs remain recorded: the UI driver accessed the document
before its body existed and attempted interaction before the campaign screen was
ready. The qualifier now waits for visible startup and preserves failure text,
screenshot and journal; no version or content assertion was relaxed. A separate
synthetic slow-extractor regression proves SIGTERM during extraction exits 143
and removes the owned child and temporary directory. It does not prove SIGKILL
inside a real migration. Candidate CI and immutable packaging remain required.
