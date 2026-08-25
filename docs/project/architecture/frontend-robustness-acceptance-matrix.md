# Frontend robustness acceptance matrix

Status: normative for `FR0` through `FR7` in the
[frontend robustness roadmap](frontend-robustness-roadmap.md).

## Recorded FR0 baseline

The comparison baseline is `origin/main@7590d6653dc29f8c258529634caa28893320eebe`
on 2026-08-24. It records current mechanisms and risks; it does not accept them
as target behavior.

| Owner family | State classes present | Current mechanism and risk | Target phase | Required evidence |
| --- | --- | --- | --- | --- |
| Campaign/Workspace root | read projection, view state, async | overlapping loads write Campaign and Session separately; global readback increments a React remount key | FR2 | controlled A/B/A ordering, switch/write/readback/restart E2E, next-action oracle |
| Module host/navigation | view state, resource recovery | route and incident isolation is useful, but data readback currently shares the same remount mechanism | FR2, FR7 | separate module-failure and data-reconciliation tests; draft remains mounted |
| Live Session root | read projection | mutable `setSnapshot` is passed through Session, Encounter, Travel, Catalog, and integration consumers | FR3 | one projection owner, selector/action ports, zero direct view replacement |
| Session mutations | write, async | snapshot and Group mutations use latest-only acceptance even though transport may already execute | FR3 | real revision oracle with crossed commits, FIFO acceptance, restart and next action |
| Group/Group Loot | draft, write, read projection | one reducer is positive; generation, save/archive/combat, and Loot share latest-only command scopes | FR3 | per-Group authority matrix and rapid save/archive/commit journeys |
| Encounter/Loot | read projection, write | direct snapshot patches and independent Loot refresh/subscription can expose temporarily divergent truth | FR3 | exact patch/projection tests and dependent-pending failure journey |
| NPC/Location Catalog | read projection, draft, write | separated query/mutation modules are positive; writes still use latest-only modes and refresh several projections manually | FR4 | crossed page/detail/write tests, command-receipt reconciliation, draft survival |
| Faction/Encounter Table | read projection, draft, write | effects and event callbacks issue direct reads; writes publish local snapshots without shared ordering | FR4 | keyed scope accumulator, delayed event/read tests, related-dialog E2E |
| World Location integration | draft, write, reconciliation | exact receipts and partial-save recovery are positive and must be preserved | FR4 | all WL-01 through WL-16 journeys plus shared projection owner |
| Session Planner | draft, read projection, long work | authored-intent and queued Session commands are positive; catalog/workspace cache remains feature-local | FR5 | out-of-order, cancel boundary, restart/resume, inactive-Session catalog update |
| Hex | read projection, write, view state | per-map FIFO and receipt-aware writes are positive; Location and map projections still interact with other owners | FR6 | exact invalidation, off-screen result, context loss, location integration |
| Travel | read projection, write, view state | authority capture and FIFO commands are positive; shared Session publication still reaches the root setter | FR6 | provider/Scene isolation, joint Session result, local-intent reconciliation |
| Installation/settings | read projection, write | preference queue and receipt reconciliation are positive reference behavior | FR1, FR7 | reference contract plus zero alternate preference owner |
| Reference lookup/navigation | read projection, view state, async | provider-local navigation and refresh state composes static and Campaign revisions; it is remounted with the active workspace | FR3, FR4 | keyed static/Campaign acceptance, navigation survival, delayed document journey |
| Creature/biome options | read projection, async | several consumers create local option/search owners and direct filter reads | FR4 | shared query-key identity, consumer isolation, delayed option/search evidence |
| Generator/settings editors | draft, read projection, write | local reducers are appropriate, while presets/rules/preferences use separate read, stale, receipt, and busy patterns | FR1, FR5 | draft/command separation, exact receipt, concurrent settings journey |
| Shell/modal/navigation | view state, resource recovery | one overlay stack is positive; route remount currently determines unrelated feature-state lifetime | FR2, FR7 | explicit view-state survival matrix, focus restoration, zero data-driven remount |
| Passive renderer | read projection, resource recovery | separate fail-closed capability surface is positive; focused safe projection must never accept a stale unsafe frame | FR3, FR6 | role denial, focus switch, stale-frame oracle, process-loss recovery |
| Pixi/Babylon leaves | resource/view state | dynamic isolation is positive; final hardware/resource qualification is still open | FR6, FR7 | RP-H timing, 200% scale, context loss, 20-cycle resource evidence |

