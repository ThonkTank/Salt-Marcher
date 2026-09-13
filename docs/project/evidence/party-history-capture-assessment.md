# Party history capture assessment

Decision: **a bounded follow-up optimization is justified; no production change
is made by this investigation.** The cost is mainly reading and comparing
unaffected combat/travel state, rather than persisting the small XP/preference
change. The current implementation remains in place until a separately scoped
implementation preserves its atomicity, side effects and conflict checks.

Evidence: [complete samples and source hashes](party-history-measurement.json).
Measurement checkout is `1c5aed433edf30a1c919867c03239b371d79c621`.
Its application inputs match current Main `6267594b27d479ecf9cacdd46f9ad71e9b129837`
exactly (`ab74d3e623f229024d7c4e5def829fa1097d3e808ece6b12d5e038a701ef45e7`).
This complete series was repeated after Main's campaign-schema-44 migration;
prior-baseline measurements remain historical diagnostics in the execution log.
All 576 measured real actions committed and were followed by successful real
Undo. Assertions verified the intended payload, restored selected character and
scene count, preserved every unrelated combat/journey, and included both source
combat and source travel in move history whenever those states existed.

## Reproduction and measurement boundary

Run `corepack pnpm exec tsx tests/performance/party-history-measure.ts --output /tmp/party-history-measurement.json`.
An individual fixture can be selected with `--case source-only`; `--warm 7`
is the default. Every fixture uses disposable databases; no installed profile
is opened. Source-file SHA-256 values in the JSON identify the exact harness.
No application source instrumentation is shipped.

Environment: Linux 6.17.1-300.fc43.x86_64, Ryzen 5 5600X (12 logical CPUs),
Node 22.22.2, better-sqlite3 13.0.2 / SQLite 3.53.4, Zod 4.4.3 and pnpm 10.15.1.
One first action on a reopened database/service and seven repeated actions are
recorded per case/action/mode. Module loading, fixture construction, profile
opening and input/validation reads are outside the action timer; `seedMs` and
`openMs` record construction/opening separately. **First does not mean cold OS
cache or a fresh JavaScript process.** The same process advances through cases.
Undo outside the timed region restores the domain setup. Revisions, receipts
and resumed journey timestamps advance normally; each next action discards the
single undone branch, so this does not benchmark a full 100-entry Party history.

The timed boundary is the actual PartyActionService call until it returns,
including domain work, owner capture/comparison, journal/index persistence and
returned projections. It excludes IPC, renderer refresh and user-perceived
end-to-end latency. Both profiled and uninstrumented series use identical
fixture parameters and repeat counts, with fresh profiles for each series.
Controls run after their profiled counterpart; cache/JIT/order and scheduling
variation remain, so their difference is a diagnostic overhead estimate, not
an exact correction factor. Reported medians use seven repeated samples;
first values and all outliers remain in the JSON. No universal latency SLO or
statistical significance claim is inferred from these synthetic fixtures.

Read counts are executed prepared SELECT/get/all calls; rows are values
returned into JavaScript, counting repeat reads again. They are not unique
records, physical SQLite page scans or disk I/O. Prepared writes are counted
separately. Native transaction controls are timed as transaction boundaries,
not counted as prepared reads/writes. Unexpected exec/pragma/iterator paths
fail the profiler closed. Two independent SQLite oracle tests verify counts,
exclusive nested phases, native transaction modes and method restoration.

## Fixtures and observed action times

Four level-5 characters are active in the source scene; the remaining roster is
inactive/unassigned. Each XP action adds 25 to one character, quick fields select
`level`, short rest targets that same character (700 consumed XP initially), and
move transfers that character into a newly created scene. Nonempty fixtures
contain a source combat and journey plus the indicated foreign states. Foreign
combats retain only enemies after the party has left; foreign journeys are
paused. Source combat has four party members plus the listed enemies.
History entries contain member-state inverses; paths use real painted map cells.

| Fixture | Characters | Scenes | Foreign combats + journeys | Enemies per combat | Combat history entries | Path points |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `small` | 6 | 2 | 0 + 0 | 0 | 0 | 0 |
| `roster` | 100 | 2 | 0 + 0 | 0 | 0 | 0 |
| `scenes` | 6 | 100 | 0 + 0 | 0 | 0 | 0 |
| `state-control` | 6 | 12 | 0 + 0 | 0 | 0 | 0 |
| `states-small` | 6 | 12 | 10 + 10 | 4 | 2 | 10 |
| `source-only` | 6 | 12 | 0 + 0 | 20 | 20 | 200 |
| `states-deep` | 6 | 12 | 10 + 10 | 20 | 20 | 200 |
| `combined-source-only` | 100 | 100 | 0 + 0 | 20 | 20 | 200 |
| `combined` | 100 | 100 | 50 + 50 | 20 | 20 | 200 |

`source-only` matches the source state of `states-deep`, and
`combined-source-only` matches `combined`, with zero foreign states. Empty
fixtures contain no source combat/journey. These pairs isolate foreign-state
cost while holding the selected character, source state and scene count fixed.

