# Frontend robustness FR2F2A root materialization audit

- Date: 2026-08-25
- Delivery baseline: `origin/main@fa05a081a223010af231c018be18e4fa4229e8e8`
- Sprint: `FR2F2A` from the
  [frontend robustness roadmap](../architecture/frontend-robustness-roadmap.md)
- Change class: application-build identity plus qualification and documentation
- Gate verdict: **FR2 remains open / no-go for FR3**

## Sources reviewed before implementation

- the complete frontend robustness roadmap and acceptance matrix, including
  the FR2 protocol, FR-A07, the FR2F1 manifest, and its audit;
- the original Electron roadmap, target architecture, current Campaign and
  Live Session requirements, and `program-technical-needs.md` (`TN-16`,
  `QS-05`, `RP-R`, and `RP-L`);
- the current Campaign bootstrap/version, Campaign lifecycle, import saga and
  adapters, Party, Location, Faction, NPC, fixture materializer, E2E suite
  registry, build-input classifier, and focused-check manifest;
- live `origin/main@fa05a081`, its green Main attestation run `32801194939`,
  the clean new candidate branch, and current open pull requests.

## Sprint split and implementation packet

The mandatory pre-phase trace showed that 20 Campaign registrations, five
installation dependencies, independent readbacks, and failure proof do not fit
one clean sprint. FR2F2 is therefore split into:

1. `FR2F2A`: root/import protocol;
2. `FR2F2B`: Live Play and spatial owners;
3. `FR2F2C`: preparation, economy, installation owners, and complete coverage.

This slice owns:

- one static, strict A/B artifact with distinct Campaign, source, Party,
  Location, Faction, NPC, relation, disposition, and lifecycle sentinels;
- export-hash, owner-subset, order, uniqueness, and partial-claim validation;
- clean-installation-only materialization through `CampaignImportService` and
  the real Campaign lifecycle, followed by explicit Campaign A activation;
- a separate readback module that closes and reopens storage, visits each
  Campaign without changing active authority, and reads fresh Party, Location,
  Faction, NPC, import-registry, saga, provenance, entity-mapping, schema, and
  runtime-table state;
- semantic comparison against the static bundles rather than materializer
  output, plus A/B identity isolation and a representative public-owner
  mutation that must invalidate the oracle;
- one standalone `qualify-current-format-root.ts --data-root <empty-root>`
  entrypoint that emits a machine-readable partial-claim receipt;
- correct qualification classification for every
  `scripts/qualification/**` input.

The covered Campaign registrations are exactly `campaign-runtime`,
`world-factions`, `world-locations`, `party`, `world-npcs`, `campaign-import`,
`schema-metadata`, and `schema-version`. The artifact carries the literal claim
`partial-fr2f2a-root-cohort-not-complete-current-format`.

## Dispatch, failure, reopen, and next-action trace

1. Strict fixture and manifest validation happens before opening a Campaign
   store. Invalid hashes or coverage cannot mutate installation state.
2. Materialization refuses any non-empty installation and validates both import
   bundles against current creature/reference truth before publishing A. A and
   B are then each applied through the import saga, which stages, validates,
   publishes, registers, and completes the real Campaign lifecycle.
3. The materializer activates A, closes every Campaign and installation
   connection, and returns only an identity receipt.
4. The independent reader creates a fresh `CampaignStore`, resolves A/B from
   the import registry, and uses `visitCampaignDatabase` so readback neither
   switches nor revises active Campaign state.
5. Every imported external identity must map to one unique internal identity;
   Party, Location, Faction, NPC, provenance, completed saga readbacks, and
   relations must match static bundle semantics.
6. Narrow read-only SQL is used only for the two initialize-only owners that
   expose no domain read API: empty `campaign_runtime`, empty fresh-install
   migration metadata, and exact `user_version`.
7. A mutation through `WorldLocationStore.update` after materialization causes
   the independent semantic assertion to fail. Current bytes cannot redefine
   expected truth.

