Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-23
Source of Truth: Solution-neutral technical obligations and measurable quality
scenarios derived from the confirmed complete local SaltMarcher GM-core needs.

# SaltMarcher Program Technical Needs

## Purpose

This document is the binding technical-needs input to a later greenfield target
architecture. It translates confirmed product behavior into solution-neutral
obligations, invariants, quality scenarios, and change scenarios. It does not
select source modules, feature boundaries, APIs, schemas, storage mechanisms,
frameworks, processes, or technologies.

The input baseline is the `Active Target` in
`docs/project/requirements/requirements-program-capabilities.md`, merged to
`origin/main` by commit `9678b65f62857a26ceb494255eff465748aed299` on
2026-07-23. The project vision and resource policy are additional binding local
constraints. Current code, tests, feature boundaries, architecture documents,
and prior implementation decisions were not derivation inputs.

Target architecture, comparison with the current system, and migration planning
remain later phases.

## Stakeholders And Concerns

| Stakeholder | Concern owned here |
| --- | --- |
| GM | Campaign truth, continuity during table play, recoverability, privacy, and explicit authority |
| Product owner | Complete derivation from confirmed capabilities without invented behavior |
| Architecture authors | Measurable constraints and change pressures without a preselected solution |
| Implementers | Objective invariants and qualification profiles for later designs |
| Reviewers | Bidirectional traceability, feasibility, failure containment, and absence of current-system anchoring |

## Derivation Rules

1. `MUST` is binding. `SHOULD` is binding unless a later architecture decision
   demonstrates an equal or stronger outcome. `MAY` is optional.
2. Every `TN-*` traces to a confirmed requirement or the resource policy. No
   existing implementation fact is evidence for a need.
3. Product behavior remains owned by the capability requirements. This document
   owns only its technical consequences and does not restate behavior as a new
   product source.
4. A measurable scenario states stimulus, environment, affected truth, response,
   measure, and proof route. Timing populations are never pooled across action,
   operating system, profile, cold/warm state, or background-work category. Each
   warm population uses 100 recorded runs after five unrecorded warm-up runs;
   p95 is the 95th value in ascending order. Each cold run uses a new process and
   a disjoint, never-read fixture copy; every cold population has 100 recorded
   runs and no warm-up. A named timeout is
   checked on every run. Correctness and privacy invariants permit zero
   violations.
5. Performance numbers are qualification targets, not claims about the current
   program. The interaction thresholds are calibrated against the preserved
   Nielsen response-time source. Workload sizes are dated synthetic lower-bound
   qualification profiles, not product caps.
6. Data integrity, GM authority, and privacy outrank live availability. Live
   availability outranks background-work throughput. A lower-ranked outcome may
   degrade only to protect a higher-ranked one, and the degradation MUST be
   explicit.
7. A current or future implementation may use any design that proves every
   obligation and scenario. Terminology such as identity, checkpoint, authority,
   atomic, or isolation describes observable semantics, not a chosen mechanism.

## Reference Qualification Profiles

These profiles make `ordinary`, `large`, and `exceptional` reproducible. They
are deliberately conservative synthetic workloads assembled from the dimensions
named by the capability baseline. Passing a profile does not authorize an
artificial product limit.

### Hardware And Display Profile `RP-H`

- 4 logical CPU cores available to SaltMarcher, with the single-threaded profile
  probe defined below meeting its stated thresholds;
- 8 GiB memory available to the application and its local data work;
- local solid-state storage sustaining 200 MB/s sequential reads and writes,
  4 KiB random-read p95 at or below 2 ms, and durable 4 KiB write p95 at or
  below 10 ms;
- at least 100 GiB free local space before `RP-L` portability qualification;
- no dedicated GPU and no server-class hardware;
- one 1366 x 768 effective laptop viewport; one 1920 x 1080 display; two
  heterogeneous displays; and a high-density display at 200% scale, including
  window/focus movement between different scales;
- network unavailable throughout core-operation qualification.

The calibration record MUST include CPU score, storage measurements, exact OS
and architecture, power mode, free space, and whether a population is cold or
warm. The later architecture MAY support lower hardware. It MUST pass on `RP-H`
for every version in the declared supported Linux, Windows, and macOS matrix
without separately administered infrastructure.

### Campaign Profile `RP-R` — Representative Long-Lived Campaign

- 10,000 Campaign-owned objects numbered from 1. Objects 1 through 2,000 use
  name `duplicate-ceiling(i/2)`, producing exactly 1,000 duplicate-name pairs;
  the rest use `object-i`. Exactly 5,000 texts are 2 KiB, 4,000 are 4 KiB, 950
  are 16 KiB, and 50 are 64 KiB, filled by repeating the UTF-8 byte sequence
  `0123456789abcdef`. Object 1 references its next 100 cyclic successors,
  objects 2 through 93 their next 7, and every other object its next 8. Thus
  mean reference fan-out is exactly 8 and maximum fan-out is 100;
- 100,000 numbered records: exactly 16,667 each of notes, history entries,
  corrections, and ledger entries, plus 16,666 each of trade facts and travel
  checkpoints. Record `i`
  belongs to the active working set exactly when `i modulo 5 = 0`; its text is
  `entry-i` and its owner is Campaign object
  `1 + ((i - 1) modulo 10,000)`;
- 20 Roster characters, 4 independently timed Running Scenes, 8 simultaneous
  runtime masks, and 50 live participants, all numbered from 1. Participant `i`
  belongs to Scene `1 + ((i - 1) modulo 4)`; mask `k` contains participants
  whose number modulo 8 equals `k`, and participants 1 through 4 additionally
  belong to every mask to exercise shared membership;
- 100,000 numbered reusable definitions and 10,000 numbered scheduled
  candidates. Candidates 1..2,500 are ineligible, 2,501..5,000 eligible without
  a consequence, 5,001..7,500 eligible with a new consequence, and
  7,501..10,000 eligible with an already-established result. The first 1,500
  eligible candidates form five ordered levels of 300; every node after level
  zero depends on previous-level offsets `j`, `j+1`, and `j+2` modulo 300,
  producing depth 4 and fan-out 3. Party-danger boundaries follow eligible
  ordinals 750, 3,750, and 6,750;
- 20 maps with exactly 100,000 authored spatial facts each. Maps 1 through 10
  are axial Hex rectangles with `q=0..399`, `r=0..249`; maps 11 through 20 are
  Dungeon cell grids with `x=0..399`, `y=0..249` and orthogonal adjacency.
  Facts sort by map, then second coordinate, then first coordinate. Map
  scenarios use the first lexicographically ordered 256, 2,048, and 8,192
  visible facts, 6 knowledge owners, 8 visible layers, 4 visibility modifiers,
  and cold as well as warm assets. Boundary `i` occludes exactly when
  `i modulo 4 = 0`. Knowledge owner `k` knows fact `i` exactly when
  `i modulo 6 = k`; the 0%, 50%, and 100% overlap variants respectively use
  disjoint sets, add the preceding three owners' sets, or give every owner the
  union. Layers and modifiers are assigned by fact index modulo their count;
  the three zoom tiers repeat round-robin. Single edit, regional edit, and
  reveal affect the first 1, 2,048, and 8,192 visible facts;
- 10 GiB across 10,000 intact local map, image, and audio files, where 1 MiB is
  1,048,576 bytes: 9,000 files are 256 KiB, 900 are 4 MiB, 89 are 40 MiB, 10
  are 33 MiB, and one is 500 MiB. File bytes repeat the SHA-256 digest of
  `23072026:file-i` until the declared length; file type cycles map, image,
  audio by `i modulo 3`. The p95 size is 4 MiB and the maximum is 500 MiB.
  Missing/damaged media belongs to a separate
  fault profile, never the intact round-trip profile;
- a repeated 20-operation cycle: slots 1..12 alternate read and search, slots
  13..17 are live mutations, slot 18 is a history query, slot 19 a ledger query,
  and slot 20 a long-work operation whose mode cycles start, cancel, retry.
  Target IDs advance modulo the relevant manifest count. Search text is the
  target record/object text. Any remaining randomized choice uses seed
  `23072026` and the deterministic generator below.

### Campaign Profile `RP-L` — Extraordinary Large Campaign

- 100,000 Campaign-owned objects, 1,000,000 combined note/history/ledger/
  checkpoint entries, 100 Roster characters, 10 independently timed Running
  Scenes, 50 simultaneous masks, 500 live participants, 250,000 reusable
  definitions, 100,000 scheduled candidates, 100 maps, 20,000,000 authored
  spatial facts, and 50 GiB across 50,000 intact media files;
- only one dominant axis is multiplied at a time for the first pass, followed by
  the combined profile needed to expose interaction effects.

Numbered `RP-R` classes scale by prefixing each complete repeated cohort with
its cohort number. `RP-L` repeats object and record cohorts ten times and map
and media cohorts five times. Each `RP-L` map contains two prefixed copies of
its `RP-R` spatial-fact cohort, yielding exactly 200,000 facts per map and
20,000,000 total. Text, reference, operation, and media-byte construction
repeats unchanged inside each cohort; cross-cohort references are absent unless
a scenario explicitly declares them. Scheduled candidates repeat the `RP-R`
cohort ten times with occurrence identity prefixed by cohort.

