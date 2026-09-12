# Release maintenance acceptance matrix

Scope: [canonical roadmap](release-maintenance-roadmap.md) and
[detailed target](release-maintenance-target.md). Target release: 0.3.0;
version/tag checked free on 2026-09-08, recheck before publication.
Status below is evidence classification, not a declaration of passing execution.

## Evidence availability — 2026-09-10

The local `work/qualification-vm` directory disappeared during an independently
running artifact build. Its VM reports, seeds and base image are currently
unavailable; the cause is awaiting clarification. Historical successful-run
entries below remain records of earlier observations, **not currently revalidated
proof for phase completion** where their only report was in that directory.

Fifteen historical reports survive elsewhere in `work`. The complete state,
restore and protected-later-work invariants were rechecked in the retained
`historical-ui-update-restore-v7` report (SHA256
`492f97ea40b8dd9e7ca232c62d9ea97f1013fb731a00b20f23abb518ee40af90`)
and `historical-ui-transport-failures-v1` report (SHA256
`dbafa3ce6a35a535d45d12bb13f06453d8d69035a11f072d411c3e4fe1420a9a`).
These older runs do not replace the missing newer installed-starter, interruption,
WAL, capacity, parallel-start and invalid-feed evidence. Recover or rerun those
proofs before closing Phase 5. The requalified 0.0.160/161 feed/update path and
0.0.161 first installation are documented below; neither replaces all missing
runtime evidence.