FR2F2A introduces no renderer dispatch, warm-switch timing, focused-Scene
mutation, Travel route, or recovery replay.

## Negative findings and shortcuts

1. The initial repository classifier treated `scripts/qualification/**` as
   generic delivery tooling. That would let a future oracle-only edit escape
   the qualification fingerprint. This sprint adds the explicit qualification
   class and a regression test. The executable JSON artifacts under `docs/`
   had the analogous problem: documentation classification returned before
   qualification classification. They now carry both identities. Because the
   classifier is itself an app-build input, these corrections make the exact
   SHA app-relevant and require the canonical AppImage handoff.
2. Imported internal UUIDs are intentionally nondeterministic. The oracle does
   not pretend otherwise: it proves UUID uniqueness and relationship closure,
   while semantic expected values come only from the static bundles.
3. Import adapters currently cover only Party, Locations, Factions, and NPCs.
   This slice does not use import provenance as evidence for any other owner.
4. The import owner activates every imported Party member. Active/inactive
   Roster and Travel-state sentinels remain explicit `FR2F2B` work.
5. Structural bootstrap owners have no public read service. Their oracle uses
   three fixed read-only queries; no generic SQL fixture writer or dynamic
   table-name helper was added.
6. The static fixture uses system creature references. Installation-owned
   presets, Encounter Tables, symbols, biomes, and layout remain `FR2F2C` work.
7. This partial owner cohort is useful protocol evidence only. It is not the
   complete current Campaign format, production-route proof, timing evidence,
   `RP-R`, `RP-L`, `QS-05`, handoff evidence, or owner acceptance.
8. The combined A/B qualification root is not one cross-Campaign transaction.
   Semantic failures are eliminated by preflight and each import is atomic, but
   an external I/O failure after A commits can leave a partial dedicated root.
   Re-run deliberately refuses that root; the harness must preserve it as
   evidence or discard the dedicated root and start clean rather than resume
   ambiguously.

## Verification

- focused FR2F2A integration: 1 file and 5 tests passed;
- standalone CLI against a new temporary root: A/B semantic readback passed
  with 6 and 4 mapped entities, exact Campaign schema 34, and A active;
- invalid-B preflight, public-owner mutation, non-empty-target, coverage drift,
  and export-hash drift all fail closed;
- `pnpm check:frontend-robustness`: final run passed 26 files and 175 tests,
  including both TypeScript projects and the build-identity regression;
- the complete local `pnpm check` immediately before the bounded invalid-B
  preflight follow-up passed formatting, all lint partitions, both TypeScript
  projects, and 91/91 architecture tests. Its portable unit phase reproduced
  only the four unrelated host-sensitive failures already recorded by FR2D
  through FR2F1: three Encounter Generator settings tests exceeded their
  unchanged 30-second timeout and the 16-ms Reference Matcher gate measured
  32.893 ms. The result was 195/197 files and 803/807 tests. The final follow-up
  then passed its 14-test focused pair, ESLint, `git diff --check`, and the
  complete 26-file/175-test robustness gate including both TypeScript projects;
- the final focused count, remote Candidate check, exact-SHA AppImage handoff,
  and Main attestation are recorded at delivery time rather than predeclared
  here.

## Gate decision and follow-up

FR2F2A closes only the reproducible root/import cohort protocol. It does not
close FR2F2, FR-A07, TN-16, or QS-05.

- `FR2F2B` must add Live Play and spatial owner materialization/readback;
- `FR2F2C` must add the remaining preparation, economy, and installation
  owners and reject incomplete or duplicate manifest coverage;
- `FR2F3` retains focused-Scene next-action/restart and isolated Travel evidence;
- `FR2G` retains current-format production timing and explicit owner go/no-go;
- `FR7B` retains exact cross-OS `RP-R`/`RP-L` qualification.

FR3 remains no-go.