### Campaign Profile `RP-X` — Exceptional Pressure

`RP-X` qualifies each `RP-L` axis separately at ten times its declared count:
Campaign objects, records, Roster characters, Scenes, masks, participants,
reusable definitions, scheduled candidates, maps, spatial facts, media file
count, and media bytes. It then qualifies the combined `RP-L` profile. Fault
variants are exact: free destination capacity is one byte below the declared
input-plus-output-plus-temporary preflight; each independently addressable data
class receives one deterministic single-bit corruption; every supporting
capability is absent in turn; memory pressure is raised until the next admitted
operation would cross the resident-set ceiling; and three of four logical cores
are saturated. Each fault runs alone and then in every compatible pair.

All variants reserve at
least one `RP-H` logical core or 25% CPU capacity, whichever is greater, for
SaltMarcher. No background throughput SLA applies, but `TN-21` live-path budgets
remain binding. Peak resident set size MUST stay within 75% of `RP-H` memory;
temporary storage MUST be preflighted and MUST NOT exceed 120% of declared input
plus output size; one capability MUST NOT retain more than one active and one
pending long operation. The working-storage safety reserve is the greater of
2 GiB or 5% of volume capacity. Admission or pressure failure is reported within
1 s, before unsafe mutation. No injected failure may cause additional data loss:
unaffected truth remains complete, and damaged units are recovered or disclosed
only through salvage. Safe read, export to a destination with sufficient
capacity, and retry remain available.

### Profile Manifest And Calibration

Manifest version `PTN-2026-07-23.1` is normative. Its fixture manifest is the
exact `RP-R`/`RP-L`/`RP-X` data and construction algorithm in this document.
It records counts, byte distributions, reference fan-out, active/archive ratio,
operation distribution, scheduling intersections, dependency shape, visible
spatial density/topology, asset state, and random seed. Scheduling variants use
0%, 50%, and 100% eligibility in addition to the base 75%. At 0% every candidate
is ineligible. At 50%, eligible ordinals contain 1,666 without consequence,
1,667 new, and 1,667 established results. At 100%, those counts are 3,334,
3,333, and 3,333. In every nonzero variant, its first 20% of eligible ordinals
use five equal dependency levels and the same modulo-three construction; danger
boundaries follow eligible ordinals at ceiling(10%), ceiling(50%), and
ceiling(90%). `RP-L` repeats each exact `RP-R` scheduling cohort ten times. A
timing result is invalid until an independent generator reproduces all manifest
totals, intersections, and distributions.

The deterministic generator is SplitMix64 with unsigned 64-bit wraparound:
state increases by `0x9E3779B97F4A7C15`; `z=(z xor (z >> 30)) *
0xBF58476D1CE4E5B9`; then `z=(z xor (z >> 27)) * 0x94D049BB133111EB`;
the result is `z xor (z >> 31)`. Selection maps the unsigned result modulo the
candidate count; unique selections redraw collisions. Its initial state is the
declared seed.

The CPU probe emits UTF-8 lines and includes process start, generation, digest,
and process completion in its timing boundary. For one-based integer `i`, the
scheduling line is `i,scene=(i modulo 10),period=floor(i/10)\n`; the spatial line
is `i,q=(i modulo 2000),r=floor(i/2000)\n`. Decimal integers have no padding.
SHA-256 consumes the exact byte stream. The `RP-H` thresholds are 0.5 s for
100,000 scheduling records and 5 s for 2,000,000 spatial records. Storage
calibration uses deterministic generator seed `23072026`, records its algorithm
and version, and a new 64 MiB file. It first performs and durably synchronizes
one sequential 64 MiB write, then one sequential 64 MiB read, then 200 generated
non-overlapping 4 KiB writes each followed by durable synchronization, and
finally 1,000 generated 4 KiB reads. Throughput covers the whole sequential
operation; per-operation p95 follows the rule above. Every cold storage run
creates a new file at a never-used path and uses disjoint offsets. The record
names the exact OS build, filesystem, storage device, power mode, cache state,
free space, and calibration implementation revision.

Disposable feasibility probes on 2026-07-23 used Linux 6.19 x86-64 on an Intel
i5-8365U (4 physical/8 logical cores) and streamed/digested 100,000 scheduling
records in 0.20 s (`sha256:3f8ca7663718dadf8567654e4f3a10c2e79657a0ff9704f8896ada6bd2800931`)
and 2,000,000 spatial records in 3.82 s
(`sha256:d4124f10c047b1cfb7074e840b46822b809c289c2ef783b66a9eb51f7bb15394`)
with about 4 MiB resident memory. These probes validate only
that the qualification data volumes are inexpensive to generate; they are not
current-system proof and do not substitute for end-to-end production-route
qualification.

### Metric Provenance

| Metric family | Calibration basis | Verdict method |
| --- | --- | --- |
| 100 ms feedback, 1 s uninterrupted interaction, 10 s attention/interrupt | Preserved Nielsen response-time evidence | Per-action/per-environment p95 and timeout populations defined above |
| `RP-R`/`RP-L` volume and operation mix | Synthetic lower-bound profile across every scale dimension named by the capability baseline; generation feasibility probe above | Manifest reproduction before timing; complete per-axis then combined qualification |
| 1 s durability acknowledgement and zero acknowledged loss | Owner-confirmed automatic preservation plus 1 s uninterrupted-flow threshold | Crash/power fault after every acknowledged mutation |
| 1 s warm switch, 5/10 s start/resume | Owner-confirmed immediate switching and live-table continuity; 1/10 s HCI thresholds | Separate warm-switch, cold-start, crash-resume, and post-conversion populations |
| 60 s recovery point; 5/20 min restore | Technical safety target for “almost never” losing work; transfer floor of the declared intact data volumes on `RP-H` | Storage-loss and full-restore drill including media |
| 10/60 min export/import | Declared intact profile bytes, 200 MB/s storage floor, and natural-break progress/cancel requirement | Closed-manifest cross-OS round trip |
| 60 s/15 min World catch-up | Exact scheduled-candidate mixes plus disposable 100,000-record generation probe; live work remains higher priority | Candidate/eligible/committed counts, live timings, retry and once-only oracle |
| WCAG contrast, keyboard, color, and 200% scaling | Preserved WCAG 2.2 criteria applied as a technology-neutral measurement baseline | Automated checks plus human workflow inspection on every display configuration |

## Priority Model

| Priority | Meaning |
| --- | --- |
| `P0` | Integrity, GM authority, privacy, or live-table continuity; blocks every target architecture |
| `P1` | Required core quality or change capability; blocks activation unless its proof route exists |
| `P2` | Explicitly parked or product-testing concern; recorded only to prevent accidental architectural commitment |

## Technical-Need Catalog

### Truth, Identity, Lifecycle, And History

| ID | Priority | Sources | Obligation and rationale | Invariant or measure | Proof route |
| --- | --- | --- | --- | --- | --- |
| `TN-01` | P0 | `SRC-F02`, `SRC-F03`, `SRC-F04`, `SRC-R03`, `SRC-S01`, `SRC-D02` | Every independently editable Campaign object, concrete Item, reusable definition, runtime context, historical subject, and recoverable target MUST have stable semantic identity independent of name, storage location, or display label. Copies and imports create independent Campaign-owned identity; trash/restore preserves recoverable identity. A copied Campaign object MUST NOT retain a Campaign-owned reference back to its source Campaign: referenced closure is copied, remapped to the target, omitted with disclosure, or resolved by the GM before completion. | Editing, deleting, copying, importing, restoring, or correcting one namesake changes no other namesake; an independent copy has no hidden source-Campaign dependency. | Duplicate-name and reference-closure property suite across Campaign, copy, import, trash, restore, and history paths; zero cross-target mutations. |
| `TN-02` | P0 | `SRC-F01`, `SRC-F02`, `SRC-F03`, `SRC-L01`, `SRC-T01`, `SRC-R02`, `SRC-S01`, `SRC-D02`, `SRC-Q01`, `SRC-Q05` | State MUST have one unambiguous owning scope: installation-wide reusable definitions; Campaign-owned records, Roster, Party, and runtime; Session-owned planning Party; Scene-owned time and runtime; character-owned knowledge; and the explicitly selected owner for Shop or travelling content. The confirmed core has one local mutation authority; passive displays and other observers are read-only and cannot originate Campaign writes. Ownership is semantic and does not prescribe a module, store, or concurrency mechanism. | Switching, focus, planning, import, observer loss, or mutation in one scope cannot mutate another scope unless the capability requirement explicitly defines the handoff. | Ownership-transition, observer-write denial, and cross-Campaign non-interference suite. |
| `TN-03` | P0 | `SRC-F04`, `SRC-P01`, `SRC-P02`, `SRC-P03`, `SRC-L02`, `SRC-D03`, `SRC-Q02` | Replaceable plans, unaccepted drafts, accepted World placements, resumable Running Scenes, temporary masks, explanatory history, recoverable trash, permanent deletion, and retained unavailable-capability data MUST remain distinct lifecycle classes. Promotion, completion, replacement, disablement, restore, and deletion MUST affect exactly the class named by the confirmed action. | Plan replacement cannot remove accepted placement; mask completion cannot end a Scene; capability removal cannot delete retained data. | Transition matrix with survivor/removal assertions after every lifecycle action and restart. |
| `TN-04` | P0 | `SRC-F02`, `SRC-R05`, `SRC-D02`, `SRC-C04` | Current and future reads MAY follow the current reusable definition, while completed history MUST preserve the confirmed explanatory fact. Definition edits, deletion, trash, restore, or permanent loss MUST NOT recalculate completed facts; missing live identities remain intelligible as unknown or recoverable. | Current projection changes when a definition changes; already completed fact does not. | Complete-reference/edit/delete/restore test with semantic snapshots of current and historical projections. |
| `TN-05` | P0 | `SRC-F04`, `SRC-L01`, `SRC-S01`, `SRC-D03` | Explicit deletion MUST remove current references and only the confirmed dependent runtime, preserve explanatory history, and never treat leaving a Scene as deletion. Recoverable owner-dependent relationships, including Shops, MUST restore coherently. After separate permanent deletion, application-controlled live, trash, recovery, staging, temporary, and retained-capability state MUST NOT reconstruct the deleted payload; permitted history retains only non-reconstructive explanatory facts and unknown identity. Prior GM-controlled exports are outside revocation and MUST be disclosed as such. | No live dangling reference; no implicit loss of persistent location content; no application-controlled resurrection after permanent deletion; history remains truthful. | Dependency-graph suite plus delete/crash/restart/recovery/export/import and unavailable-capability cases, including interrupted deletion. |
| `TN-06` | P0 | `SRC-F04`, `SRC-R01`, `SRC-R03`, `SRC-R05`, `SRC-S02`, `SRC-S03`, `SRC-C01`, `SRC-C04` | History MUST preserve both confirmation order and effective in-world time. Meaningful confirmed consequences and linked corrections are ordinarily append-only; a correction changes current truth without rewriting the original fact. Travel undo and explicit target deletion are the only confirmed narrow removal exceptions and MUST remain visibly scoped. | Backdating, time reversal, correction, or definition change cannot silently reorder or rewrite confirmation history. | History oracle covering XP, HP/death, Party, travel, trade/restock, correction, backdating, deletion, and restart. |