| ID  | Required behavior                             | Existing evidence / gap                                                                                  | Owning phase and required proof                                                                     |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| M01 | Preserve baseline 39/34                       | release-baseline.test.ts; fixture already at current schema                                              | 1/5: run baseline, extend exact settings/content assertions                                         |
| M02 | Real forward migration and skipped version    | Original-source AppImages passed A→B→C, A→C, 34→41 campaign migrations and schema-30 generated loot→42; UI pair 42/41→42/42 passed. Immutable sources and hashes recorded in roadmap-execution.md | 5: immutable historical schema artifacts A→B→C and A→C; compare semantic state                      |
| M03 | No downgrade/missing path/reset               | persistence-preflight.ts rejects incompatible inputs                                                     | 2/5: source byte comparison for missing edge/newer schema/corruption                                |
| M04 | One Local/Release transaction                 | Shared coordinator owns both adapters; Phase-2 completion suite passed | 2: both adapters run identical fault table and use one authoritative journal                        |
| M05 | Durable intent and recovery at every boundary | Real AppImages passed eight pre-acceptance activation boundaries, interrupted rollback including durable history, and an actual migration Utility kill. Installed starter passed all eight pre-acceptance activation boundaries with complete profile/restore readbacks. An earlier awaiting-start run timed out selecting a backup; unchanged artifacts passed the diagnostic rerun, so that intermittent UI failure remains unexplained. Local installer process suite now passes eight activation and nine recovery SIGKILL boundaries with complete SQLite/file, program and desktop comparisons, using inert artifacts and simulated runtime acceptance. Standalone helper passed all nine recovery boundaries through the installed starter with unchanged AppImages and explicit helper-role markers (report hashes in roadmap-execution.md). Original packaged Local 42/41 → 42/42 runtime acceptance and all eight activation SIGKILL boundaries are now qualified (retained reports below). All nine Local recovery SIGKILL boundaries are also qualified; other fault cases remain incomplete; report hashes in roadmap-execution.md                                                 | 2/5: kill before/after intent, moves, startup/commit and recovery itself; restart repeatedly        |
| M06 | Never rollback accepted later work            | Real AppImage SIGKILL immediately after durable committed preserves the same target/journal on restart. A second SIGKILL after saved XP preserves the complete later profile; restore first protects that work in a verified backup (report f8040582fe0e01126580ac984b5ebb7de8077ef7525b1f3b9843048752bd36df). Installed-starter equivalent also passed with unchanged journal and complete later-profile comparison (report 0d00ea54b8b2755f4548a45e47a6386124bb0943a4f5135c78ebaae3e7b5c983)                                                 | 2/5: commit, edit, crash, restart; exact later-state comparison                                     |
| M07 | Safe source import across channels/aliases    | Canonical shared leases; real second processes through aliases blocked during asynchronous export (source-profile-access.test.ts); direct controller import preserves source bytes | 3: parallel Development/Local/Release processes; canonical aliases; source hashes unchanged         |
| M08 | Full profile preservation                     | Full original-runtime readbacks compare settings, active/inactive/trash campaigns, own files, world, paused journey and ongoing combat; real UI update preserves these and persists subsequent manual XP | 3/5: exact preferences, inactive/trash campaigns, user files, own content and resumable live state  |
| M09 | Consistent legacy export only                 | Qualified packaged protocol plus terminal journal/program/starter verification; unknown producers rejected; verified legacy backup import retained | 3: qualify producer+format or reject; no unsupported direct-folder fallback                         |
| M10 | Restore plus prior backup                     | Real UI restore forward-migrates the pre-update profile; an independent target-AppImage readback proves the prior backup retains the complete later state. Newer-format rejection still needs final artifact-matrix audit | 3/5: compare both retained current state and migrated restored state; reject newer backup           |
| M11 | Recovery without campaign DB                  | qualify-profile-recovery.ts passes real Release AppImage UI clicks after corrupt-data startup, pre-backup, relaunch and committed restore; artifact 87952bee17d0… | 3/4: launch with damaged profile, enumerate backups, restore through UI                             |
| M12 | Reuse installed executable for restore        | Real UI restore kept the same target deployment and AppImage hash (0.0.147); complete restored and protected-later profiles compared independently | 2: unchanged executable deployment count and identity after restore                                 |
| M13 | Resolve all drafts                            | Shared save/discard/cancel owners, partial-failure tests and ten SceneDesktop E2E cases including scene location/focus; Hex plan/receipt backend, productive command owner and persistent route drafts verified; save without travel start, central save/discard/cancel, renderer restart and closed-window travel pass; eleven Electron cases and unchanged travel visuals pass; pre-action transitions now resolve other editors and re-read command bases; partial-save and delayed/unmounted preparation tests pass; registered owners and their tests are inventoried in release-editor-inventory.md; repeated read supersession reproduces the stale error path and has a failing-before/passing-after regression; full candidate CI remains pending                                                                     | 4: multi-editor save/discard/cancel, partial save failure, edit barrier                             |
| M14 | Explicit download/install; offline usable     | Actual UI pair 0.0.146→0.0.147 passed separate check/download/install/restart/continue/restore. HTTP503 leaves the old app/profile usable. Startup/check never download; download never activates | 4/5: UI and feed demonstrate no automatic download/install or shutdown install                      |
| M15 | Verify origin/manifest/arch/size/hash         | Actual UI rejected same-size corrupted and truncated downloads, removed partial/cache files, and preserved program/data; retry with original bytes passed full update/restore. Original 0.0.158/159 rejects foreign manifest and binary URLs, wrong repository, architecture, format and version before binary requests; each full profile readback and subsequent update/restore passed. Raw schema error UI confirmed; clearer metadata messages implemented, packed requalification pending | 5: damaged/truncated/wrong-origin payload never executed; progress/errors actionable                |
| M16 | WAL, disk/access failure, concurrent start    | Packaged WAL case: killed SQLite writer, main-file-only value differs from DB+WAL; installed 0.0.156→0.0.157 full update/continue/restore preserves the WAL value and complete fixture. Packaged access-denied preserves profile and refuses restore without protective backup. Isolated 2GiB ext4 cases passed: backup-space rejection and actual ENOSPC during deployment, unchanged program/journal/data, followed by full retry/continue/restore. Raw ENOSPC UI message corrected and requalified with immutable 0.0.158/159: both preflight refusal and actual write failure show the German next action, preserve data and pass full retry/restore. Packaged 0.0.158/159 parallel-start proof passed: installer-held profile, active starter, symlink alias and direct AppImage all refuse with unchanged locks/journal/program; full update/continue/restore passes afterward. Packaged Local cross-channel qualification remains separate                                                                  | 2/3/5: real WAL and fault injection before backup and during stage/activation                       |
| M17 | Empty, existing, damaged initial profile      | Packaged 0.0.157 empty-profile setup and newer-format/missing-path/corrupt/access-denied cases passed; readable invalid profiles restore through UI with complete raw protective backup. First-install/import flow remains separately open                                                | 5: separate packaged cases, no artificial campaign to pass empty verification                       |
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

## Retain future VM evidence outside disposable runs