## Cross-phase guarantees

| ID | Guarantee | First owning phase | Required proof |
| --- | --- | --- | --- |
| FR-A01 | Every renderer state owner declares one target state class and authority key | FR0 | checked owner inventory and architecture test |
| FR-A02 | Reads may be latest-only; writes are FIFO per semantic authority | FR1 | typed mode gate and controlled independent/FIFO cases |
| FR-A03 | Same-authority revision selection occurs after the preceding result is accepted | FR1 | crossed command transport/acceptance test with a real revision oracle |
| FR-A04 | A stale result updates at most its own cache key and never newer visible authored state | FR1 | authority-key controlled promises |
| FR-A05 | Unknown write outcome reconciles by the same command identity and never blindly replays | FR1 | receipt present/absent/interrupted matrices |
| FR-A06 | Data reconciliation never remounts an unrelated workspace or discards its draft | FR2 | mounted sentinel and draft-preservation Electron journey |
| FR-A07 | Rapid Campaign switching restores coherent useful state and safely persists the next mutation | FR2 | FR2 current-format A/B/A production timing and semantic oracle; FR7 exact cross-OS `RP-R`/`RP-L` `QS-05` completion |
| FR-A08 | Running Play has one visible projection and exposes stale dependents as pending | FR3 | Scene/Party/Encounter/Loot fault matrix |
| FR-A09 | Catalog/editor search, selection, draft, submission, and persisted projection have separate owners | FR4 | crossed reads/writes and draft survival matrix |
| FR-A10 | Long work has one linear cancel result and cannot publish into a different authored authority | FR5 | early/mid/commit cancel plus switch/restart cases |
| FR-A11 | Spatial resource recovery is independent of domain, projection, and draft recovery | FR6 | context-loss/next-interaction and mounted-state evidence |
| FR-A12 | No legacy global readback, data remount, latest-only write, direct view snapshot replacement, or manual request epoch remains | FR7 | semantic zero-inventory gates with controlled mutations |
| FR-A13 | Live input feedback and completed common actions satisfy `QS-01` under background work | FR7 | production-route p95 populations and semantic result oracle |
| FR-A14 | The installed exact-SHA artifact passes owner acceptance after canonical handoff | FR7 | handoff receipt, installed identity, owner confirmation, green Main run |

## Required interaction and failure journeys

Every applicable migrated owner must cover these without sleeps or implicit
retries:

1. older read completes after a newer read;
2. two same-authority writes are dispatched before the first completes;
3. unrelated-authority write completes while the first is pending;
4. local authored intent changes while a remote read is pending;
5. authority changes before transport, after transport, and after commit;
6. invalidation arrives before and after command acceptance;
7. write returns success, typed stale, typed rejection, `outcome_unknown` with a
   receipt, and `outcome_unknown` without a receipt;
8. view unmounts and remounts before a result completes;
9. Utility process exits during a read and during a sent write;
10. the representative next mutation executes after recovery or restart.

## Phase audit record

For each phase, its pull request must include an audit comment or checked
artifact answering:

- Which roadmap and current-state sources were reread before implementation?
- Which authority, command key, and state-class decisions were made?
- Which intended work was awkward, simplified, duplicated, or deferred?
- Which shortcuts or weaker-than-intended tests were introduced?
- Does any finding threaten an acceptance row? If yes, what follow-up phase was
  implemented before promotion?
- Which focused, complete, remote, handoff, installed-runtime, and Main evidence
  applies?

A passing unit test cannot substitute for an interaction-level guarantee in
this matrix. Missing or indirect evidence leaves the row open.