### Runtime Consistency, Time, And GM Authority

| ID | Priority | Sources | Obligation and rationale | Invariant or measure | Proof route |
| --- | --- | --- | --- | --- | --- |
| `TN-07` | P0 | `SRC-F03`, `SRC-L01`, `SRC-L02`, `SRC-T01`, `SRC-C02` | At most one current Party exists per Campaign; every active PC belongs to exactly one Running Scene and inactive PCs to none; one empty primary Scene remains when needed. Party/Scene membership changes are authoritative immediately and remove moved participants from masks even when dependent reconciliation is unavailable. | Authoritative membership changes once; only referencing contexts may become visibly pending; stale membership is never shown as current. | Failure injection during activation, deactivation, deletion, movement, empty-Scene cleanup, restart, and retry. |
| `TN-08` | P0 | `SRC-L04`, `SRC-T03`, `SRC-Q05`, `SRC-C04` | Every Running Scene MUST have independent in-world time. Moving time backward or manually resolving reunion MUST NOT reverse World state, delete history, or roll back another Scene. Confirmation order and effective time MUST remain distinguishable. | Permuting Scene advancement, backdating, reversal, and reunion preserves established World facts. | Multi-Scene time permutation and restart suite. |
| `TN-09` | P0 | `SRC-L04`, `SRC-T02`, `SRC-T03`, `SRC-S03`, `SRC-Q05` | A logical shared World, restock, weather, or autonomous consequence MUST have one stable occurrence identity and apply at most once across Scene order, retry, restart, reversal, or catch-up. Earlier Scenes reuse that established shared result. A Calendar event instead has stable definition identity and its relevance MUST be evaluated independently for each `(event, Scene, Scene time, Scene place)` context using the Campaign's authored month/day/week/year structure; relevance may coexist in several Scenes and never decides a narrative consequence. Any separately confirmed shared consequence arising from an event receives its own once-only occurrence. Party-danger resolution MUST pause for GM authority. | Shared-consequence applied count is exactly zero before eligibility and exactly one after confirmation; never greater than one. Calendar relevance matches every Scene context independently and changes only with authored calendar/event or that Scene's time/place. | Permutation/property suite asserting separate per-Scene relevance and shared-consequence counts over divergent Scene clocks/places, authored calendars, retry, restore, rule edits, and redo. |
| `TN-10` | P0 | `SRC-P02`, `SRC-P03`, `SRC-R01`, `SRC-R02`, `SRC-R03`, `SRC-R04`, `SRC-R05`, `SRC-S02`, `SRC-C01` | Confirmed coupled outcomes MUST be all-or-nothing: Encounter completion with selected XP and carried-forward tracked outcome; purchase with stock and ledger acquisition; sale with stock and ledger fact; correction with current truth and linked history. Unsatisfied generation constraints yield no partial result. | Every injected failure exposes either complete old truth or complete new truth, never a hybrid. | Fault injection at every externally observable substep plus idempotent retry. |
| `TN-11` | P0 | `SRC-L01`, `SRC-C02`, `SRC-C03` | Where the baseline makes a primary change authoritative before a dependent context, the primary change MUST persist once, affected dependents MUST be visibly pending, unaffected contexts MUST remain unchanged, stale state MUST NOT appear synchronized, and retry MUST converge without repeating the primary change. | One primary mutation, zero duplicate effects, exact affected-context set. | Scene-save/Encounter and Party/context failure matrix with restart and repeated retry. |
| `TN-12` | P0 | `SRC-T02`, `SRC-T03`, `SRC-C04` | Every route point and interruption MUST be a committed checkpoint. Multi-level undo removes only the chosen segment and effects caused exclusively by it; later authoritative facts survive. Redo MUST NOT duplicate scheduled or historical consequences. | Undo/redo is causal, not time-wide rollback. | Property-based checkpoint graph with intervening edits, another Scene's later facts, restart, and redo. |
| `TN-13` | P0 | `SRC-P02`, `SRC-T03`, `SRC-D02`, `SRC-Q05`, `SRC-C04` | The system MUST detect and expose contradictions without silently deciding for the GM: impossible generation blocks with explanation; earlier-time contradictions warn, remain allowed, and retain a conflict marker; definition import conflicts show consequences before explicit choice. A missing optional PC statistic blocks only the automatic workflow that requires it, identifies the missing input, and cannot make unrelated optional character data mandatory. | Conflict marker survives restart until explicit resolution; blocked actions produce no result; unrelated workflows remain available. | Decision-table tests for every conflict family, retain-both, explicit resolution, and each workflow-local PC prerequisite. |
| `TN-14` | P0 | `SRC-P04`, `SRC-L04`, `SRC-T02`, `SRC-T05` | Manual overrides MUST have explicit precedence, persistence, and release semantics. Automation cannot overwrite an active GM decision; after release it resumes from current Scene context rather than stale pre-override context. | Manual value wins exactly while active; release recomputes from current inputs. | Override-before/during/after suite with focus change, Campaign switch, restart, and failure. |

### Preservation, Recovery, Portability, And Scale

