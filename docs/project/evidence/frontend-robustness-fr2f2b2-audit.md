# Frontend robustness FR2F2B2 spatial materialization audit

- Date: 2026-08-25
- Delivery baseline: `origin/main@02a0e9c2e25700489157a017806b7cfeaa4c6134`
- Sprint: `FR2F2B2` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)
- Change class: qualification plus app-relevant post-phase robustness follow-up
- Gate verdict: **FR2 remains open / no-go for FR3**

## Sources reviewed before implementation

- the complete frontend robustness roadmap and acceptance matrix, including
  the FR2 protocol, FR-A07, TN-16, TN-21, QS-05, RP-R, and RP-L;
- the original Electron M1/M3/M4 migration intent, target architecture Hex and
  Travel boundaries, current product requirements, and current green
  `origin/main@02a0e9c2`;
- the FR2F1 owner manifest, FR2F2A root fixture/protocol/audit, FR2F2B1 Live
  fixture/protocol/audit, focused-check manifest, and current open pull
  requests;
- `CampaignStore`, `HexMapService`, `HexMapEditingCommandHandler`,
  `HexMapStore`, `HexEditJournalStore`, `HexTravelService`, `HexTravelStore`,
  `PartyStore`, `SceneStore`, `WorldLocationStore`, `LivePlayService`, their
  shared contracts, Utility Hex composition, and current spatial integration
  tests.

## Sprint sizing and implementation packet

The mandatory pre-phase review kept `FR2F2B2` as one sprint. The manifest has
one primary owner registration, `hex`, while a meaningful Travel readback
requires the same publicly authored map, Location placement, Party position,
Scene time, and journey. Splitting those operations would close neither half
independently and would misrepresent one owner as two guarantees.

This slice owns:

- one strict static A/B spatial fixture whose primary owner coverage is exactly
  `hex` and whose semantic extensions are exactly `world-locations`, `party`,
  and `scene`;
- per Campaign, one named map, a three-tile adjacent route, one far sparse tile
  in another chunk, one mapped root Location at the first checkpoint, exact
  command identities, and readable expected revisions;
- public map creation, route painting, sparse painting, and Location placement
  through `HexMapEditingCommandHandler`; no fixture SQL writes;
- public Party positioning, route evaluation, Travel start, controlled-clock
  advancement to exactly one boundary, and a paused A versus still-travelling
  B through `HexTravelService`;
- a separately opened readback through fresh Live, Hex, editing, and Travel
  owners, including the complete updated Live Session, map catalog, every
  declared authored chunk, used biome definitions, edit history, all command
  receipts, journey, runtime overlay, and next-boundary delay;
- normalization of every generated UUID to a static semantic identity, raw-UUID
  rejection, canonical complete-projection hashes, readable sentinels, exact
  materializer-receipt readback, and A/B identity isolation;
- fail-closed preflight for coverage, upstream identities, external references,
  adjacency, sparse separation, passability, Party speed, controlled boundary,
  journey state, and semantic hashes before publication;
- public Hex and Travel mutations that must invalidate the oracle;
- a standalone `qualify-current-format-spatial.ts --data-root <empty-root>`
  receipt with the literal partial claim
  `partial-fr2f2b2-spatial-cohort-not-complete-current-format`.

## Dispatch, failure, reopen, and identity trace

1. The owner manifest and complete root, Live, and spatial A/B fixtures are
   parsed and cross-validated before the empty installation is mutated.
2. The established FR2F2A and FR2F2B1 public materializers publish A/B root and
   Live truth, leave A active, close their connections, and return identities.
3. A new `CampaignStore` resolves each Campaign by import source identity and
   visits its database without changing installation switch authority.
4. An explicit qualification owner factory composes the real editing command
   handler from its Unit of Work, map, journal, Travel, Party, Scene, and
   Location stores. It executes four receipt-backed spatial commands.
5. `HexTravelService` positions the focused Scene Party, evaluates the authored
   route, starts the journey, and advances a fixture-owned clock to exactly the
   first segment boundary. A is then paused; B remains travelling with its next
   boundary scheduled.
6. The materializer closes and returns generated identities plus command IDs
   only. A separate reader reopens root and both Campaign databases, repeats
   root readback, and uses fresh public domain services.
7. The reader covers Live state plus catalog, all fixture-authored chunks,
   biome definitions, history, command receipts, Travel, overlays, and boundary
   delay. It also re-applies the complete FR2F2A root oracle after masking only
   the newly qualified imported-Party Travel positions. Imported, Live,
   spatial, and command identities are replaced with static semantic keys; any
   remaining raw UUID fails qualification.