Uninstrumented repeated medians, milliseconds:

| Fixture | XP | Quick fields | Short rest | Move + new scene |
| --- | ---: | ---: | ---: | ---: |
| `small` | 2.51 | 5.17 | 8.25 | 8.53 |
| `roster` | 5.89 | 10.78 | 19.17 | 20.50 |
| `scenes` | 2.38 | 34.84 | 55.09 | 67.01 |
| `state-control` | 2.26 | 8.14 | 13.11 | 14.01 |
| `states-small` | 20.45 | 27.26 | 34.48 | 41.35 |
| `source-only` | 8.36 | 28.67 | 43.85 | 51.03 |
| `states-deep` | 49.76 | 80.25 | 96.89 | 108.01 |
| `combined-source-only` | 21.48 | 56.09 | 93.65 | 107.15 |
| `combined` | 228.56 | 307.79 | 357.29 | 395.84 |

The matched foreign-state additions cost the following uninstrumented median differences (ms):

| Pair | XP | Quick fields | Short rest | Move |
| --- | ---: | ---: | ---: | ---: |
| `source-only` → `states-deep` | 41.41 | 51.58 | 53.04 | 56.98 |
| `combined-source-only` → `combined` | 207.08 | 251.71 | 263.64 | 288.68 |

Hundred empty scenes alone barely change XP latency; quick/rest/move also pay
for existing session projections, so not all scene-count cost belongs to history.
Increasing the roster from 6 to 100 has a smaller measurable effect. The matched
populated-state pairs demonstrate the much larger dependency on untouched state.
These are synthetic scale cases, not a claim that every campaign has this size.

## Counts, stored sizes and time attribution

Profiled repeated medians. Payload means UTF-8 bytes actually stored in
`party_action_history.payload_json`; receipt means the additional historical
`party_action_receipt.result_json`. Table/SQLite-page/index overhead and the
pre-existing domain command journal are excluded. Receipt projection growth
is shown separately rather than hidden inside the changed-field payload.

| Case/action | Prepared reads | Prepared writes | Returned rows | Payload bytes | Receipt bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `small` / xp | 42 | 9 | 118 | 1305 | 3745 |
| `small` / quick-fields | 128 | 7 | 281 | 164 | 18 |
| `small` / rest | 204 | 9 | 474 | 1305 | 4605 |
| `small` / move | 237 | 14 | 506 | 505 | 4797 |
| `combined` / xp | 3252 | 9 | 39536 | 1305 | 59574 |
| `combined` / quick-fields | 4653 | 7 | 56455 | 164 | 18 |
| `combined` / rest | 5840 | 9 | 53270 | 1305 | 235785 |
| `combined` / move | 6360 | 76 | 57545 | 113924 | 235451 |

Large-case phase medians in milliseconds; phases are exclusive (nested capture
is excluded from comparison). Each column is independently aggregated, so
column medians need not sum exactly to the total median. Persistence includes
history append/receipt/index completion and settings reconciliation; transaction
boundaries include native begin/commit/savepoint work, including domain writes.
Other includes ordinary reads, validation and final projections outside the
instrumented owner methods. Capture also includes owner reads during the
returned history conflict check, where that action performs one.

| Action | Capture | Compare | History persistence | Transaction boundaries | Domain work | Other + history reads | Profiled total | Uninstrumented total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| xp | 234.88 | 17.33 | 0.59 | 0.20 | 2.29 | 1.47 | 256.39 | 228.56 |
| quick-fields | 235.47 | 17.41 | 0.56 | 0.08 | 0.00 | 72.66 | 326.03 | 307.79 |
| rest | 234.52 | 17.22 | 1.19 | 0.49 | 70.45 | 71.56 | 399.05 | 357.29 |
| move | 225.37 | 17.19 | 1.86 | 0.64 | 98.99 | 73.15 | 417.19 | 395.84 |

First action versus repeated median (milliseconds), and instrumentation ratio:

| Case/action | Plain first | Plain repeated median (range) | Profiled repeated median | Profiled/plain median |
| --- | ---: | ---: | ---: | ---: |
| `small` / xp | 3.19 | 2.51 (2.46–3.28) | 3.44 | 1.37× |
| `small` / quick-fields | 5.67 | 5.17 (5.07–6.54) | 6.09 | 1.18× |
| `small` / rest | 8.34 | 8.25 (7.49–9.81) | 9.54 | 1.16× |
| `small` / move | 9.34 | 8.53 (8.34–11.13) | 9.92 | 1.16× |
| `combined` / xp | 242.55 | 228.56 (224.15–242.94) | 256.39 | 1.12× |
| `combined` / quick-fields | 336.72 | 307.79 (293.21–458.42) | 326.03 | 1.06× |
| `combined` / rest | 393.64 | 357.29 (348.12–486.41) | 399.05 | 1.12× |
| `combined` / move | 427.38 | 395.84 (367.45–407.05) | 417.19 | 1.05× |