| ID | Priority | Sources | Obligation and rationale | Invariant or measure | Proof route |
| --- | --- | --- | --- | --- | --- |
| `TN-15` | P0 | `SRC-T02`, `SRC-D01`, `SRC-Q02`, `SRC-C02`, `SRC-C03` | Confirmed GM work MUST be preserved automatically. The UI MUST NOT present a mutation as stored until it is durable or explicitly show it as pending/unsafe. Acknowledged-work loss after crash or power loss is `0`; safe-state acknowledgement is at most 1 s p95 with a 10 s timeout on `RP-R`. | Every acknowledged change survives abrupt termination; every non-durable change was visibly identified before termination. | Kill/power-loss, denied-write, low-space, interrupted-write, and dependent-failure matrix after each representative mutation. |
| `TN-16` | P0 | `SRC-F01`, `SRC-D01`, `SRC-Q02`, `SRC-C02`, `SRC-C03` | Warm Campaign switching, cold start, crash resume, and post-conversion start are distinct populations. All restore focus, Scenes, masks, travel checkpoints, overrides, queues, and pending reconciliation before readiness. A warm switch is ready within 1 s p95 and 10 s timeout; cold start and crash resume within 5 s p95 on `RP-R` and 10 s p95 on `RP-L`. Ready means the safely rendered focused Scene accepts and durably preserves a representative next mutation. | Clean start has 100% observable-state equivalence; abrupt restart differs only by visibly unacknowledged work. | Combinatorial state snapshot plus next-action comparison for each start mode and supported OS. |
| `TN-17` | P0 | `SRC-D01`, `SRC-Q02` | Damage MUST be detected and isolated at the granularity of one independently addressable Campaign object, reusable definition, asset, or runtime context. The newest uniquely safe recovery opens automatically with exact disclosure; ambiguous recovery asks the GM. Rolling recovery MUST offer a recoverable point no older than 60 s of confirmed work and complete full restore, including local media, within 5 min on `RP-R` or 20 min on `RP-L`. A disclosed salvage open/export MAY omit identified damaged units but MUST NOT be called a complete export. | Zero silent substitution; original damaged material remains unchanged until explicit recovery/deletion; unaffected data remains usable. | Corruption corpus, storage-loss simulation, full restore drill, and separate disclosed-salvage manifest. A backup counts only after restore verification. |
| `TN-18` | P0 | `SRC-D02`, `SRC-Q02` | Updates and conversions MUST preserve Campaign and resumable state. A failed conversion MUST leave prior data untouched and usable by the prior compatible application. | Failed conversion produces semantic and byte-level equivalence of the prior source where byte preservation is applicable. | Fault every conversion phase, reopen with prior version, then qualify successful conversion, resume, and export. |
| `TN-19` | P0 | `SRC-D02`, `SRC-Q01`, `SRC-Q02` | Complete export MUST be a closed, versioned transfer of Campaign data, intact assets, required reusable definitions, resumable state, trash needed for recovery, and retained optional-capability data. Every imported byte and reference is untrusted: validation is bounded before commit; import executes nothing, resolves no external resource or network reference, writes only owned import state, and stages shared-definition decisions without mutating existing truth. Import MUST be atomic, create a new independent Campaign, never merge Campaign-owned state, and resolve definition conflicts explicitly. Each release MUST import the immediately preceding released export format and declare any older supported formats. `RP-R` export/import MUST finish within 10 min and `RP-L` within 60 min on `RP-H`, with progress and cancellation. | Cross-platform round trip has semantic and intact-asset checksum equality; rejection/cancellation leaves both Campaign and shared definitions unchanged; no path escape, execution, network resolution, or unbounded amplification. | Every supported OS pairing, source-machine removal, manifest audit, compatibility readback, interruption/low-space/conflict, traversal, link, collision, compressed-bomb, oversized-count, malformed parser/media, external URI, and staged-definition failure cases. |
| `TN-20` | P1 | `SRC-T04`, `SRC-Q02` | The system MUST impose no artificial content cap. It MUST meet all live-path budgets on `RP-R`, complete and remain operable on `RP-L`, and obey the explicit `RP-X` pressure limits without truncation or corruption. Resource exhaustion MUST be reported before unsafe mutation; safe read, export to a destination with capacity, and retry remain available. | Completeness is 100% at every profile; process memory <=75% of `RP-H`, temporary storage <=120% of declared input plus output, and per-capability long-work queue <=1 active + 1 pending under `RP-X`. | Synthetic profile and pressure-decision qualification measuring latency, throughput, memory, temporary/storage growth, queue depth, completeness, and recovery. |

### Responsiveness, Background Work, Spatial State, And Media

| ID | Priority | Sources | Obligation and rationale | Invariant or measure | Proof route |
| --- | --- | --- | --- | --- | --- |
| `TN-21` | P0 | `SRC-P04`, `SRC-L03`, `SRC-T01`, `SRC-R03`, `SRC-S01`, `SRC-Q01`, `SRC-Q02`, `EXT-NNG` | Direct manipulation MUST acknowledge within 100 ms p95. Frequent live actions and first useful cross-kind search results MUST complete within 1 s p95 and a 10 s timeout on `RP-R`; these absolute budgets remain unchanged under long work. The named vision paths remain context-preserving for pointer and keyboard alike: open the monster list in one semantic action, add a monster in one further action, and reach notes from an already open NPC or place in one action. Test-harness focus setup is excluded symmetrically from both modalities. Scene-focus changes update the safe passive-display projection within 1 s p95. | No interaction-thread stall exceeds 100 ms p95 or the 1 s timeout; no named frequent path exceeds its action count or leaves its working context. | Per-action production-route timing and action-count journeys on `RP-H`, idle and under every long-work category. |
| `TN-22` | P0 | `SRC-P02`, `SRC-T03`, `SRC-D02`, `SRC-Q02`, `EXT-NNG` | Generation, import/export, simulation, weather, maps, and World catch-up MUST be observable, cancellable where the baseline permits, and subordinate to live play. Work exceeding 1 s shows activity; work expected to exceed 10 s shows determinate progress when knowable and an explicit interrupt. Cancellation has one linearized terminal outcome: before commit it acknowledges within 1 s p95, exposes no new effect afterward, and leaves no live task, handle, queue entry, or unmarked temporary artifact after 10 s; after commit it reports completion rather than cancellation. At most one explicitly marked resumable artifact per capability may remain, within the `RP-X` temporary-space cap, visible for resume/replacement/explicit discard, and outside Campaign truth. Only independently accepted results survive. | No unaccepted Campaign/staging mutation; after 20 cancel cycles resident memory returns within 10% of the pre-cycle steady state and below the `RP-X` ceiling; live budgets remain within `TN-21`; retry duplicates no effect. | Repeated early/mid/commit-boundary cancel/failure suite measuring manifests, marked/unmarked temp storage, resident memory steady state, handles, task/queue count, CPU, restart, resume/discard, and retry. |
| `TN-23` | P1 | `SRC-T03`, `SRC-Q02` | World catch-up MUST yield to live work, preserve exactly-once semantics, and process the `RP-R` scheduling profile within 60 s and `RP-L` within 15 min on `RP-H`. If Party involvement or a configured consequence boundary is reached, processing pauses before the prohibited consequence. | Established periods are reused; cancellation/restart creates no duplicate consequence; backlog remains visible. | Synthetic scheduling profile with Scene-order permutations, pause, cancellation, restart, and resource contention. |
| `TN-24` | P0 | `SRC-L05`, `SRC-T04`, `SRC-Q01`, `SRC-Q04` | Durable per-character map knowledge, transient current perception, and GM-private truth MUST remain separate. The passive display is read-only and MUST expose only the focused Scene's permitted visual projection, never hidden/unknown live details, mechanics, text, or private notes. Viewport scenarios separately qualify pan/zoom, focus switch, single/regional edit, reveal, multi-character visibility, and cold/warm assets at every declared visible-density tier. | Prohibited information leaks: `0`; feedback <=100 ms p95 and complete safe projection <=1 s p95; focus/visibility change never displays a stale unsafe frame. | Exact viewport manifest plus multi-character knowledge/perception oracle under focus, movement, light, weather, elevation, hidden state, blank, replace, and display loss. |
| `TN-25` | P1 | `SRC-P04`, `SRC-L04`, `SRC-T04`, `SRC-T05`, `SRC-Q02` | Weather computation MUST accept location, terrain, climate, Scene time, declared spatial/temporal resolution, structured effects, moving phenomena, and GM overrides while maintaining regional and temporal continuity within `TN-22`/`TN-23` budgets. No weather algorithm is selected here. The later rule/domain owner MUST publish model-specific maximum change per spatial and temporal step before a weather implementation can qualify; discontinuities require an authored event, input boundary, or override. | Same established inputs for the same authoritative period reuse one result; measured deltas remain within the published model bound or carry the explicit discontinuity cause. | Model-bound continuity/metamorphic tests over space, time, resolution, event edits, pause, override, and release. |
| `TN-26` | P1 | `SRC-P04`, `SRC-L03`, `SRC-T05`, `SRC-Q02` | Local maps, images, audio, manual media precedence, and resumable media state MUST remain portable and intact. Missing, damaged, unsupported, or slow media MUST affect only that media capability and never block Scenes, Encounters, editing, preservation, or export of unaffected truth. | Core-workflow outage from a media fault: `0`; every affected asset is identified. | Asset fault matrix during playback, focus, restart, export/import, and low storage. |

### Modularity, Extensions, Trust, Portability, And Inclusion

