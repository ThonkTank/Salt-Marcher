# Frontend robustness FR2F2B1 Live Play materialization audit

- Date: 2026-08-25
- Delivery baseline: `origin/main@ffc3112d462a8e2b6f5d6692a7f1efd6ecff3ba5`
- Sprint: `FR2F2B1` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)
- Change class: qualification and documentation only
- Gate verdict: **FR2 remains open / no-go for FR3**

## Sources reviewed before implementation

- the complete frontend robustness roadmap and acceptance matrix, including
  the FR2 protocol, FR-A07, the original Electron roadmap, and the target
  architecture;
- the FR2F1 manifest, FR2F2A fixture/protocol/audit, current Campaign bootstrap
  order, and live `origin/main@ffc3112d` with green Main attestation;
- current Live Session, Party, Scene, Encounter, Hex, and Travel requirements,
  plus `TN-16`, `TN-21`, `QS-05`, `RP-R`, and `RP-L`;
- `CampaignStore`, `CampaignImportService`, `PartyStore`, `SceneStore`,
  `LivePlayService`, `CombatService`, `HexMapStore`, `HexTravelService`, the E2E
  fixture materializer, current integration journeys, focused-check manifest,
  workspace input classification, and current open pull requests.

## Sprint split and implementation packet

The pre-phase dispatch trace confirmed that Live Play and spatial state do not
fit one clean sprint. Scene/Combat use revisioned aggregate commands, while Hex
and Travel additionally couple sparse map revisions, Party position, Scene
time, a controlled clock, and journey lifecycle. `FR2F2B` is therefore split:

1. `FR2F2B1`: Live Play Scene/Combat plus Party/Location semantic extension;
2. `FR2F2B2`: Hex/Travel plus Party/Location/Scene spatial extension.

This slice owns:

- one strict static A/B Live fixture whose primary owner coverage is exactly
  `scene` and `combat`, in Campaign bootstrap order;
- explicit extension of the already-covered `world-locations` and `party`
  roots without double-counting either registration;
- one added inactive character, one imported active and assigned character,
  the publicly bootstrapped standard Scene, a distinct focused Location, one
  active and one archived Group, living/dead member state, and one non-empty
  initiative-phase Combat per Campaign;
- preflight of roles, coverage, root identity, external references, semantic
  identities, Group constraints, Creature references, and immutable expected
  snapshot hashes before root publication;
- materialization through `LivePlayService` only after the FR2F2A public import
  path has published A/B; no fixture SQL writes;
- a separately opened reader that obtains each complete `LiveSessionSnapshot`
  through `LivePlayService`, normalizes every generated UUID to a static
  semantic identity, rejects any unaccounted raw UUID, and compares a canonical
  hash of the entire normalized snapshot;
- readable revision/count/location/phase sentinels in addition to full-snapshot
  hashes, exact materializer-receipt identity readback after reopen, A/B UUID
  isolation, and a public Group mutation that must invalidate the oracle;
- a standalone `qualify-current-format-live.ts --data-root <empty-root>` receipt
  with the literal partial claim
  `partial-fr2f2b1-live-cohort-not-complete-current-format`.

## Dispatch, failure, reopen, and identity trace

1. The manifest, root fixture, and complete Live A/B fixture are parsed and
   cross-validated before the empty installation is opened for mutation.
2. FR2F2A imports A/B through `CampaignImportService`, activates A, and closes
   all connections.
3. A new `CampaignStore` resolves each imported Campaign by source identity and
   visits its database without changing installation switch authority.
4. The explicit qualification adapter gives `LivePlayService` that one visited
   database. It creates the inactive character, assigns imported active Party
   members, sets the focused Location, saves active/archived Groups, archives
   the configured Group, and prepares initiative Combat through public owner
   methods.
5. The materializer closes and returns identities only. A separate reader
   reopens root storage, repeats root semantic readback, then reads each complete
   `LiveSessionSnapshot` through a fresh `LivePlayService`.
6. Imported Party/Location mappings, the added Party receipt, standard Scene,
   Groups, entries, members, Combat, and embedded command-row identities are
   normalized to static semantic keys. Any UUID not explicitly accounted for
   fails qualification rather than disappearing from the digest.
7. Static A/B hashes cover every normalized snapshot field. The identity
   receipt separately proves that exact generated Campaign, Scene, Party,
   Group, and Combat identities survived reopen.