The original XP and preference payload sizes stay constant in small/large cases,
while read amplification rises substantially. Move intentionally retains its
larger affected source combat/travel payload; dropping that payload would break
Undo. Receipt growth is real but is not the primary measured time component.
Do not subtract profiled phase milliseconds directly from plain timing to
promise a future latency; the uninstrumented matched pairs independently
establish the disadvantage.

## Concrete schema and responsibility coupling

- `PartyActionService.execute` (`src/core/application/party-action-service.ts:137`)
  captures Party, Scene, Combat and Travel before every action, then asks all
  four to recapture/compare at line 144, even for preferences whose domain work
  is only `{committed:true}`.
- `ScenePartyHistoryOwner.capture` (line 35) combines `SELECT *` with strict
  duplicated scene/assignment row schemas. In the disposable probe, adding
  `scene_running_scene.measurement_unrelated_note` makes quick-fields fail with
  that unrecognized key before any history row is committed. This is a
  demonstrated migration-maintenance dependency, not a failure of existing
  valid campaign data. The full expected error is in the evidence JSON.
- `PartyTravelHistoryOwner.capture` (line 47) similarly owns a strict copy of
  journey fields plus path/route loading. An added journey field or route
  representation requires this capture/schema/restore owner to evolve together;
  unrelated Party actions currently exercise that contract too.
- `PartyCombatHistoryOwner.capture` (line 47) enumerates every runtime scene and
  loads runtime plus inverse history through CombatRepository. Its imported
  memento/inverse schemas deliberately track combat representation changes;
  replay/restore must remain coherent when those change. The optimization must
  keep that authority in Combat, rather than duplicating combat SQL in Party.
- Party/Scene/Combat/Travel comparisons repeatedly search arrays and stringify
  values. That coupling and potential quadratic matching are visible, but the
  measured dominant cost is broad capture. Changing the comparison algorithm
  alone does not remove the foreign-state reads.
- The returned history conflict path calls Party/Scene/Travel capture even for
  empty owner changes. Preference-only capture removal must also avoid those
  irrelevant empty-payload reads. Nonempty conflict checks must remain strict.

## Bounded follow-up proposal (not implemented or authorized by this report)

1. **Preference-only fast path and empty-owner conflict checks.** Keep the
   campaign transaction, durable receipt, installation index and settings
   reconciliation unchanged. Construct the preference payload without touching
   unrelated domain owners; let each owner return no conflict immediately for
   an empty change set. Owners remain responsible for their nonempty checks.
2. **Typed owner-scoped capture for XP/rest, then move.** XP and rest capture the
   identified characters through Party-owned queries. Preserve automatic level
   derivation, trusted/unknown rest metadata and all current command receipts.
   Move must cover selected characters, source/target membership, both affected
   combats/journeys and the new scene as one atomic step. Source/target effects
   must be resolved by the existing domain owners, including the new scene ID,
   before their history is persisted. Existing unrelated scene edits must never
   be replayed or overwritten.
3. **Implement as a separate package with an explicit internal scope/effect
   contract.** This changes how PartyActionService and domain history owners
   coordinate; it deserves its own plan and audit. Keep public Zod capability
   contracts and stored payload/receipt formats compatible initially. Do not
   optimize profile edits, loot corrections or receipt projection storage in
   the first slice; their distinct effects/ledger guarantees need separate
   evidence if later included.

Expected benefit: remove most foreign combat/travel queries for the four measured
actions while retaining the actual affected payload. The matched pairs quantify
the observed removable dependency; they are not an implementation speedup
promise. Capture/comparison should become insensitive to additional untouched
combat/journey scenes, within noise, while unavoidable domain/projection cost
may still grow. Repeat this exact benchmark on before/after application bytes.

Required regressions: all XP modes and level boundaries; short/long/extra rests
and unknown metadata; existing/new-scene movement with source AND target combat
and travel; multiple-character roster effects; empty-owner versus real conflict
checks; later independent edits; byte-compatible original receipt replay;
transaction failure and ambiguous-write recovery; installation reconciliation;
multi-step Undo/Redo/restart/branching; protection of changed created scenes;
profile side effects and linked loot corrections remaining unchanged. No broad
snapshot restore, weakened strict schemas, generic persistence owner or dropped
side effect is an acceptable shortcut.

## Validation and disposition

The final nine-case run executes 72 equal series: 576 measured actions and 576
real Undos, with unchanged-foreign-state assertions after each. Source hashes
match the checked-in harness. Profiler oracles and existing history integration
checks pass (13 tests); full architecture checks pass (88 tests), as do focused
lint, format and both type checks. The unrelated-column probe is an expected
negative test with zero committed history rows. Preliminary probes/corrective
rounds are recorded separately in the execution log and are not mixed into
these accepted samples.

F2 is resolved as an investigation: a relevant measured disadvantage and a
bounded follow-up are documented. The production capture implementation is
retained. This report does not mark that future optimization as completed.