| ID | Priority | Sources | Obligation and rationale | Invariant or measure | Proof route |
| --- | --- | --- | --- | --- | --- |
| `TN-27` | P0 | `SRC-Q02`, `SRC-Q03` | Supporting capabilities MUST have explicit failure domains. Failure, cancellation, removal, replacement, or temporary absence of music, weather, maps, generation, or World progression MUST leave Running Scenes, Encounters, manual editing, preservation, and complete export usable; complete export retains the unavailable capability's opaque data, while only disclosed salvage may omit identified damage. Only behavior that directly requires the capability may be unavailable. From an observable provider failure or first access to a defective unit, the error is visible within 1 s; retry is explicit, retained data survives, and repeated faults stay within the `TN-22` steady-state envelope and `TN-21` live budgets. | Survivor-workflow outage, unaffected-state mutation, retained-data loss, and out-of-envelope repeated-fault growth are `0`; Campaign opening succeeds. | Capability-by-survivor fail/remove/replace/restore matrix with complete/salvage export manifests, live timings, sentinels, detection/retry, and resource-envelope measurement. |
| `TN-28` | P1 | `SRC-P01`, `SRC-L02`, `SRC-L03`, `SRC-T01`, `SRC-T05`, `SRC-Q03`, `SRC-Q05` | A content kind, runtime mask, influence family, generator, importer, or presentation MUST be addable without semantic changes to unrelated capability-owned decisions, public behavior, or persisted meaning. An optional capability MUST be omittable, removable, or replaceable while preserving unrelated workflows and data. Declared integration wiring and compatibility adapters are allowed. Multiple masks and shared participants remain composable. Source-file topology, registration count, and touched-file count are not verdicts. | Unrelated acceptance scenarios and stored truth remain unchanged in present, absent, replaced, and restored states; existing unrelated owners requiring semantic change: `0`. | Change scenarios `CS-01` through `CS-06`, before/add/remove/replace semantic-digest conformance, compatibility qualification, and retained-data round trips. |
| `TN-29` | P0 | `SRC-Q03` | Extensions MUST be explicitly installed, identified, disabled on fault/incompatibility, and denied Campaign-data, file, network, or other protected access by default. Every protected-access request MUST be disclosed before activation and remains denied until the GM explicitly consents to that exact extension identity/version, capability, data, destination, and action; installation alone is not consent. Grants MUST be inspectable and revocable. Disable, removal, revocation, update, reinstall, identity change, or a changed request takes effect before the next protected operation and cannot inherit stale authority silently; every protected sink checks current authority. Extensions MUST NOT bypass deletion, truthful history, privacy, confirmed-work, or passive-display boundaries. | Protected access before exact consent or outside current scope and successful safety-boundary bypasses are `0`; incompatible extension cannot rewrite Campaign data or block opening. | Permission matrix covering install without consent, denial, scope elevation, changed request, combined data+network grants, revoke-during-work, stale handles, disable/re-enable, update, reinstall, identity change, undeclared access, crash, damage, deletion, egress, and history rewrite. |
| `TN-30` | P0 | `SRC-D02`, `SRC-Q01` | Core preparation and play MUST run offline, without hidden upload or default telemetry. Product runtime may create a local complete export or perform another precisely disclosed GM-initiated transfer whose payload and destination are confirmed; it MUST NOT perform background or broader egress. No core workflow may depend on a paid, cloud, external-analysis, or separately administered service. Linux, Windows, and macOS Campaign behavior MUST be portable and self-contained. | Unexplained product outbound attempts, broader-than-confirmed transfer, and mandatory external-service dependencies are `0`; every ordinary core workflow passes with network disabled. | Network-denied journey, product transfer disclosure/destination audit, clean-system install, dependency audit, and cross-platform portability matrix. |
| `TN-31` | P1 | `SRC-L05`, `SRC-Q01`, `SRC-Q04`, `EXT-WCAG` | All core and extension-facing interface text MUST be localizable while Campaign-authored text remains arbitrary and unchanged by locale. Complete core workflows MUST be keyboard-operable without traps or timing-dependent keystrokes; required information MUST NOT rely on color alone; ordinary text contrast MUST be at least 4.5:1 and essential non-text controls/state at least 3:1; text/interface scaling to 200% MUST preserve content and functionality across the full `RP-H` display matrix. | Localizable identified strings: 100%; authored-text mutation: `0`; unreachable keyboard action, trap, lost content/function, or color-only fact: `0`; action counts obey `TN-21`. | Pseudo-localization with 40% expansion and Unicode corpus; locale/export round trip; keyboard-only workflow suite; mixed-DPI monitor movement; automated and human contrast/scale inspection. |
| `TN-32` | P1 | `SRC-S03`, `SRC-Q02`, `SRC-Q03`, `SRC-Q05`, `POL-RP` | Time, randomness, permissions, cancellation, corruption, resource pressure, and downstream failure MUST be controllable and observable enough to reproduce every invariant through self-contained qualification with synthetic data and no mandatory external service. Random outcomes need not be identical in play, but their inputs, rule profile, and established result MUST be inspectable for diagnostics and retry safety. | Repeated qualification reaches the same invariant verdict; once-only effects and primary writes occur exactly once. | Deterministic synthetic fixtures, controlled clocks/random sources/faults, production-route acceptance tests, and self-contained proof. |

### Rules Profile And Provenance

| ID | Priority | Sources | Obligation and rationale | Invariant or measure | Proof route |
| --- | --- | --- | --- | --- | --- |
| `TN-33` | P0 | `SRC-F02`, `SRC-P02`, `SRC-L04`, `SRC-R01`, `SRC-R02`, `SRC-R04`, `SRC-S03`, `SRC-D02`, `SRC-Q04`, `SRC-Q05`, `SRC-C01`, `EXT-DND2014` | Every automatic calculation derived from the binding D&D 5e 2014 profile MUST identify the local offline profile version, inputs, applicable rounding rule, and output, and MUST trace its published-rule derivation to the later authorized rule/domain owner. Travel, weather, restock, or other GM-authored calculations are outside this provenance clause unless they consume that rules profile. Product-confirmed rounding, including equal XP shares rounded up, is authoritative. | Same profile version and inputs yield the same exact result across OS, restart, import/export, and locale; no silent rule-profile refresh. | Versioned golden cases traced to preserved rule-owner evidence, boundary/rounding cases, offline execution, and profile/version readback. |

### Workflow-Specific Correctness

| ID | Priority | Sources | Obligation and rationale | Invariant or measure | Proof route |
| --- | --- | --- | --- | --- | --- |
| `TN-34` | P0 | `SRC-F04` | Name-only creation from a Running Scene MUST default to attaching the new object to that Scene and MUST offer an explicit opt-out before confirmation. Creation plus the chosen attachment outcome is one confirmed transition. | Confirming the default creates exactly one object attached to exactly the initiating Scene; opting out creates exactly one unattached object; failure creates neither partial outcome. | Production-route default/opt-out/failure/retry matrix with duplicate names and Scene switch during confirmation. |
| `TN-35` | P0 | `SRC-R01` | XP granted to an inactive PC MUST create exactly one deferred informational notice. The notice MUST appear on that PC's next activation and clear only after that delivery is durably recorded; restart or retry cannot omit or duplicate it. | Deferred notice delivery count is `0` before the next activation and exactly `1` afterward. | Inactive award, repeated award, activation, crash-before/after-delivery, retry, and deactivate/reactivate sequence oracle. |
| `TN-36` | P0 | `SRC-P04`, `SRC-L03`, `SRC-R03` | Note search MUST cover every Campaign object kind that can own notes, including notes edited in a Running Scene. A confirmed edit becomes part of the next search truth without stale or missing object classes. | For the exact manifest corpus, result identities equal the complete cross-kind oracle; a confirmed Scene edit is visible to the next search and first useful result obeys `TN-21`. | Per-kind seeded corpus, namesake, edit/search race, restart, locale, and archive/active-set production-route qualification. |
| `TN-37` | P0 | `SRC-Q05` | For each Encounter Table evaluation, the supplied candidate set MUST equal that evaluation's contextually eligible entries and preserve every authored relative weight without making the narrative selection. A reusable entry may be eligible again in a later evaluation. | Candidate identities equal the evaluation-specific eligibility oracle; normalized authored weight ratios are exact and remain stable across restart and locale. | Fixed-input context, eligibility, identity, and exact normalized-weight conformance cases across repeated evaluations. |

## Measurable Runtime Quality Scenarios