8. Static A/B hashes cover the complete normalized projections. The identity
   receipt separately proves that exact generated Campaign, Scene, map, and
   receipt identities survived reopen. Registry revision and active Campaign
   must remain unchanged throughout.

## Post-implementation negative findings and shortcuts

1. The materializer uses an explicit fixed-database qualification adapter
   inside `visitCampaignDatabase`. This proves the real domain owners and
   persisted bytes, but not Renderer -> Preload -> Utility production
   switching. FR2F2B2 is not production-route evidence.
2. The Domain `HexMapService.readChunks` returns stored map/chunk truth, while
   the Utility operation handler enriches it with the referenced biome
   definitions required by the public IPC result. The reader reproduces that
   deterministic composition with the built-in biome catalog. This adapter
   difference is explicit and its definitions are hashed; it is not evidence
   that the Utility route was exercised.
3. `HexTravelService.position` and `start` both persist Party position and Scene
   Location even when those values are unchanged. Together with the boundary
   tick this increases the B1 Party revision from 3 to 6 and Scene revision
   from 5 to 8. The fixture records current behavior so drift fails closed, but
   does not bless the redundant writes as target architecture; their ownership
   should be simplified during the production Hex/Travel cutover.
4. The current product still exposes only the bootstrapped standard Running
   Scene. This qualification extends that Scene spatially; it does not satisfy
   the original M3 second-Scene intent.
5. Each Campaign has one map and four authored tiles across two sparse chunks.
   That is sufficient for a deterministic current-format owner oracle, not for
   RP-R/RP-L large-population or cross-OS performance qualification.
6. Readback requests every chunk derivable from the static materializer. The
   public catalog does not enumerate all persisted chunk keys, so completeness
   relies on starting from a dedicated empty root and allowing only the public
   materializer to author it. This is weaker than arbitrary existing-profile
   discovery and must not be generalized into a production migration reader.
7. A/B clocks use fixed historical millisecond values and B remains travelling
   only relative to that controlled clock. This proves deterministic lifecycle
   persistence and boundary math, not wall-clock scheduling in the packaged
   application.
8. Root, Live, and spatial materialization are not one cross-Campaign
   transaction. Semantic errors for both A/B spatial descriptions are
   preflighted before root publication, but an external runtime/I/O failure
   after earlier commits can leave the dedicated qualification root partial.
   Preserve it as evidence or discard only that dedicated root and restart.
9. Built-in biome labels, colors, passability, and travel costs influence the
   complete hashes. Any legitimate catalog change therefore requires explicit
   fixture review rather than silently blessing new current behavior.
10. Full-projection hashes are intentionally fail-closed but opaque during
    diagnosis. Readable map, chunk, receipt, revision, position, time, journey,
    and overlay sentinels identify common drift; deeper drift requires
    inspecting the exposed semantic projection.
11. No renderer dispatch, warm-switch duration, focused-Scene next mutation,
    restart scheduling, SwiftShader disposition, app handoff, or owner
    acceptance is claimed. Those gates remain in FR2F3, FR2G, and FR7B.
12. The first post-phase review found that spatial readback reopened the
    FR2F2A root but did not re-assert its content because imported Party Travel
    positions legitimately differ from the root fixture. The follow-up now
    masks only that qualified field for mapped Party members and re-applies the
    complete root oracle. A public Location-notes mutation proves unrelated
    root drift still fails; no later phase is used to hide this omission.