After a VM run terminates, run `scripts/archive-historical-vm-evidence.ts` with
`--run <completed-run-directory>` and `--output <new-retained-directory>` using
the repository TypeScript runner. The output parent must already exist, and the
output must be outside the VM run directory. Keep retained evidence outside
`work/qualification-vm` as well, so cleaning that tree cannot remove the reports.

The collector verifies complete exports, gzip integrity, safe regular JSON entries
and unique report paths. It preserves original archives and hashes, writes the
archive manifest last, refuses existing destinations, and never deletes source
files. Its manifest explicitly records transport integrity only. Review the
reported test exits, artifact identities, process exits and scenario-specific
state invariants before treating any report as acceptance evidence or removing
a disposable guest disk. A failed run can be archived without becoming a pass.

## Empty-profile first installation requalified (2026-09-10)

Original AppImage 0.0.161 (`27ba6b7b92352ea49701faa440c644805828931484134814df1d4c5007ef3d00`)
passed installation from a download directory through the actual setup and
confirmation UI, with no staged deployment beforehand. The resulting journal is
committed; the installed starter, desktop entry and executable identity are
verified. A second normal start through the installed starter preserves the
journal and shows the empty campaign view. Both processes exit normally.

Report SHA256: `448b212e701a58b29f5eb9ffc1fbaa457f98080b3f00bcf7ad342f562e918d4a`.
The report and original export are retained separately under
`outputs/qualification-evidence/first-install-v2-run-1`; the disposable guest disk
was removed only after archive and semantic validation. This proves empty-profile
installation and restart, not existing-profile import or complete Phase 5.

## Actionable invalid-feed rejection requalified (2026-09-10)

The immutable 0.0.160 (42/41) → 0.0.161 (42/42) pair passed six invalid-feed
cases through the UI: manifest origin, artifact origin, repository, architecture,
manifest format and version mismatch. Each rejection provides a next action,
exposes no raw schema diagnostics, requests no AppImage and preserves the full
profile. The subsequent healthy update through the installed starter, continued
work and complete restore all passed; the protective backup equals the later
working state and the original source remains unchanged.

Report SHA256: `dcea76ed74cae9eadbafbbb119fb54d9e39c6fa6948d77a112424f519f9daee9`.
Retained report and original export: `outputs/qualification-evidence/feed-actionable-v2-run-1`.
All normal processes exited successfully. The guest disk was removed after
transport and semantic validation. This reestablishes this specific missing proof;
it does not restore the other unavailable VM reports or close Phase 5.


## Original Local installers and AppImages qualified (2026-09-10)

The original Local installers from `bd8b33c4f5b6e5f064deb64278d9097f739cac6d`
and `8494e663a72f6f5e14ee03ec061626302138c5e7` operate on their corresponding
unchanged AppImages. Adapter construction verifies clean source identities and
build fingerprints against the artifact manifests; separate backup workers and
adapter bytes are hashed. The test substitutes only the already verified source
identity in the guest, which has no Git checkout. It does not simulate SQLite,
backup execution, migration or runtime acceptance.

The 42/41 → 42/42 schema update receives real ready events from both installed
Local AppImages, followed by committed journals. Complete seeded settings,
registry, campaigns, preferences and own files match before/after and in the
unchanged source. Report SHA256:
`0a8129aad563a7bc298c58ba20603fd2a10a0f2385f7c966e22f073d2ac20155`.
Retained export: `outputs/qualification-evidence/local-schema-v2-run-3`.

All eight activation boundaries passed actual installer SIGKILL, twice-idempotent
recovery through the original baseline installer, full profile and desktop/program
comparisons, then a successful retry with real target runtime acceptance:
`prepared`, `data-moving`, `old-data-moved`, `new-data-moved`, `data-ready`,
`program-moving`, `program-linked`, `awaiting-start`. Reports are retained in
`outputs/qualification-evidence/local-interruption-v2-run-{1,2,3}`; individual
SHA256 values and semantic audits are in `docs/roadmap-execution.md`.