| Scenario | Stimulus | Environment and affected truth | Required response and measure | Proof |
| --- | --- | --- | --- | --- |
| `QS-01 Live interaction` | GM focuses a Scene, moves a participant, changes HP, edits a note, invokes search, or follows a named frequent path | `RP-H` + `RP-R`, with and without each long-work category; current Campaign truth and projection | input feedback <=100 ms p95; completed action or first useful search result <=1 s p95 and 10 s timeout; absolute budget unchanged under background work; `TN-21` action counts pass | per-action production-route timing, action trace, and semantic-state oracle |
| `QS-02 UI non-blocking` | generation, import, export, simulation, weather, or map work runs | focused Running Scene remains active | no interaction-thread stall >100 ms p95 or 1 s timeout; live workflow remains fully usable | separate per-workload population and recorded input latency |
| `QS-03 Cancellation` | GM cancels long work at early, middle, and commit-boundary phases, repeatedly | accepted/unaccepted results, staging, marked/unmarked temp files, queues, and resources exist | one terminal outcome; acknowledgement <=1 s p95; no new effect after acknowledgement; cleanup <=10 s; accepted results remain; no unaccepted mutation; after 20 cycles memory is within 10% steady state and marked artifact count <=1 per capability | Campaign/staging manifest, temp/resource/handle/queue measurement, restart, resume/discard, and retry |
| `QS-04 Preservation` | confirmed mutation followed by abrupt loss | normal and pressured `RP-R`; durable Campaign truth | acknowledged-work loss = 0; safe acknowledgement <=1 s p95 and 10 s timeout; unsafe work was visibly pending | crash/power/write-failure injection |
| `QS-05 Warm switch` | GM switches Campaign with active Scenes, masks, travel, overrides, and pending reconciliation | warm `RP-R` and `RP-L` on each supported OS | 100% useful-state equivalence and safely rendered next mutation; ready <=1 s p95 and 10 s timeout | state snapshot and next-action comparison |
| `QS-06 Start/resume` | clean cold start, crash restart, or post-conversion start | `RP-R`/`RP-L`, each supported OS | 100% useful-state equivalence; ready <=5 s p95 `RP-R`, <=10 s p95 `RP-L`; progress visible after 1 s | separate cold/crash/conversion populations and next-action comparison |
| `QS-07 Recovery` | full store or one independently addressable unit is damaged | unique safe recovery exists or choices are ambiguous | automatic unique recovery with exact disclosure; RPO <=60 s; complete restore including media <=5 min `RP-R`/20 min `RP-L`; salvage mode explicitly lists omissions | corruption corpus, complete restore and separate salvage-manifest drill |
| `QS-08 Portability` | complete export/import across OS with source computer absent or crafted input supplied | all intact asset, definition, trash, optional-data, and runtime classes | semantic/asset equality 100%; independent Campaign; <=10 min `RP-R`/60 min `RP-L`; atomic cancel/reject; no path escape/execution/network/shared-state mutation | OS-pair round trip and adversarial import matrix |
| `QS-09 Spatial display` | pan/zoom/focus, single/regional edit, reveal, visibility, weather, elevation, light, or hidden state change | every viewport density and cold/warm asset tier | feedback <=100 ms p95; complete safe projection <=1 s p95; prohibited leaks = 0 | exact viewport manifest, sustained interaction, memory peak, visibility and frame-safety oracle |
| `QS-10 World catch-up` | independently timed Scenes cross none/some/all eligible, established, dependent, consequence-producing, and danger-bound candidates | exact `RP-R`/`RP-L` scheduling manifest | <=60 s `RP-R`, <=15 min `RP-L`; live budgets preserved; counts match manifest; each occurrence <=1; danger boundary pauses | controlled clocks, candidate/eligible/commit counts, cancel/restart and once-only oracle |
| `QS-11 Capability failure` | each supporting capability faults once and repeatedly | explicit survivor matrix below | detection <=1 s from observable failure/first defective access; survivor journeys retain `TN-21`; confirmed/retained-data loss and out-of-envelope resource growth = 0; affected capability identified/retryable | per-capability survivor timings, sentinels, retained-data and resource-envelope audit |
| `QS-12 Exceptional pressure` | low disk, memory pressure, CPU contention, damaged input, or oversized axis | pressure decision table below | `RP-X` ceilings and 1 s admission/error deadline pass; no truncation/corruption; safe read/export/retry survives | long-duration pressure and completeness/resource audit |
| `QS-13 Accessibility/localization` | keyboard-only use, locale switch, 200% scale, color unavailable, or mixed-DPI display move | complete core across full `RP-H` display matrix | all workflows/action counts pass; no trap/loss; 4.5:1 text and 3:1 essential non-text contrast; no color-only fact; authored text unchanged | keyboard/action suite, contrast scan plus human review, pseudo-localization/display round trip |

## Change Scenarios

| Scenario | Change stimulus | Required response and measure | Verification |
| --- | --- | --- | --- |
| `CS-01 Content kind` | Add a Campaign content kind with identity, notes, search, history, and export behavior. | Existing unrelated kinds, Campaign truth, and acceptance behavior remain semantically unchanged; any compatibility work is declared and qualified rather than judged by touched-file count. | Add/remove fixture kind and compare unrelated state/behavior/data. |
| `CS-02 Runtime mask` | Add a mask which may coexist and share participants. | Scene continuity and participant authority remain unchanged; removing/moving a participant reconciles without modifying unrelated masks. | Two-mask conformance scenario plus failure/removal. |
| `CS-03 Influence family` | Add a location/weather/time influence consumed by generation or ambience. | Existing influence semantics do not change; absence is neutral; addition/removal cannot corrupt accepted results or history. | Metamorphic before/add/remove comparison. |
| `CS-04 Generator/importer` | Add or replace a generator or importer. | Unaccepted results remain isolated, cancellation is clean, accepted results use the same lifecycle and safety boundaries, and core manual workflows remain available. | Conformance, cancel, malformed-input, and replacement suite. |
| `CS-05 Optional capability` | Omit, remove, replace, then restore music, weather, maps, or another supporting capability. | Campaign opens throughout; unrelated workflows/data are unchanged; retained data round-trips and becomes usable again. | Four-state capability matrix with semantic digests. |
| `CS-06 Third-party presentation` | Add a presentation including a passive-display projection. | It receives only disclosed/consented data and cannot expose prohibited GM-private/mechanical state or write Campaign truth. | Adversarial permission and information-flow test. |

## Cross-Workflow Invariants

| Scenario | Required invariant set |
| --- | --- |
| Split-Scene time and World catch-up | `TN-08`, `TN-09`, `TN-13`, and `TN-23`: independent clocks, once-only shared consequences, persistent conflict visibility, live-first scheduling. |
| Travel interruption and undo/redo | `TN-12`, `TN-15`, and `TN-22`: checkpoint is durable before further route progress, undo is causally bounded, retry/redo duplicates nothing. |
| Encounter completion and XP | `TN-10`, `TN-06`, `TN-33`, and `TN-35`: one atomic confirmed outcome, explanatory history retained, versioned exact rounding, one deferred inactive-recipient notice. |
| Shop restock, trade, and history | `TN-09`, `TN-10`, and `TN-06`: restock once, trade all-or-nothing, manual stock outside rule scope unchanged, explanatory fact retained. |
| Crash during save or update | `TN-15`, `TN-16`, `TN-17`, and `TN-18`: no acknowledged loss, truthful pending state, safe recovery, prior version remains usable after failed conversion. |
| Corrupt individual data | `TN-17` and `TN-27`: affected identity isolated and disclosed; remaining Campaign and unrelated capabilities open. |
| Complete Campaign import | `TN-01`, `TN-02`, `TN-19`, and `TN-33`: independent Campaign identity, closed asset/definition set, explicit conflicts, preserved rule provenance. |
| Large maps and passive display | `TN-20`, `TN-21`, and `TN-24`: complete sparse/dense truth, responsive viewport, zero hidden/private leak. |
| Faulty extension | `TN-27`, `TN-29`, and `TN-30`: extension disabled and identified, retained data intact, Campaign opens, no unauthorized access or egress. |

## Failure-Mode Analysis

| Hazard | Priority | Required detection | Required containment and proof |
| --- | --- | --- | --- |
| Confirmed-data loss | P0 | durability acknowledgement, integrity checks, restore drill | `TN-15`/`TN-17`; zero acknowledged loss, restore-tested recovery |
| Silent partial success | P0 | all-or-nothing outcome oracle and pending-state reconciliation | `TN-10`/`TN-11`; no hybrid truth, explicit pending dependents |
| Stale presentation shown as current | P0 | revision/freshness relationship observable without choosing its mechanism | `TN-11`/`TN-24`; stale state labeled or withheld, unsafe passive frame never shown |
| Unauthorized data egress | P0 | outbound observation and permission audit | `TN-29`/`TN-30`; zero real-data egress and zero undisclosed access |
| Duplicate time consequence | P0 | stable occurrence identity and applied-count audit | `TN-09`; count never exceeds one across retry, Scene order, or restart |
| Live-game blockage | P0 | end-to-end latency and stall monitoring under workload | `TN-21`/`TN-22`; live budgets retained, long work yields/cancels |

### Pressure Decision Table

| Stimulus | Admission and bound | Workflows that MUST remain available | Recovery transition |
| --- | --- | --- | --- |
| Destination lacks declared input/output plus temporary-space budget | reject before mutation within 1 s; no staging growth | safe read, choose another destination, export there, retry | retry after capacity/destination change |
| Local working storage reaches its safety reserve | reject new writes before unsafe acknowledgement; do not consume the reserve | safe read, export to a destination with capacity, retry | resume only after capacity is restored and integrity rechecked |
| Memory pressure would exceed 75% of `RP-H` | yield/cancel background work before the limit; one active + one pending per capability | Running Scene, Encounter, manual edit, preservation, safe export | explicit retry resumes from accepted/checkpointed truth only |
| CPU contention | background work yields; live `TN-21` budgets remain binding | all live/manual survivor journeys | backlog remains visible; process when capacity returns |
| Oversized data axis | no silent truncation; paginate/defer/reject the affected long operation with complete count/disclosure | safe read, targeted manual work, preservation, export, retry | operation resumes without duplicate or omitted truth |
| Damaged input/record/asset | isolate the named unit; no implicit substitute | unaffected Campaign, preservation, salvage export, retry/recovery | explicit recover/delete or complete restore |

### Capability Failure Survivor Matrix

All rows preserve Campaign opening and confirmed-work preservation. Initiating,
observing, or cancelling complete export and every survivor journey obeys
`TN-21`; export completion obeys `TN-19` and cancellation obeys `TN-22`.
Complete export includes opaque retained failed-capability data. Only the
separately labeled salvage route may omit an identified damaged unit.

| Failed capability | Allowed unavailable behavior | Required survivors |
| --- | --- | --- |
| Music/ambience | automatic/manual playback and queue changes | Running Scenes, Encounters, notes, maps, travel, manual Campaign editing |
| Weather | automatic weather progression and weather-derived calculation | Running Scenes, Encounters, manual time/place editing, manual overrides, travel inspection |
| Maps/spatial projection | map rendering, spatial authoring, route calculation that requires the map | Running Scenes, Encounters, administrative place assignment, notes, preservation |
| Generation | generation and regeneration | complete manual preparation, live Scene/Encounter work, accepted results |
| World progression/autonomy | catch-up and unresolved autonomous consequence | live/manual work, manual time advancement with visible backlog, established prior consequences |
| Optional extension/capability | only behavior requiring that provider | all core and other-capability workflows; retained provider data remains intact |

