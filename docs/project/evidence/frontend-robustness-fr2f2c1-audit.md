# FR2F2C1 preparation-owner audit

Date: 2026-08-25

Baseline: `74a628b98c37d12fbac6d3940a6ff8700322945f`

Verdict: closed as partial `FR2F2C` evidence; it does not close the complete
Current-Format gate.

## Reviewed current truth

- The Current-Format manifest has 20 Campaign registrations and five
  installation dependencies.
- `FR2F2A` is the primary fixture for eight root/import registrations,
  `FR2F2B1` for Scene and Combat, and `FR2F2B2` for Hex.
- Nine Campaign registrations and four installation dependencies still lacked
  a primary fixture before this sprint.
- The single planned `FR2F2C` packet was too large for one independently
  reviewable guarantee. It is therefore split into preparation (`FR2F2C1`) and
  economy/completion (`FR2F2C2`).

## Closed guarantee

The static A/B preparation fixture covers these primary Campaign owners:

- `campaign-rules`;
- `encounter-plans`;
- `encounter-tables`;
- `session-generation`;
- `session-planner`.

It also covers the shared dependencies
`installation.generator-presets` and `installation.encounter-tables`.
Materialization uses the public owners to create and assign two distinct custom
Generator Presets, update Campaign Rules, create Campaign Encounter Tables,
save Planner input, run a deterministic preparation, and persist generated
Encounter Plans. One installation-scope Encounter Table is referenced from one
mapped Campaign Location in each Campaign through `WorldLocationService`.

Independent reopen reads the installation owners and every covered Campaign
owner again. It proves the active Campaign authority stayed on A, the two
Campaign identity sets remain disjoint except for the explicitly shared
installation table, and the complete normalized projections retain these
reproducible semantic hashes:

- Campaign A:
  `96a5de32ad7588fe8ba43b895cdb0df33b99b5c491349e56b54d1877887ffb5c`;
- Campaign B:
  `916833f21e8dc77e66983fc218d0ec9118f540717ca589a09ec42599df79f123`.

The older spatial oracle masks only the new shared Encounter-Table reference
on the explicitly selected Location. It still checks all other root, Live, Hex,
Travel, Party, Scene, and Combat truth without weakening their sentinels.

## Negative audit

The focused protocol rejects:

- duplicate A/B preset identities and wrong manifest coverage before a
  Campaign is published;
- a public Campaign Rules mutation after materialization;
- a public installation Generator Preset reassignment;
- a public mutation of the shared installation Encounter Table;
- removal of the shared Encounter Table from Campaign Location data.

Two independently created data roots produced different runtime UUIDs but the
same A/B semantic hashes. Timestamp fields are normalized because the current
Preset and Planner journal owners do not accept an injected clock. The
generation `originFingerprint` and preparation `encounterBatchFingerprint` are
first required to be 64-character hexadecimal values and then represented as
identity-bound tokens because their input includes intentionally random owner
identities.

## Deliberately open

- This is a qualification adapter around production owners, not a renderer to
  preload to utility production switch journey.
- The worker is invoked synchronously after the durable start receipt. Restart,
  cancellation, delayed completion, and scheduler behavior remain assigned to
  `FR2F3` and `FR5C`.
- Both custom presets currently clone the default configuration. This proves
  distinct identities, assignment, persistence, and effective-config routing,
  not diverse generator tuning.
- Generated rewards remain generated Planner references. Acceptance into
  Treasure, allocation, and character ledgers belongs to `FR2F2C2`.
- `legacy-items`, `loot`, `character-loot`, and
  `world-location-save-journal`, plus the remaining installation dependencies,
  are not covered here.
- Cross-Campaign materialization is not one atomic transaction; fail-closed
  fixture validation happens before publication, while an operational failure
  between Campaign writes could leave a diagnostic partial data root.
- No production-size profile, resource-cycle, cross-platform, or manual UI
  evidence is claimed.
- Exact-one primary disposition across every manifest entry remains the
  mandatory `FR2F2C2` completion gate.

## Proof packet

- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run tests/integration/current-format-preparation-qualification.test.ts`
  (`6/6` tests)
- two clean-root executions of
  `pnpm exec tsx scripts/qualify-current-format-preparation.ts --data-root <root>`
  with matching semantic hashes
- `pnpm check`: formatting, all lint partitions, typecheck, and architecture
  tests passed; the portable Unit phase stopped with 804/809 tests green. One
  unrelated 16 ms Reference Matcher budget measured about 34 ms, and four
  unrelated Encounter Generator Settings UI tests timed out at 30 seconds.
  An isolated one-worker rerun reproduced only those same five host-sensitive
  failures (11/16 tests green). Neither of the affected test files nor their
  production paths is changed by this packet. The clean Candidate CI run
  remains the delivery gate.

This packet changes qualification scripts, tests, evidence, and roadmap text
only. It is not app-relevant and therefore uses the documentation/test delivery
path rather than an application handoff.