The recovery-interruption pilot additionally kills the baseline installer at
`old-data-restored` after killing the target installer at `awaiting-start`.
Repeated recovery and the subsequent real update preserve the full profile.
Report SHA256: `5e10b1103e7271fe1320dca6c45b1973beac7416ff0b49a9fb699d12cc08d3cb`,
retained in `outputs/qualification-evidence/local-recovery-v2-run-1`.
Four additional recovery boundaries passed both SIGKILLs, repeated recovery and
real retry: `rollback-started`, `rollback-preserving`, `failed-data-preserved`,
`rollback-restoring`. Their exports are retained in
`outputs/qualification-evidence/local-recovery-v2-run-2`; individual hashes are
in the execution log. The final four (`rollback-program`, `program-linked`,
`rollback-history-written`, `rolled-back`) passed the same full audit, with
exports in `outputs/qualification-evidence/local-recovery-v2-run-3`. All nine
Local recovery boundaries are therefore qualified for this artifact pair and
guest configuration; this does not close the other Phase-5 requirements.

These Local tests run in an isolated Linux guest with unprivileged user namespaces
allowed. The historical installer otherwise fails in the guest because AppRun
adds `--no-sandbox` to its Node-mode resource reader (diagnostic exit 9). The current
resource reader uses direct extraction and its stricter-guest evidence remains
separate. No host protection settings or original AppImages were changed.
Disposable successful guest disks were removed only after full archive and
semantic verification. These tests do not constitute the canonical Local handoff,
direct profile-import UI acceptance, or Phase-5 completion.

## Native whole-profile import qualified (2026-09-10)

Release test artifact `0.0.163` from `7c6d08205e42cd9227bab98e1920dbb64f0c18c9`,
SHA-256 `8bf3690cfc8f4c6efc565feceee5a7f6476ca76ffff5cb1b38637cedf9f751a6`,
passed first installation and import of the actual installed Local target profile
from the original Local pair described above. The real native directory chooser
and replacement confirmation were used. Whole-profile readback after import and
restart equals the seeded Local data; source files remain byte-identical and its
journal unchanged. The pre-import backup equals the previous empty profile
logically, including SQLite contents. All tracked normal app processes exited 0.

Retained archive: `outputs/qualification-evidence/profile-import-v2-run-9`; report
SHA-256 `8d516ae1c5e1194a969a87c05d2aab70a5776e7aa6b498e099da29e87acbb3a3`.
Transport hashes and semantic assertions were checked before deleting the
disposable guest disk. This proves the successful native import path; rejection
of a held source lock through this UI remains a separate pending case. It is
not manual release acceptance, a canonical handoff, or Phase-5 completion.

Native source-lock rejection and retry now also passed using test release
`0.0.164` from `a6465210fe392c0bc4a30989e709d9c7d6cdf1bf`, artifact SHA-256
`e758d500a12465a2bc0366eca7dcabe5a416f32e5db47c3bfdcd338151496a4d`. A genuine shared application lease was
held across the real directory chooser and confirmation. The UI supplied a
close/wait/retry action; source and target contents, journal and backup inventory
remained unchanged. Releasing the lease allowed the complete successful import
and restart comparison. Four normal application processes exited 0.
Retained report: `outputs/qualification-evidence/profile-import-v2-run-11`,
SHA-256 `6875da497b3bda16c9e218b902067be19a81d96a0f1524ef8f4cfd39b2fb72bc`. Export integrity and
semantic assertions were rechecked before removing its disposable guest disk.
This closes the held-source-lease case above, not the remaining Phase-5 matrix.

## Retained WAL, parallel-start and accepted-work crash evidence

The installed-starter update from `0.0.160` (42/41) to `0.0.164` (42/42)
passed with a committed value present only in the 4,152-byte WAL. Four competing
starts were rejected: starter under maintenance lease, and starter, path alias
and direct AppImage while the app was active. Existing lock contents and journal
were preserved. A real SIGKILL after saving XP 975→1000 preserved the complete
later profile and committed journal on restart. Restore returned the seed state
and first backed up the entire later profile, verified by independent readback.
The original source profile still matched the seed.

Archive `outputs/qualification-evidence/wal-parallel-accepted-v2-run-1`, report
SHA-256 `795095efc4d154a4edc16ceecd52f3af0e9926d0fe567bd40833e82cbace16c4`; integrity and full semantic comparisons rechecked before
disposable disk removal. This reestablishes these previously missing cases,
including the accepted-later-work case; it does not prove an interruption at the
commit boundary itself or all activation/recovery boundaries.

## Profile faults requalified on integrated main