## Requirement And Constraint Coverage

Subsection IDs below cover every normative workflow subsection, including prose
before its acceptance list. The catalog's `Sources` column names these exact
subsection and constraint IDs; the acceptance table below records the separate
criterion-to-need relation.

| Source ID | Capability subsection | Technical needs |
| --- | --- | --- |
| `SRC-F01` | Campaign Lifecycle | `TN-02`, `TN-16` |
| `SRC-F02` | Reusable And Campaign-Specific Knowledge | `TN-01`, `TN-02`, `TN-04`, `TN-33` |
| `SRC-F03` | Roster, Current Party, And Planning Party | `TN-01`, `TN-02`, `TN-07` |
| `SRC-F04` | Minimal Creation And Explicit Deletion | `TN-01`, `TN-03`, `TN-05`, `TN-06`, `TN-34` |
| `SRC-P01` | Planning Workspace And Timeline | `TN-03`, `TN-28` |
| `SRC-P02` | Assisted Generation | `TN-03`, `TN-10`, `TN-13`, `TN-22`, `TN-33` |
| `SRC-P03` | Accepted World Content And Treasures | `TN-03`, `TN-10` |
| `SRC-P04` | Weather, Music, And Notes | `TN-14`, `TN-21`, `TN-25`, `TN-26`, `TN-36` |
| `SRC-L01` | Continuous Scene State And Party Splits | `TN-02`, `TN-05`, `TN-07`, `TN-11` |
| `SRC-L02` | Masks And Prepared Monster Groups | `TN-03`, `TN-07`, `TN-28` |
| `SRC-L03` | Live Search, Creation, Notes, And Music | `TN-21`, `TN-26`, `TN-28`, `TN-36` |
| `SRC-L04` | Independent Time And Weather | `TN-08`, `TN-09`, `TN-14`, `TN-25`, `TN-33` |
| `SRC-L05` | Passive Second Display | `TN-24`, `TN-31` |
| `SRC-T01` | Places, Subplaces, And Scene Continuity | `TN-02`, `TN-07`, `TN-21`, `TN-28` |
| `SRC-T02` | Travel, Interruptions, And Overrides | `TN-09`, `TN-12`, `TN-14`, `TN-15` |
| `SRC-T03` | Independent Scene Time And World Progression | `TN-08`, `TN-09`, `TN-12`, `TN-13`, `TN-22`, `TN-23` |
| `SRC-T04` | Hex Maps, Knowledge, And Visibility | `TN-20`, `TN-24`, `TN-25` |
| `SRC-T05` | Climate, Weather, And Ambience | `TN-14`, `TN-25`, `TN-26`, `TN-28` |
| `SRC-R01` | Encounter Consequences And XP | `TN-06`, `TN-10`, `TN-33`, `TN-35` |
| `SRC-R02` | Rewards And Narrative Notes | `TN-02`, `TN-10`, `TN-33` |
| `SRC-R03` | Character Loot Ledger | `TN-01`, `TN-06`, `TN-10`, `TN-21`, `TN-36` |
| `SRC-R04` | Cumulative Loot Guidance | `TN-10`, `TN-33` |
| `SRC-R05` | Corrections And History | `TN-04`, `TN-06`, `TN-10` |
| `SRC-S01` | Shop Identity And Inventory | `TN-01`, `TN-02`, `TN-05`, `TN-21` |
| `SRC-S02` | Trade And Character Ledger | `TN-06`, `TN-10` |
| `SRC-S03` | Restock And Randomized Stock | `TN-06`, `TN-09`, `TN-32`, `TN-33` |
| `SRC-D01` | Continuous Preservation And Resume | `TN-15`, `TN-16`, `TN-17` |
| `SRC-D02` | Complete Campaign Portability | `TN-01`, `TN-02`, `TN-04`, `TN-13`, `TN-18`, `TN-19`, `TN-22`, `TN-30`, `TN-33` |
| `SRC-D03` | Campaign Deletion | `TN-03`, `TN-05` |
| `SRC-Q01` | Offline Desktop Operation And Trust | `TN-02`, `TN-19`, `TN-21`, `TN-24`, `TN-30`, `TN-31` |
| `SRC-Q02` | Responsiveness, Scale, And Failure Isolation | `TN-03`, `TN-15`, `TN-16`, `TN-17`, `TN-18`, `TN-19`, `TN-20`, `TN-21`, `TN-22`, `TN-23`, `TN-25`, `TN-26`, `TN-27`, `TN-32` |
| `SRC-Q03` | Modular Change And Third-Party Extensions | `TN-27`, `TN-28`, `TN-29`, `TN-32` |
| `SRC-Q04` | Rules, Localization, Accessibility, And Displays | `TN-24`, `TN-31`, `TN-33` |
| `SRC-Q05` | Calendar, Encounter Tables, Dice, And PC Data | `TN-02`, `TN-08`, `TN-09`, `TN-13`, `TN-28`, `TN-32`, `TN-33`, `TN-37` |
| `SRC-C01` | Complete Encounter Outcome | `TN-06`, `TN-10`, `TN-33` |
| `SRC-C02` | Authoritative Party With Dependent Running Contexts | `TN-07`, `TN-11`, `TN-15`, `TN-16` |
| `SRC-C03` | Scene Save Before Encounter Synchronization | `TN-11`, `TN-15`, `TN-16` |
| `SRC-C04` | Explanatory Campaign History | `TN-04`, `TN-06`, `TN-08`, `TN-12`, `TN-13` |

External and policy sources contribute only the listed measurement or proof
constraint; they do not own product behavior.

| Constraint ID | Preserved source or owner | Technical needs or impact |
| --- | --- | --- |
| `EXT-NNG` | Nielsen Norman Group response-time evidence | `TN-21`, `TN-22` |
| `EXT-WCAG` | W3C WCAG 2.2 | `TN-31` |
| `EXT-DND2014` | preserved D&D Basic Rules 2014 evidence | `TN-33` |
| `EXT-ARC42` | arc42 quality-scenario guidance | no independent technical need; supplies the scenario form |
| `POL-RP` | `docs/project/policies/resource-policy.md` | `TN-32`; repository publication, agent data handling, and secret-management process rules remain solely in that owner and add no product-runtime requirement |

## Acceptance-Criterion Traceability

Acceptance IDs follow source order. The summary is descriptive only; the linked
capability requirement remains the behavior owner.