8. Readback must leave registry revision and active Campaign unchanged; A
   remains installation authority throughout.

## Post-implementation negative findings and shortcuts

1. The materializer uses the explicit fixed-database qualification adapter
   inside `visitCampaignDatabase`. This proves real domain owners and bytes, but
   not Renderer -> Preload -> Utility production switching. FR2F2B1 is not a
   production-route warm-switch result.
2. The current product has no public command to create a second Running Scene.
   The fixture correctly retains only the bootstrapped standard Scene; the M3
   absence remains open and direct SQL is not substituted as evidence.
3. Combat stops in the non-empty initiative phase. It proves persisted Combat
   selection and sources, not rapid turns, damage, resolution, or Loot. Those
   are FR3 guarantees, not a hidden expansion of this FR2 qualification slice.
4. `PartyStore` generates character identities internally and exposes no
   client-provided semantic key. The additional inactive character is located
   by a fixture-validated unique name, while its generated UUID is separately
   retained in and checked against the materialization receipt. This is more
   awkward than imported entity mappings but does not weaken identity proof.
5. Full-snapshot hashes are intentionally fail-closed but opaque during manual
   diagnosis. Readable sentinels identify common drift; deeper drift requires
   inspecting the exposed `semanticProjection` in the focused test/readback.
6. `world-locations` and `party` already have primary FR2F2A coverage. B1 only
   extends their semantics and assigns primary coverage solely to `scene` and
   `combat`; B2 must follow the same rule for `hex` so FR2F2C can enforce one
   primary disposition per manifest registration.
7. Root plus Live materialization is not one cross-Campaign transaction.
   Semantic errors in both A/B Live descriptions are preflighted before root
   publication, but an external runtime/I/O failure after root or Live A
   commits can leave the dedicated qualification root partial. Re-run refuses
   it; preserve it as evidence or discard that dedicated root and restart.
8. The fixed Creature and generator defaults influence initiative rows. Their
   drift changes the static complete-snapshot hash and therefore requires an
   explicit fixture review rather than silently blessing new current behavior.
9. Hex maps, Party travel position, Scene time progression, active/paused
   journey state, renderer dispatch, warm-switch timing, focused-Scene next
   mutation, SwiftShader, handoff, and owner acceptance remain absent by design.

## Verification

- the standalone CLI against a new temporary installation reproduced A/B with
  Party revision 3, Scene revision 5, Combat revision 0, A hash
  `cbb66a99d3c72a5e9dd51c5f4bec562026346a7e56e23a2a7271238be7305034`,
  B hash
  `fdede16729f51f3bd282d5527265867c6d61184c4d444f7f25a9f0478afc6038`,
  exact A authority, and semantic readback true;
- focused root plus Live integration: 2 files and 9 tests passed, including
  invalid-B preflight, public-owner mutation, coverage/root/hash drift, exact
  receipt identity after reopen, complete semantic hashes, and A/B isolation;
- `pnpm check:frontend-robustness`: 27 files and 179 tests passed, including
  both TypeScript projects;
- the complete local `pnpm check` passed formatting, every lint partition,
  both TypeScript projects, and 91/91 architecture tests. Its portable unit
  phase reproduced only the four unrelated host-sensitive failures already
  recorded from FR2D through FR2F2A: three Encounter Generator settings tests
  exceeded their unchanged 30-second timeout and the 16-ms Reference Matcher
  gate measured 30.897 ms. The result was 195/197 files and 803/807 tests;
  no failing test imports the new fixture, protocol, reader, or integration
  test, and no timeout or threshold was weakened;
- final diff validation, remote Candidate result, and Main attestation are
  recorded at delivery time rather than predeclared here.

## Gate decision and follow-up

FR2F2B1 closes only the reproducible Live Play Scene/Combat owner protocol. It
does not close FR2F2B, FR2, FR-A07, TN-16, or QS-05.

- `FR2F2B2` must add Hex/Travel public-owner materialization and independent
  controlled-clock spatial readback;
- `FR2F2C` must add preparation, economy, installation owners and exact
  one-primary-coverage enforcement across the complete manifest;
- `FR2F3` retains the focused-Scene next-action/restart oracle and isolated
  Travel/SwiftShader disposition;
- `FR2G` retains current-format production timing and explicit owner
  architecture go/no-go;
- `FR7B` retains exact cross-OS `RP-R`/`RP-L` qualification.

FR3 remains no-go.