Test release `0.0.165`, source `2b5b4d55a59c45b815a9b84676f91a4c47ed07e8`,
artifact SHA-256 `3d43a4d467fd755a9168a7c37246638efec3eca29ff6b1774d4a148977c1725a`, passed newer-format, missing-path,
corrupt and access-denied cases in the isolated v3 guest. Recovery remained
accessible without a working installation database. Explicit restore preserved
the complete invalid profile in a non-restorable protective backup, then
restored the complete seed. Actual denied permissions prevented replacement and
produced an actionable permissions message; restoring permissions retained the
original readable profile. Source contents remained unchanged in every case.

Retained archive: `outputs/qualification-evidence/profile-faults-v3-run-1`.
Transport and complete semantic comparisons were audited before guest deletion.

- `access-denied`: `06ef2ed426f754911a10d5432ab2b33bbb2af636fb72a04242a7e8617516c112`
- `corrupt`: `210cb5d06e9323976d84ef086adcf7bc9c96e0920232cfb8c2926f312b2d141a`
- `missing-path`: `2364e56293e5ab2848b4ba7bdea06fd93c0695c1e1e1ba0456d876f9642f9c77`
- `newer-format`: `0f83f63e979e9e49dd24e416103af600b054cb4c8711adee721d3b582690356b`

## Capacity rejection and retry requalified

The installed-starter path `0.0.160` → `0.0.165` passed both a maintenance
space preflight rejection (210,599,936 bytes free) and actual copy failure on a
separate 2 GiB ext4 guest volume with 1,044,480 bytes free. Each case preserved
the previous program/journal/profile, displayed a free-space/retry action and
then passed the complete update, saved-continuation and restore/protect-later-work
path after releasing reserved space. Target comparisons explicitly include only
the independently verified additive party-field default; source comparisons
remain unchanged. Both reports were audited before disposable guest removal.

Retained archive: `outputs/qualification-evidence/capacity-v3-run-2`.

- `qualification-capacity-preflight`: `f791dc4a90dca07fb76ceedac7349599f936e22dfe1d9b6700d61bcafa4ea409`
- `qualification-capacity-exhausted`: `a99be5fbac012ac74e2567d7f18b2d527427f5c8ae59d089322995fe26ac9cdb`

## Migration and committed-state interruptions requalified

Original source `2b5b4d55a59c45b815a9b84676f91a4c47ed07e8`, test artifact
`0.0.166` SHA-256 `2ee7de38fef0e8551759279189e60f0c8336eb385de2b1ea3edfd28669524666`, passed the installed-starter
update from `0.0.160` with the explicit maintenance observer. The Utility was
killed after original migration DDL in an open schema-41 transaction, including
a recoverable trashed campaign. Complete prior profile and backup readbacks
matched the seed. Retry passed; killing immediately after durable committed
preserved the exact accepted journal and target. A further kill after saved XP
975→1000 preserved the full later profile, which restore first backed up intact.

Archive `outputs/qualification-evidence/migration-commit-crash-v3-run-1`, report
SHA-256 `2e480e106f41f0f8f2c91b62faea8614edca05c746c9b11c6ef71a5f3a954a8e`. Transport and semantic assertions audited before disposable
disk deletion. This reestablishes migration, immediate-commit and later-use
crash evidence; the other Release activation/recovery boundaries remain open.

## Release activation boundaries requalified, first batch

With unchanged `0.0.160`/`0.0.166` AppImages and the installed starter,
`journal:prepared`, `old-data-moved` and `new-data-moved` each passed a real
process kill, rollback to the same transaction with the complete prior profile,
and a subsequent full update/continue/restore path protecting later work.
Source contents remained unchanged. Full exports and semantics were checked
before removing the disposable disk. Five further activation points and nine
launcher recovery points remain to be requalified.

Archive: `outputs/qualification-evidence/activation-v3-run-1`.

- `journal:prepared`: `619282b378b5b555fe54d26ca7ce7e0ed9fbe92dd766a7ab29adee562c05b6dc`
- `new-data-moved`: `ed4202467335a31a9fde460639297e44320d3c7f3afb2cd4c6accb10a9b24383`
- `old-data-moved`: `bf4c7829adceeaad4601d9f6ddc89083ea753d17929216d7fa4aeca3c512812d`

## Release activation boundaries requalified, second batch