13. The first exact-SHA Candidate run
    [32819591384](https://github.com/ThonkTank/Salt-Marcher/actions/runs/32819591384)
    failed only `Linux Visual · goldens-campaign`; every root job and every
    other downstream E2E/Visual job passed. Failure artifact readback proved
    that `Verfallener Turm` had been deleted from the Location table while the
    Scene still contained its now-dangling Location identity. The rendered
    Session nevertheless still showed the deleted label. This is a real stale
    Renderer projection, not failed persistence and not a visual-golden drift.
14. Root cause is the former route-local ownership boundary: Location deletion
    commits in Utility, then the Catalog route unmounts and cancels its
    hook-local latest-only coordinator before its follow-up Session refresh can
    publish. `CampaignWorkspaceProjection` already outlives both routes, but
    previously did not consume the existing identity-bound `session.changed`
    channel. A blind retry was rejected because it would preserve this race.
15. The follow-up publishes `projection-invalidated` after public Location
    catalog save/delete commits and makes the provider-lived Campaign workspace
    owner refresh only the matching active Campaign Session. It neither polls
    nor remounts the application and ignores inactive-Campaign events. The E2E
    path also waits for the preceding Scene-location command to become visible
    before starting deletion, so two independent writes are not accidentally
    overlapped by the test.
16. The invalidation intentionally performs one coarse complete active-Session
    read instead of synthesizing a partial Location patch. It does not yet
    provide a joint Location/Session command receipt, and asynchronous refresh
    failure retains the projection owner's existing failure/cached-state
    behavior rather than adding a new user-facing error surface. Those are
    bounded later owner/receipt concerns; this follow-up claims only removal of
    the demonstrated cross-route stale projection.

## Verification

- the standalone CLI against a new temporary installation reproduced A/B,
  exact A authority, four authored tiles and four applied command receipts per
  Campaign, A paused at `(1,0)` with Party revision 6, Scene revision 8,
  Travel revision 2, game time 32400, and hash
  `5b125785743dd73313874cb716171d68a1de704b867e56da2a0195a6e159bb42`;
  B remained travelling at `(5,-3)` with Party revision 6, Scene revision 8,
  Travel revision 1, game time 46080, next-boundary delay 2400, and hash
  `14a9d77307f54834c527e4a069ed55c114f9d5ead3376805dbc33aa0d6c1aeb8`;
- focused root plus Live plus spatial integration: 3 files and 15 tests passed,
  including invalid-B preflight, public Hex, Travel, and Location mutations,
  root preservation, coverage and identity/hash drift, exact receipt identity
  after reopen, complete semantic hashes, and A/B isolation;
- targeted projection, Utility-event, and architecture verification: 3 files
  and 21 tests passed, covering matching active-Campaign refresh,
  inactive-Campaign isolation, disposal/unsubscription, exact event Campaign,
  Scene, revision, reason, and both Location publisher callsites;
- after the post-phase follow-up, `pnpm check:frontend-robustness`: 28 files and
  186 tests passed, including both TypeScript projects and the provider-lived
  invalidation plus publisher-wiring architecture coverage;
- the final complete local `pnpm check` passed formatting, every lint
  partition, both TypeScript projects, and 91/91 architecture tests. On the
  same overloaded host that timed out both direct Visual scenarios, its
  portable unit phase ended at 195/197 files and 802/809 tests: five unchanged
  30-second timeouts in the previously recorded Encounter Generator settings
  suite, one follow-on duplicate Escape callback in that same file after the
  timeouts, and the 16-ms Reference Matcher gate at 66.015 ms. All 30 directly
  affected provider tests passed together; all 186 focused robustness tests
  passed. No failing test imports the changed projection/event code or spatial
  qualification, and no timeout, threshold, worker count, or product behavior
  was weakened to obtain a local green result;
- the qualification-only SHA retained baseline app-build input fingerprint
  `00e52f0d9d8d3f826d5aef5e1080d4b08e29af23cacafc8230b25e447da64ea1`.
  The robustness follow-up changes production Renderer and Utility inputs and
  therefore produces fingerprint
  `f4a545959738c83b8ee3c88ed2b62df55d021ffa992ed46bc8984140917e63c6`;
  an exact-SHA canonical application handoff is mandatory before promotion;
- a direct local `goldens-campaign` run was attempted without `xvfb` on the
  desktop host. It failed first in the unchanged preceding Hex Map scenario
  through repeated 30-second Renderer and screenshot timeouts. This host-bound
  run is not used as functional proof; the exact-SHA remote Visual job remains
  authoritative for the corrected Campaign Combat path;
- formatting and diff validation passed; remote Candidate result and Main
  attestation are recorded at delivery time rather than predeclared here.

## Gate decision and follow-up

FR2F2B2 closes only the reproducible Hex/Travel spatial owner protocol. It does
not close FR2F2, FR2, FR-A07, TN-16, TN-21, or QS-05.

- `FR2F2C` must add preparation, economy, and installation owners and enforce
  exactly one primary disposition for every manifest registration;
- `FR2F3` retains the focused-Scene next-action/restart oracle and isolated
  Travel/SwiftShader disposition;
- `FR2G` retains current-format production timing and explicit owner
  architecture go/no-go;
- `FR7B` retains exact cross-OS RP-R/RP-L qualification.

FR3 remains no-go.
