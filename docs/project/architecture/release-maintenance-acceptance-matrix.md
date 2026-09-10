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
| M05 | Durable intent and recovery at every boundary | Real AppImages passed eight pre-acceptance activation boundaries, interrupted rollback including durable history, and an actual migration Utility kill. Installed starter passed all eight pre-acceptance activation boundaries with complete profile/restore readbacks. An earlier awaiting-start run timed out selecting a backup; unchanged artifacts passed the diagnostic rerun, so that intermittent UI failure remains unexplained. Local installer process suite now passes eight activation and nine recovery SIGKILL boundaries with complete SQLite/file, program and desktop comparisons, using inert artifacts and simulated runtime acceptance. Standalone helper also passed journal:rollback-started, journal:rollback-preserving, failed-data-preserved, journal:rollback-restoring and old-data-restored through the installed starter with unchanged AppImages and explicit helper-role markers (report hashes in roadmap-execution.md). Packaged Local runtime and remaining helper boundaries stay open; report hashes in roadmap-execution.md                                                 | 2/5: kill before/after intent, moves, startup/commit and recovery itself; restart repeatedly        |
| M06 | Never rollback accepted later work            | Real AppImage SIGKILL immediately after durable committed preserves the same target/journal on restart. A second SIGKILL after saved XP preserves the complete later profile; restore first protects that work in a verified backup (report f8040582fe0e01126580ac984b5ebb7de8077ef7525b1f3b9843048752bd36df). Installed-starter equivalent also passed with unchanged journal and complete later-profile comparison (report 0d00ea54b8b2755f4548a45e47a6386124bb0943a4f5135c78ebaae3e7b5c983)                                                 | 2/5: commit, edit, crash, restart; exact later-state comparison                                     |
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

## Real coordinator process termination (2026-09-09)

`tests/unit/maintenance-process-interruption.test.ts` adds 35 Linux cases for
journal formats 2 and 3. Each targeted boundary writes an acknowledgement and
terminates the child with SIGKILL; the parent verifies that exact signal.
Recovery executes twice in newly started processes. Assertions compare complete
file trees including empty directories, selected program links, preserved failed
profiles, and post-commit writes. Format 3 includes the durable rollback-history
boundary. These are real OS process deaths, but use inert program bytes and
synthetic file profiles: packaged Local/Release adapters, SQLite migration,
physical power loss and real AppImage interruption still require their own proof.

## Packaged migration transaction interrupted (2026-09-09)

Immutable test AppImage 0.0.148 (42/41) supplies the complete seeded profile;
0.0.150 (42/42), SHA256
c5460bb82ff02f04c81b0db0f4aca8d9209c995358350228344828ed6e5c1a8a,
executes the original campaign-41-to-42-active-loot-receipts migration. Its test
harness kills the Utility process after original migration SQL, inside the
original transaction and before schema-version publication/commit. The KVM run
records matching worker/request identity, inTransaction=true and Utility exit 9.
The old AppImage then reads the complete working profile equal to the seed.
Retry with the target AppImage migrates successfully and its full readback matches
the expected data; the source remains unchanged. Report SHA256:
a9c38ce269a2a41c2e3594565c1fb4e5d833a15c0070cb0fbbb284520797ffd4.

This proves rollback/retry for this real migration transaction. It does not yet
prove every migration, physical power failure, or coupled Local/Release update
activation after Utility death. The harness is explicitly test-only and records
its own source hashes; these artifacts are not public releases.

## Utility death during the actual UI update (2026-09-09)

Test AppImages 0.0.148 → 0.0.151 pass the real ReleaseController preparation-
failure/retry path in KVM. The explicitly instrumented historical target retains
its original built maintenance entry unchanged; the test-only wrapper pauses
immediately after original loot-receipt DDL in an open version-41 transaction.
The external qualifier verifies the staged-profile worker PID and sends SIGKILL.
The app displays the interrupted-maintenance error and preserves the previous
program/profile. Its pre-update backup remains valid and its complete content is
read back by the old AppImage equal to the seed.

The subsequent UI check/download/install/restart/continue/restore path passes
with the same artifact bytes. Later work is preserved in the pre-restore backup;
source, restored and expected migrated profiles compare in full. Two backups
are intentionally retained; the UI test selects the requested one by its visible
date and version. Report SHA256:
eac69a16dd473c772126e0207604a114de1c3c8d2a93d537115f25dec6f2f1c5.
Target SHA256:
4741a6029e7608c3f68bdda3f43b27b8711539fbde03a2875272e57b7a428597.
This proves the coupled Release preparation-failure path, not all activation/
recovery boundaries, the Local adapter, or public-release artifact acceptance.

## Release activation interrupted after durable publication (2026-09-09)

Test AppImages 0.0.152 (42/41) → 0.0.153 (42/42) pass three actual activation
crashes in KVM. A test-only Main observer pauses after the original directory
fsync; the qualifier SIGKILLs the identified application processes. The next
actual AppImage startup performs recovery, with no test-driven rollback call.

| Durable boundary | Journal at interruption | Full UI report SHA256 |
|---|---|---|
| New profile moved into place | data-moving | 1259525343ddb697e8f885e96e3b06a23991e74dbe3e15a6adad912481470530 |
| Data activation complete | data-ready | 89437437405fcecb5df0fb57a04edc1b271d0305f260281016e056b847866f9c |
| Program symlink switched | program-moving | 6465be10afafef9a162d9229386d1e69c6a6765438a358e4aad818e44af87a45 |

Each case verifies the recovered old program/profile, a complete old-runtime
readback, then successful UI update/restart/continue/restore with preserved later
work. Previous rollback journals and backups remain; retry completion is matched
to a new transaction ID. Other activation boundaries, interrupted recovery,
stable shell admission and the Local adapter still require separate coverage.

The remaining five pre-acceptance Release activation boundaries also pass with
the same 0.0.152/0.0.153 artifacts and complete recovery/retry/restore assertions:

| Durable boundary | Full UI report SHA256 |
|---|---|
| Prepared journal | ef7156071e7a89e3154572125927ce96d0cb5894407fb204f40f963c6dda7c54 |
| Data-moving journal | 7d1dbcfaa73d16527718ccb7ff037d1aad837e06cf2848657daa81fc9ed7eb33 |
| Previous profile moved aside | 1dc3dead23ea927f7659f09ff36773b18a2971e6c9096e66f08bfbc96437c931 |
| Program-moving journal | 97fc82ca9a17df26bc9c6ab77bd668c8066d925d1f1502cc76a1522c34d5f509 |
| Awaiting-start journal | a0c100ca2757d6d068079bd177d3ef481efb145f272bde4b8940c7d5a5a55f89 |

These complete the eight listed forward boundaries before acceptance for this
Release update pair. Interrupted recovery itself, committed-state handling,
first installation, the stable shell starter and Local adapter remain separately
scoped cases; this does not close the complete Phase 5 matrix.

## Recovery itself interrupted (2026-09-09)

The first packaged recovery-interruption case passes with the same artifacts:
activation dies after the new profile is moved into place; the next actual app
startup is killed again after preserving that failed target profile, while the
journal still says rollback-preserving. A third startup completes recovery.
Both the restored old profile and preserved failed target profile are read in
full by their respective AppImages and equal the seeded content. The subsequent
complete UI update/continue/restore and protected-later-work checks also pass.
Two explicit process exits are SIGKILL, all later UI launches exit normally.
Report SHA256:
06c6910d166cb8031fe92708622846094c5955cfafc1993368d80a9745f7c09c.
Other recovery boundaries remain unqualified by this single case.