The unchanged 0.0.160/166 pair passed data-moving, data-ready and
program-moving interruptions with full rollback, retry, continued XP editing
and restore/protected-later-profile comparisons. VM and test exit codes are zero.
All archive hashes and semantic assertions were independently checked before
removing the disposable disk. Reports in `outputs/qualification-evidence/activation-v3-run-2`:

- `journal:data-ready`: `fc19ce92567f92878ea68fe0f4c62abedf39bc6c9f4ea20ce02fd09444bc98b8`
- `journal:data-moving`: `321e7793e8a28e206c6234690a7c2df8a00b5db2a0a18949b0442e5f65ce0e11`
- `journal:program-moving`: `173a63cb72261c4bb69e39651d8dafae08bc029b57dc174e85644fade0d12881`

Two forward activation boundaries and nine launcher recovery boundaries remain.

## Release activation boundaries requalified, final batch

Both remaining 0.0.160/166 forward interruptions passed with complete profile,
rollback, retry, later work and restore/protective-backup comparisons.
Archive `outputs/qualification-evidence/activation-v3-run-3` was independently
hash- and content-checked before disposable guest deletion.

- `journal:awaiting-start`: `6d8a66e6103e201a119208fef3b82e5d04a3aa1368a2e3b68784280ad4553e14`
- `program-linked`: `9840a3f12604e9f02774349c141d0c72fba76db2618731a94c6bfe4f0cdeaecc`

All eight forward boundaries are requalified; nine launcher recovery boundaries remain.

## Newer complete-profile backup rejected through the UI

The 0.0.160/167 full update and continued-play scenario rejects an intact
Manifest2 backup copy whose installation format is43. The UI explains the
incompatibility and asks the user to update SaltMarcher or choose a compatible
backup. Complete later-profile readback remains unchanged, and the protective
backup retains that same later work. The subsequent valid restore passes too.
This is a negative format fixture, not a claimed historical migration.
All processes exited zero; report and contents were audited before guest deletion.
Report `outputs/qualification-evidence/newer-backup-v3-run-1`: `2f59136292b5164bc1c5500f897d6818c104cd60c0cbeea9c9042bd424f41934`.

## Launcher recovery requalified, first batch

Both initial rollback boundaries passed two real process kills, an explicit
launcher-role marker, complete old/retained-new profile readbacks, retry,
continued play and restore/protective-backup comparison. Archive
`outputs/qualification-evidence/recovery-v3-run-1` was hash- and content-audited.

- `journal:rollback-started`: `d5b3f48e5e6a0746c46a7dc91fe9342dbf57137d44451f3b95ec3b3a9a7c87c6`
- `journal:rollback-preserving`: `31d716c18aa21a36b035b284c91f97e28aa148b827be2fd0152e40da5a4f0ddd`

Seven launcher recovery boundaries remain.

## Complete same-schema Release update

The distinct original 0.0.166/167 AppImages, both installation42/campaign42,
pass the full UI check/download/install/restart/continued-play/restore flow.
The complete seed equals target, restored and unchanged-source readbacks;
the protective backup retains all later work. This explicitly qualifies an
update with no schema change. All processes exited zero. Archive hashes and
semantic comparisons were checked before disposable guest deletion.
Report `outputs/qualification-evidence/same-schema-v3-run-1`: `7fe7c008b353ddc3897202e917d6dfec50d49a16fd86e46ec23eef386dd84a38`.

## Launcher recovery requalified, second batch

Two more double-kill boundaries passed complete old/retained-new readbacks,
retry, continued work and protected restore. Archive
`outputs/qualification-evidence/recovery-v3-run-2` was independently audited.

- `failed-data-preserved`: `003c23ccac081812acabeccf69e7e3abefb209e33e5cf37ba4a68e87272a8187`
- `journal:rollback-restoring`: `ca6ccba15014ff64d267ddfc4662ed894c45d65119bf88aa8092a3ab1903437d`

Four of nine launcher recovery boundaries are requalified; five remain.

## Launcher recovery requalified, third batch

The restored-data and rollback-program boundaries passed both real kills,
old/retained-new profile comparisons, retry, continued play and protected
restore. Archive `outputs/qualification-evidence/recovery-v3-run-3` was
independently hash- and content-audited before guest removal.