| Acceptance ID | Summary | Technical needs or no separate impact |
| --- | --- | --- |
| `AC-F01` | name-only Campaign creation | `TN-01`, `TN-02`; no separate quality constraint beyond minimal valid identity |
| `AC-F02` | immediate Campaign switch and exact runtime resume | `TN-02`, `TN-16`, `TN-21` |
| `AC-F03` | manual Session without Party | `TN-02`, `TN-28`; no additional constraint |
| `AC-F04` | Session expected Party cannot change table Party | `TN-02`, `TN-07` |
| `AC-F05` | independent Campaign copy | `TN-01`, `TN-02` |
| `AC-F06` | current definition, frozen completed fact | `TN-04`, `TN-33` |
| `AC-F07` | manual note-first narrative records | `TN-28`; no autonomous-resolution need |
| `AC-F08` | Scene creation default with opt-out | `TN-02`, `TN-10`, `TN-34` |
| `AC-F09` | deletion removes current/dependent runtime, preserves history | `TN-03`, `TN-05`, `TN-06` |
| `AC-P01` | complete manual preparation | `TN-03`, `TN-28`; generation remains optional |
| `AC-P02` | editable ordered timeline | `TN-03`, `TN-15` |
| `AC-P03` | plan replacement preserves placements | `TN-03` |
| `AC-P04` | impossible generation blocked with explanation | `TN-10`, `TN-13` |
| `AC-P05` | independent generated result changes | `TN-03`, `TN-22`, `TN-27` |
| `AC-P06` | placed content exposed without auto-start/award | `TN-03`, `TN-13` |
| `AC-P07` | placed Treasure Items remain editable/movable | `TN-01`, `TN-10` |
| `AC-P08` | weather requires no Session preparation | `TN-25`, `TN-27`; no separate persistence boundary |
| `AC-P09` | focused Scene autoplay and manual precedence | `TN-14`, `TN-26` |
| `AC-P10` | live note edit and cross-kind search | `TN-15`, `TN-21`, `TN-31`, `TN-36` |
| `AC-L01` | empty primary Scene | `TN-07` |
| `AC-L02` | each active PC in exactly one Scene | `TN-02`, `TN-07` |
| `AC-L03` | split/reunite without implicit deletion | `TN-05`, `TN-07`, `TN-08` |
| `AC-L04` | prepared group available without persistent Encounter | `TN-03`, `TN-28` |
| `AC-L05` | coexisting masks/shared participants | `TN-07`, `TN-28` |
| `AC-L06` | move removes participant from masks without block | `TN-07`, `TN-11` |
| `AC-L07` | live search/add/lightweight creation | `TN-21`, `TN-28`, `TN-31` |
| `AC-L08` | divergent Scene time without reversal | `TN-06`, `TN-08`, `TN-09` |
| `AC-L09` | independent weather and override release | `TN-09`, `TN-14`, `TN-25` |
| `AC-L10` | safe passive display | `TN-21`, `TN-24`, `TN-31` |
| `AC-T01` | unified complete/partial subgroup travel | `TN-02`, `TN-07`, `TN-21` |
| `AC-T02` | position/time advance to checkpoints | `TN-09`, `TN-12`, `TN-15` |
| `AC-T03` | interruption without narrative decision | `TN-12`, `TN-13` |
| `AC-T04` | override and causal undo/redo | `TN-08`, `TN-12`, `TN-14` |
| `AC-T05` | reuse World behavior and expose conflict | `TN-09`, `TN-13`, `TN-23` |
| `AC-T06` | coarse/fine Hex propagation | `TN-20`, `TN-24`, `TN-25` |
| `AC-T07` | passive union of knowledge/perception | `TN-24` |
| `AC-T08` | coherent weather/effects/notification | `TN-09`, `TN-25` |
| `AC-T09` | manual ambience coexists with automation | `TN-14`, `TN-26` |
| `AC-R01` | Encounter outcome, XP, Scene continues | `TN-06`, `TN-10`, `TN-33` |
| `AC-R02` | XP rounding, derived level, correction history | `TN-06`, `TN-10`, `TN-33` |
| `AC-R03` | one deferred XP information message | `TN-02`, `TN-09`, `TN-35` |
| `AC-R04` | shared reward distribution, no auto-recipient | `TN-10`, `TN-13` |
| `AC-R05` | manual narrative resolution | `TN-28`; no autonomous-resolution need |
| `AC-R06` | searchable/correctable ledger and stacks | `TN-01`, `TN-06`, `TN-21` |
| `AC-R07` | sold/given reminders and provenance | `TN-04`, `TN-06` |
| `AC-R08` | cumulative loot compensation | `TN-10`, `TN-33` |
| `AC-S01` | Shop ownership and stock identity | `TN-01`, `TN-02` |
| `AC-S02` | owner reassignment or co-trash/restore | `TN-03`, `TN-05` |
| `AC-S03` | Scene Shop availability | `TN-02`, `TN-21` |
| `AC-S04` | atomic purchase without coin deduction | `TN-06`, `TN-10` |
| `AC-S05` | atomic sale and counterparty | `TN-06`, `TN-10` |
| `AC-S06` | manual/fixed/random restock | `TN-09`, `TN-28`, `TN-32` |
| `AC-S07` | time rule once and scoped stock | `TN-09`, `TN-10` |
| `AC-S08` | trade/restock history without extra notice | `TN-06`, `TN-09` |
| `AC-D01` | automatic preservation and useful resume | `TN-15`, `TN-16` |
| `AC-D02` | newest safe recovery and disclosure | `TN-17` |
| `AC-D03` | complete source-independent restore | `TN-19`, `TN-30`, `TN-33` |
| `AC-D04` | import creates independent Campaign | `TN-01`, `TN-02`, `TN-19` |
| `AC-D05` | explicit shared-definition conflict choice | `TN-04`, `TN-13`, `TN-19` |
| `AC-D06` | recoverable then permanent Campaign deletion | `TN-03`, `TN-05`, `TN-17` |
| `AC-Q01` | offline core | `TN-30` |
| `AC-Q02` | cross-platform self-contained Campaign | `TN-19`, `TN-30` |
| `AC-Q03` | responsive live actions and cancellable long work | `TN-21`, `TN-22`, `TN-23` |
| `AC-Q04` | supporting failure isolation | `TN-26`, `TN-27` |
| `AC-Q05` | no unaccepted cancelled result | `TN-03`, `TN-22` |
| `AC-Q06` | safe data through update/damage/missing capability | `TN-17`, `TN-18`, `TN-27` |
| `AC-Q07` | remove/replace capability and restore data | `TN-27`, `TN-28` |
| `AC-Q08` | extension access after disclosure/consent | `TN-29`, `TN-30` |
| `AC-Q09` | incompatible extension cannot block or bypass safety | `TN-27`, `TN-29` |
| `AC-Q10` | accessible efficient workflows | `TN-21`, `TN-31` |
| `AC-Q11` | Calendar relevance without narrative decision | `TN-08`, `TN-09`, `TN-13` |
| `AC-Q12` | Encounter Tables supply weighted candidates | `TN-28`, `TN-32`, `TN-37` |
| `AC-Q13` | no general dice roller; internal randomness allowed | `TN-32`, `TN-33`; scope exclusion has no additional technical impact |
| `AC-Q14` | workflow-specific PC statistics | `TN-02`, `TN-13`, `TN-28` |
| `AC-C01` | complete Encounter outcome | `TN-06`, `TN-10`, `TN-33` |
| `AC-C02` | authoritative Party with pending dependents | `TN-07`, `TN-11`, `TN-15`, `TN-16` |
| `AC-C03` | saved Scene with pending Encounter sync | `TN-11`, `TN-15`, `TN-16` |
| `AC-C04` | explanatory history and narrow exceptions | `TN-04`, `TN-06`, `TN-12`, `TN-13` |

## Reverse Traceability And Orphan Check

Every `TN-*` above names at least one source subsection. `TN-15` through
`TN-25` additionally instantiate the capability baseline's explicit instruction
to establish measurable response, preservation, recovery, scale, map, and
World-catch-up budgets during technical-needs derivation. `TN-31` uses WCAG only
to make the owner-confirmed accessibility outcomes measurable; it does not add a
web technology requirement. `TN-33` uses preserved D&D evidence only to require
versioned, auditable offline rule truth; it does not adopt an external API or
rule table.

The forward tables cover every capability subsection and every acceptance
criterion. There are no orphan technical needs and no unassigned confirmed
acceptance criteria.

## Deliberately Deferred Product Research

The following does not block this `Active Target` because the baseline itself
parks it or assigns it to later product testing:

- exact music mood axes and categorization;
- player-operated or remote-play products;
- cross-map route planning convenience;
- procedural Hex generation and autonomous faction simulation;
- generic support for other game systems or D&D editions;
- concrete D&D rule tables and formulas owned by the later rule/domain owner.

This deferral MUST NOT be used to weaken the obligations above. In particular,
weather remains constrained by inputs, continuity, spatial/temporal resolution,
overrides, structured effects, and compute budgets, while its algorithm remains
open.

## Activation Review Record

The candidate is `Active Target` because:

- all source subsections and acceptance criteria have forward mappings;
- every `TN-*` has source, rationale, invariant or metric, and proof route;
- all numerical budgets are explicit qualification targets, not Draft values;
- the catalog contains no runtime API, schema, module, persistence mechanism,
  framework, or technology choice;
- cross-workflow hazards and change scenarios have objective verdicts;
- no unresolved product ambiguity was invented from technical design space.

Accepted and rejected adversarial review findings are recorded in the final
pull-request discussion and commit history rather than duplicated as durable
architecture truth here.

## Evidence

### Local Product And Policy Inputs

- `docs/project/requirements/requirements-program-capabilities.md`
- `docs/project/vision.md`
- `docs/project/policies/resource-policy.md`

### Preserved External Evidence

- Global mirror
  `/home/aaron/Schreibtisch/projects/references/quality-requirements/arc42-quality-requirements.md`
  (`sha256:a57682b667a5d42a8d7eaeb3802b279f6ce8924a3bacbdc94d02f3744b71b5ed`), original
  <https://docs.arc42.org/section-10/>: scenario structure and the requirement
  that quality scenarios be specific and measurable.
- Global mirror
  `/home/aaron/Schreibtisch/projects/references/literature/nngroup-response-times-3-important-limits.md`
  (`sha256:a134dbb02a4f01726fc3e8e6de4fb6cd121d129077c2c6e0ea502cadbead6aa6`), original
  <https://www.nngroup.com/articles/response-times-3-important-limits/>:
  100 ms direct-manipulation, 1 s uninterrupted-flow, 10 s attention/progress,
  and interrupt thresholds used to calibrate `TN-21` and `TN-22`.
- Global mirror
  `/home/aaron/Schreibtisch/projects/references/literature/w3c-wcag22.md`
  (`sha256:d3a25e622eed7c8efda82aa90252a50c84055e786b709f86d26feec0385e151c`), original
  <https://www.w3.org/TR/WCAG22/>: technology-neutral testable keyboard,
  non-color, minimum-contrast, and 200% text-resize criteria used to make
  `TN-31` measurable.
- Global mirror
  `/home/aaron/Schreibtisch/projects/references/literature/dnd-basic-rules-2014-adventuring.md`
  (`sha256:de451e4a3e80e97947ad5aa0c071e43d05367905e7f7c6070ecdaf13a7b5e220`), original
  <https://www.dndbeyond.com/sources/dnd/basic-rules-2014/adventuring>:
  preserved 2014 rules evidence for time scales and six-second rounds. It is
  evidence for provenance discipline, not the owner of SaltMarcher rules.
