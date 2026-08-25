# FR2F2C2A economy and installation audit

Date: 2026-08-25

Baseline: `e4b779fe7d9e7b5d693176bf69823e39f2f53d53`

Verdict: closed as partial `FR2F2C` evidence; the complete Current-Format gate
remains open for `FR2F2C2B`.

## Reviewed current truth

- The Current-Format manifest still has 20 Campaign registrations and five
  installation dependencies.
- The primary fixtures through `FR2F2C1` cover 16 Campaign registrations and
  three installation dependencies.
- `legacy-items`, `loot`, `character-loot`, and
  `world-location-save-journal`, plus the biome/symbol and Session-layout
  installation dependencies, remained without primary evidence.
- Combining stable economy truth, controlled save interruption, reconciliation,
  and the global exact-one gate in one sprint would not produce an independently
  reviewable guarantee. The former `FR2F2C2` is therefore split into this stable
  economy cohort (`FR2F2C2A`) and the interruption/completion cohort
  (`FR2F2C2B`).

## Closed guarantee

The static A/B economy fixture covers these primary Campaign owners:

- `legacy-items`;
- `loot`;
- `character-loot`.

It also covers the remaining stable installation dependencies
`installation.biomes-and-symbols` and `installation.session-layout`.
Materialization starts with the complete preparation fixture and then uses the
public production owners to:

- parse and install one shared narrow-SVG Location symbol;
- persist one schema-v2 Session layout;
- create one distinct symbol-bearing Location and legacy item definition in
  each Campaign;
- create a manual Location-anchored Treasure with two legacy items;
- accept one generated reward into the unplaced Loot inbox; and
- atomically allocate one manual item to the active character, producing a
  partial Treasure and one Character Loot ledger entry.

Independent reopen reads settings, symbols, system Biomes, Locations, legacy
definitions, Scene Loot, inboxes, Treasures, and Character ledgers through their
public owners. Campaign A remains active. Campaign-owned identity sets are
disjoint; only explicitly shared installation identities may occur in both
Campaigns.

The complete normalized projections retain these reproducible semantic hashes:

- Campaign A:
  `6afb33f3b9c110790aa17b573a114a499e0ca7dc1cbc4c60c63df0e6114d267d`;
- Campaign B:
  `60a0b6834769aa1b3e5854c3d4febe1c0bdb2c09a3f8e0dbbd506059f12dde11`.

The new Location appears in the complete Live location choices and Planner
available locations, and accepted generated Loot appears as Planner
`placedTreasure`. The older Spatial and Preparation semantic projections remove
only those explicitly discovered, singular downstream identities before
checking their historical hashes. Their raw reopen snapshots remain intact,
and the C2A oracle separately checks and hashes the added relations. Raw UUID
failures now report their exact projection path.

## Negative audit

The focused protocol rejects:

- duplicate A/B legacy-definition identities and incorrect manifest coverage
  before Campaign publication;
- a public Treasure move away from its expected Location;
- a public Character Loot ledger correction;
- a public rename of the shared installation Location symbol;
- removal of the shared symbol reference from Campaign Location data; and
- a public installation Session-layout mutation.

Two independently created data roots produced different Campaign, Treasure,
Location, and ledger UUIDs but the same A/B semantic hashes. All seven focused
tests pass, including the six controlled-negative cases.

## Deliberately open

- `world-location-save-journal` is intentionally not treated as stable fixture
  truth. Its interrupted-save and reconciliation journey belongs to
  `FR2F2C2B`.
- The manifest-wide exact-one primary-disposition gate remains mandatory in
  `FR2F2C2B`; this packet still claims only partial Current-Format evidence.
- System Biomes are read and matched to the Biomes used by the spatial fixture;
  bundled system definitions are not mutated.
- The fixture accepts one generated reward, not every generated reward in the
  Planner workspace.
- This is a qualification adapter around production owners, not a renderer to
  preload to utility production switch or a visible UX journey.
- Cross-Campaign materialization is not one atomic transaction. Fixture
  validation fails before publication, but an operational failure between
  Campaign writes could leave a diagnostic partial data root.
- No restart, process-loss, production-size, latency, resource-cycle,
  cross-platform, or manual UI evidence is claimed.

## Proof packet

- `pnpm typecheck`
- `pnpm exec vitest run tests/integration/current-format-economy-qualification.test.ts`
  (`7/7` tests)
- two clean-root executions of
  `pnpm exec tsx scripts/qualify-current-format-economy.ts --data-root <root>`
  with matching semantic hashes
- `pnpm check:frontend-robustness` (`30/30` files, `199/199` tests)
- `pnpm check`: formatting, all lint partitions, typecheck, and architecture
  tests passed; the portable Unit phase stopped with `804/809` tests green.
  The unchanged 16 ms Reference Matcher budget measured `49.294 ms`, and four
  unchanged Encounter Generator Settings UI tests timed out at 30 seconds.
  These are the same host-sensitive files and failure classes recorded by the
  preceding C1 audit; neither they nor their production paths are changed by
  this packet. The clean Candidate CI run remains the delivery gate.

## Publication integrity follow-up

Candidate SHA `de8092203ff9b50ea663b6c9b968c2da629c3681` passed the complete
Candidate run `32841168382`. GitHub rebase-merge then rewrote only its committer
and commit time to `4a30105e7e21b680186edc4c10d7c3c3f1c8cb52`; both commits have parent
`e4b779fe7d9e7b5d693176bf69823e39f2f53d53` and tree
`0f1af37b39260cbac11859e3f16d06a31f01c157`. The protected Main rule correctly
rejected a force-with-lease correction.

This documentation-only follow-up is therefore based on the current Main and
must itself pass Candidate CI before its exact unchanged SHA is pushed as a
non-forced Main fast-forward. Rebase-merge is not used for that correction.

This packet changes qualification scripts, tests, evidence, and roadmap text
only. It is not app-relevant and therefore uses the documentation/test delivery
path rather than an application handoff.