- `old-data-restored`: `7a5849c18a18dc3f0e654c0be97283070c928cc76f3fbf435e15464c2e097c78`
- `journal:rollback-program`: `e7158aaabce9a3f6a290448f41e59aec85a5491d1940d3d6189c3ee632774305`

Six of nine launcher recovery boundaries are requalified; three remain.

## Launcher recovery requalified, fourth batch

The program switch and durable rollback-history write pass both real kills
and all complete old/retained-new, continued-work and protected-restore
comparisons. Archive `outputs/qualification-evidence/recovery-v3-run-4` was
independently audited before guest removal.

- `program-linked`: `f615a7d647110d9fd41c15a4fe5cd84399498e955b40925ebb3867466b82120c`
- `rollback-history-written`: `21a85dfeb66215d5151b8a2fea283659f3b23a7bdf454b8effcae715cd7d4abf`

Eight of nine launcher recovery boundaries are requalified; rolled-back remains.

## Launcher recovery requalified, final boundary

`journal:rolled-back` passes both real kills and the complete old/retained-new,
continued-work and protected-restore comparisons. Independently audited archive:
`outputs/qualification-evidence/recovery-v3-run-5`; report SHA-256:
`3300562baa8629b4d1bf6eb806bb1fe5b2026770e18ffc6d7751e39e1daf56e1`.
All nine launcher recovery boundaries and eight forward activation boundaries
are requalified. Canonical handoff and Main promotion remain outstanding.

## Party history convergence: first schema-43 artifact pass

Original `0.0.160` (42/41) to `0.0.168` (43/43) passed the complete UI
update, continued XP change and protected restore. The independent snapshot
also proves the new Party history, receipt and installation-index chain in
all three campaign locations, including trash. Source content is unchanged.
Archive: `outputs/qualification-evidence/party-history-v3-run-1`.
Report SHA-256: `404d74a93949ce9f49b964afeb6d7b281462cb2846283f45cc08ba258846c42d`.
Other schema-43 baseline scenarios and canonical handoff/Main remain open.

## Candidate schema-42 convergence, interruptions and actual history restore

`0.0.167` (42/42) to `0.0.168` (43/43) passes the migration/committed/later-use
process kills, continued work and both restores. The second visible restore
recovers the actual XP history/receipt/index chain from the protective backup,
and itself preserves the previous complete state. All exported comparisons
were independently audited. Archive: `outputs/qualification-evidence/party-history-v3-run-2`.
Report SHA-256: `0c7560a0979f1481bdb1f2d4f71b1968f3559a5ae4ee736441b7fa30012e38f9`.

## Main schema-42 and same-schema-43 comparisons complete

Both full UI paths, rejection of a validly inventoried newer-format backup,
and actual restoration of protected XP/history pass. All exported values,
receipts, history chains and source invariance were independently audited.
Archive: `outputs/qualification-evidence/party-history-final-v3-run-2`.

- Main 43/42 → 43/43: `ff5f1d4bd0236f2bbc4b665a4135a385ef693d75ef9c06118b9a1e720e8e8030`.
- Same 43/43 → 43/43: `0df8b51e618ecad952a6b90e4288d441a5c4d0754cd422834ab006162abfab30`.

The original Main reader requires guest user namespaces; its exact failure
and successful resource hash are separately recorded. The guest restriction
was restored before the same-schema case. Host settings were unchanged.
Canonical handoff and Main promotion remain outstanding.

## Phase 5 qualified and promoted

Commit `4aa710b407ff6f4980b8da4fe7bf913fbee45370` passed complete candidate
Check `34697104219`, genuine canonical handoff in the bounded KVM guest, and
repeat invocation with unchanged reuse of all eight program/data/runtime phases.
Only the final inventory proof incorporates the additional invocation record.
Archive `outputs/qualification-evidence/canonical-handoff-v3-run-4` passed an
independent full hash/provenance/content audit. AppImage SHA-256:
`66b005ff004ce9d649f1b22c15d287000ce581ded2f956a639e02422b085763f`.
Receipt SHA-256:
`73d47abe703dfcb2f3c2428f9fda460bc52ff2d0ea60771c5158366803484b34`.
The same linear SHA was promoted through the canonical command; Main Check
`34698071688` and its promotion attestation passed. Phase 5 is complete.
User-desktop installation, manual live acceptance and public release remain open.
