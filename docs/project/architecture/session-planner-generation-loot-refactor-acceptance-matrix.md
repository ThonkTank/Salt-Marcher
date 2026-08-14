# Session Planner, Generation, and Loot refactor acceptance matrix

Status: normative for development schema 27.

This matrix is the completion ledger for the Session Planner, Session
Generation, Encounter import, Reward XP, and Loot architecture refactor. A row
is complete only when its named owner, public or internal contract, command or
projection, and direct test evidence all exist. A green broad test does not
substitute for missing row-level evidence.

Status values:

- `DONE`: current implementation and direct evidence satisfy the row
- `PARTIAL`: a compatible slice exists, but at least one named guarantee or
  proof is missing
- `OPEN`: the required architecture or direct evidence is absent

## Foundations and deterministic generation

| ID | Guarantee | Owner | Contract / command | Required direct evidence | Status |
| --- | --- | --- | --- | --- | --- |
| SGL-01 | Requirements for Generation, Planner, Loot, Resolution, and Group management describe the same ownership and XP policy. | Product docs | Linked requirements | Documentation consistency test/search | DONE |
| SGL-02 | The checked catalog, not a live network read, is runtime truth and every spreadsheet rule has a versioned formula/table/stage/test provenance entry. | Session Generation | Rule-provenance contract and catalog manifest | Catalog artifact check plus provenance completeness test | DONE |
| SGL-03 | One canonical JSON/SHA-256 implementation with explicit exclusions owns every semantic and command fingerprint. | Shared/Core | `canonicalJson`, fingerprint builders | Canonicalization, exclusion, and cross-owner architecture tests | DONE |
| SGL-04 | Core arithmetic cannot mix Party XP, per-character XP, base XP, adjusted XP, reward XP, copper, Gold/XP, or Magic/XP accidentally. | Session Generation / Encounter | Nominal core value types and explicit basis converters | Compile-time fixtures, basis-mismatch tests, and arithmetic unit tests | DONE |
| SGL-05 | Session runs record encounter and reward engine versions; group reward runs record only the reward engine version. | Session Generation | `GeneratedRun` union | Contract and write/read tests | DONE |
| SGL-06 | Generation issues, warnings, audits, and preparation failures are codes plus structured parameters; Core and Utility publish no localized prose. | Session Generation / Planner | Structured issue and receipt schemas | Contract tests and forbidden-localized-output architecture test | DONE |
| SGL-07 | The reward engine is eight explicit pure stages with immutable inputs/outputs and documented pre/postconditions. | Session Generation | Reward stage modules | One focused unit suite per stage | DONE |
| SGL-08 | Rational arithmetic is retained until each documented rounding point. | Session Generation | Reward budget and target stages | Rounding-boundary unit tests | DONE |
| SGL-09 | Entropy labels are closed typed builders owned by the entropy module; feature code contains no free stream strings. | Session Generation | Reward entropy builders | Engine-version stream stability and architecture tests | DONE |
| SGL-10 | The session profile produces Encounter, Quest, Environment, and Overstock planning while the group profile produces exactly one normal Encounter reward. | Session Generation | Profile-specific stage inputs | Profile Golden tests independent of exact item selection | DONE |
| SGL-11 | Generated domain truth has no renderer-formatted text or summaries. | Session Generation | Generated contracts | Schema/store introspection and renderer-presenter tests | DONE |

## Relational development schema 27

| ID | Guarantee | Owner | Contract / command | Required direct evidence | Status |
| --- | --- | --- | --- | --- | --- |
| SGL-12 | Generated runs are a closed `session` / `group_reward` union with normalized owner tables for every declared child collection. | Session Generation persistence | `GeneratedRunStore` | Schema inventory and round-trip tests | DONE |
| SGL-13 | No GeneratedRun domain payload is stored as JSON. Receipt JSON remains explicitly separate. | Session Generation persistence | Schema 27 | `PRAGMA table_info` introspection test | DONE |
| SGL-14 | Run kind, channel, rarity, quantities, positions, owner relationships, and Loot provenance combinations fail closed through SQL constraints. | Session Generation / Loot persistence | Schema 27 DDL | Direct invalid-SQL constraint tests | DONE |
| SGL-15 | Run hydration reads treasures, items, and containers in bounded batched queries and returns one deeply frozen contract from both `read` and `findByFingerprint`. | Session Generation persistence | `GeneratedRunStore` | Query-count, deep-freeze, and equality tests | DONE |
| SGL-16 | Semantic run identity excludes workflow/command IDs and changes for engine, catalog, preset, policy, or group-revision meaning. | Session Generation | Origin fingerprint | Origin matrix tests | DONE |
| SGL-17 | Campaign reward rules are campaign-owned, revisioned, CAS-updated, receipt-reconciled, and default to `base`. | Campaign Rules | `campaignRules.read/update/commandReceipt` | New-campaign, CAS, conflict, and lost-response tests | DONE |
| SGL-18 | Planner scene titles persist as `authored`, `generated_encounter`, `generated_quest_rewards`, or `generated_environment_rewards`; editing a generated title converts it to authored. | Session Planner | Scene title contract and save command | Store, projection, and renderer edit tests | DONE |
| SGL-19 | Treasure drafts edit containers and item-container assignments while allocated quantities remain protected. | Loot | Treasure create/update contracts | Aggregate-diff and editor tests | DONE |
| SGL-20 | Character ledger provenance is structured domain data and all arrows/labels are renderer-derived. | Character Loot | Ledger entry contract | Store round-trip and presenter tests | DONE |
| SGL-21 | One monotone Loot metadata revision advances once per successful mutation and never on a retry. | Loot | Loot projection metadata | Command retry and invalidation tests | DONE |
| SGL-22 | Preparation and Loot journals contain every specified operation, fingerprint, target, stage, recovery, error, and result field. | Planner / Loot persistence | Schema 27 journals | Schema inventory and recovery tests | DONE |

## Reward XP and group reward generation

| ID | Guarantee | Owner | Contract / command | Required direct evidence | Status |
| --- | --- | --- | --- | --- | --- |
| SGL-23 | Resolution publishes eligible base, adjusted, effective reward XP, XP fraction, awarded XP, per-player XP, policy, and policy revision. | Encounter | Resolution projection | Contract and combat integration tests | DONE |
| SGL-24 | Adjusted XP uses selected eligible enemies and current party size through the one shared multiplier function. | Encounter / Shared | Encounter XP evaluation | Shared parity tests | DONE |
| SGL-25 | Award validates expected policy revision; a policy change writes nothing, returns stale, and refresh uses the new policy. | Encounter | Award command | Stale/no-write integration and renderer tests | DONE |
| SGL-26 | Group reward generation revalidates prospective or persisted non-archived group drafts, complete roster, scene, party, and campaign-rule revisions in Utility. | Loot / Group reward | `loot.generateForGroupDraft` | New, dirty, archived, deleted, and stale matrix tests | DONE |
| SGL-27 | Group reward budgets use the same base/adjusted policy and multiplier semantics as Resolution. | Loot / Session Generation | Group reward command | Cross-feature parity tests | DONE |
| SGL-28 | Preview writes only an immutable run; atomic confirmation validates the complete editable Treasure draft, creates or updates the group, and materializes exactly one group-anchored treasure with rollback across both owners. | Loot / Scene | `loot.commitGroupReward` | Edited/removed/catalog-added line, rollback, idempotency, revision, and provenance integration tests | DONE |
| SGL-29 | Group generation automatically creates an inline editable Loot draft with hidden independent seeds; roster replacement is discard-protected, drafts are cached per Group, and Loot can be rerolled independently. | Renderer Group management | `GroupManagerState` reducer/controller | Mapping, semantic history, invalidation, caching, component, and E2E tests | DONE |

## Loot application and projections

| ID | Guarantee | Owner | Contract / command | Required direct evidence | Status |
| --- | --- | --- | --- | --- | --- |
| SGL-30 | Treasure persistence, scene/inbox projection, operation journal, ordinary commands, distribution, group reward coordination, and character ledger are separate owner-focused components. | Loot | Internal ports/handlers | Architecture-boundary and handler unit tests | DONE |
| SGL-31 | Application handlers receive narrow context factories and do not instantiate foreign concrete stores outside the composition root. | Loot application | Pick-ports | Static architecture tests | DONE |
| SGL-32 | Treasure update first builds a validated retained/inserted/updated/deleted/reassigned diff, then applies it in deterministic transactional order. | Loot | Aggregate diff | Allocated/packed diff unit and integration tests | DONE |
| SGL-33 | Every Loot command returns the exact original result on same retry and `idempotency_conflict` for another payload. | Loot | Operation journal | Per-command retry/conflict tests plus replay through a newly composed service after a simulated lost response | DONE |
| SGL-34 | `LiveSessionSnapshot` and Session/Combat/Travel mutations transport no Loot projection. | Session boundary | Live session contract | Contract and architecture tests | DONE |
| SGL-35 | `loot.scene` returns only focused location/group treasures and a revision; it excludes unplaced/unresolved items. | Loot projection | `loot.scene` | Projection-shape integration test | DONE |
| SGL-36 | `loot.inbox` is separately paginated by cursor/limit and loaded only when opened. | Loot projection | `loot.inbox` | Pagination, stable cursor, and renderer demand tests | DONE |
| SGL-37 | Scene and inbox hydration batch-load relevant treasures, items, and containers. | Loot projection | Projection stores | Query-count tests | DONE |
| SGL-38 | Anchor diagnosis reads narrow anchor rows first and hydrates only actual unresolved hits. | Loot projection | Inbox/reference diagnostic | Query-shape tests | DONE |
| SGL-39 | A renderer-local LootSceneController owns scene identity, request epoch, revision, invalidation subscription, and inbox pagination. | Renderer Loot | Narrow Loot port/controller | Delayed read, scene switch, move, and invalidation tests | DONE |
| SGL-40 | Combat reads group treasure identities through a narrow reader rather than the broad Loot store. | Encounter | `GroupTreasureReader` | Architecture and combat tests | DONE |
| SGL-41 | One renderer Money presenter formats copper consistently in Planner, Session, Loot, and Ledger. | Renderer | Money presenter | Cross-feature presenter tests | DONE |
| SGL-42 | `sold` and `given_away` remain correction statuses, not normal sale/give-away workflows. | Character Loot | Correction command | UI absence and correction tests | DONE |

## Durable preparation and Encounter import

| ID | Guarantee | Owner | Contract / command | Required direct evidence | Status |
| --- | --- | --- | --- | --- | --- |
| SGL-43 | Generated Encounter preparation/commit are internal and split into pure roster selection, canonical CR parsing, batch validation, and Encounter-owned commit. | Encounter | Internal import ports | Unit/integration tests and public-operation absence | DONE |
| SGL-44 | Encounter batch origin depends on run/engine/catalog/preset/roster meaning, never operation ID, and equal origins reuse plans. | Encounter | Batch origin fingerprint | Origin/reuse tests | DONE |
| SGL-45 | Generated plan names persist structurally by encounter ordinal and localize only in Renderer. | Encounter | Generated plan metadata | Store and presenter tests | DONE |
| SGL-46 | Public Planner preparation consists only of start, receipt, cancel, and changed-event APIs. | Session Planner | `startPreparation`, `preparationReceipt`, `cancelPreparation`, event | Registry/API/preload absence and contract tests | DONE |
| SGL-47 | Start returns `confirmation_required` or an accepted receipt immediately; a Utility queue performs generation, encounter resolution, and saving in event-loop-yielding stages. | Session Planner | Start command and receipt | Queue scheduling, visible-stage, and responsive renderer tests | DONE |
| SGL-48 | Receipt states are queued/generating/resolving_encounters/saving/succeeded/invalid/stale/failed/canceled with structured failure metadata. | Session Planner | Preparation receipt schema | Exhaustive contract/projection tests | DONE |
| SGL-49 | Startup resumes every nonterminal operation from the first phase not durably proven complete. | Session Planner | Preparation worker | Five-boundary restart integration tests | DONE |
| SGL-50 | Final planner replacement and journal `succeeded` commit in one SQLite transaction. | Session Planner persistence | Final commit operation | Interruption/transaction test | DONE |
| SGL-51 | Cancel persists `cancel_requested`, is checked at all three boundaries, and cannot override a final commit already begun. | Session Planner | Cancel command/worker | Boundary race tests | DONE |
| SGL-52 | Same operation ID retries its receipt; a changed request conflicts; immutable foreign artifacts are never compensated. | Session Planner | Preparation journal | Retry/conflict/row-count tests | DONE |
| SGL-53 | Generated scene IDs derive from semantic run origin plus encounter ordinal or reward channel, never operation ID. | Session Planner | Scene identity builder | Determinism/retry tests | DONE |

## Renderer and capability boundary

| ID | Guarantee | Owner | Contract / command | Required direct evidence | Status |
| --- | --- | --- | --- | --- | --- |
| SGL-54 | Planner orchestration, draft mutation, draft projection, catalog, scene list, inspector, budget, status, and dialogs are separated components. | Renderer Planner | Controller/reducer/projector/ports | Unit tests and size/boundary checks | DONE |
| SGL-55 | Draft projection uses current unsaved participants/day/count/scenes plus current search summaries and rewards; no old-workspace/draft mixture remains. | Renderer Planner | `projectPlannerDraft` | Unsaved-change and attached-summary tests | DONE |
| SGL-56 | React views receive narrow Planner, Encounter-search, Loot, and Campaign-rule ports and do not call the general capability API directly. | Renderer | Feature adapters | Static import and component tests | DONE |
| SGL-57 | `operations.ts` is the sole operation registry and owns namespace/method, mode, role, deadline, and input/output schemas. | Shared boundary | Operation registry | Registry metadata tests | DONE |
| SGL-58 | API types, preload facade, request contracts, role/deadline authorization, and exhaustive Utility handlers are derived from that registry. | Shared/Preload/Utility | Registry derivation | Exact-set architecture tests | DONE |
| SGL-59 | Every operation accepts one input object or `undefined`; positional ergonomics exist only in renderer feature adapters. | Boundary | Derived API | Type and runtime contract tests | DONE |
| SGL-60 | Preload imports no individual feature schemas. | Preload | Derived facade | Static architecture test | DONE |
| SGL-61 | Public full-day generation, generated Encounter prepare/commit, Planner begin/resolve/commit, and old Session Loot generation operations are absent. | Boundary | Operation registry | Forbidden-operation tests | DONE |
| SGL-62 | Saved Encounter search/summary remain public and bounded for interactive Planner use. | Encounter Plans | Search/summary operations | Contract/integration tests | DONE |
| SGL-63 | Loot and Preparation events come from one typed event registry with exact API/preload/main/handler sets. | Boundary | Event registry | Exact-set architecture tests | DONE |

## Bundle, feedback, and end-to-end proof

| ID | Guarantee | Owner | Contract / command | Required direct evidence | Status |
| --- | --- | --- | --- | --- | --- |
| SGL-64 | Fixed bundle ceilings are never raised during this refactor; measured snapshot changes require explicit change, dependency, and chunk rationales. | Build architecture | Bundle policy | Baseline-history and budget tests | DONE |
| SGL-65 | Planner, Group Loot preview, editor, distribution, ledger, and campaign rules are lazy leaves; renderer imports contracts as types only. | Renderer/build | Route and dialog imports | Manifest graph and static import tests | DONE |
| SGL-66 | Reachable renderer is at most 90% of 3.20 MiB and common Workspace JavaScript at most 810 KiB. | Build architecture | Bundle budgets | Production manifest measurement | DONE |
| SGL-67 | `check:planner-loot` runs affected unit/integration tests, typecheck, and bundle verification. | Developer feedback | Package script | Script registry/unit test | DONE |
| SGL-68 | Ten isolated Electron suites remain in `pnpm check`; E2E covers process boundaries, recovery, accessibility, and principal visual flows. | End-to-end | E2E suite registry | Registry and canonical check | DONE |
| SGL-69 | Planner preparation survives an Electron restart and a Utility restart during active work, while queued, generating, resolving, saving, and ready are visibly observed. | Planner E2E | Preparation event/receipt flow | Dedicated active-restart UI journey | DONE |
| SGL-70 | Group-reward integration covers base/adjusted policy, stale protection, acceptance, move, distribution, and Ledger; separate v3 Group Loot journeys cover catalog editing/discard protection and atomic commit/restart, while v4 directly prepares the Distribution/Ledger journey. | Loot integration/E2E | Group reward and Loot ports | Handler integration matrix plus focused editor, commit, and distribution journeys | DONE |
| SGL-71 | Updated Group-manager and Group Loot light/dark Goldens plus Planner, Settings, Group Loot, and Distribution keyboard/focus/Escape/Axe checks are enforced; every manifest Golden has an executable assertion. | Renderer/E2E | Dialog surfaces | Component tests, named Goldens, manifest coverage, and isolated Electron checks | DONE |
| SGL-72 | The canonical `pnpm check` passes without baseline or budget increase. | Repository | Canonical check | One successful full invocation on the final SHA plus linked CI evidence | PARTIAL |

## Editable Group Loot draft extension

| ID | Guarantee | Owner | Contract / command | Required direct evidence | Status |
| --- | --- | --- | --- | --- | --- |
| SGL-73 | `loot.catalog` is Zod-validated, paginated, deterministic, pinned to the generated run catalog hash, and exposes active ordinary/magic items plus non-hidden containers with authoritative defaults and filters. | Loot catalog | `loot.catalog` | Contract/service search, filter, ordering, rounding, visibility, pagination, and stale-hash tests | DONE |
| SGL-74 | The Group manager projects each immutable generated Treasure into an editable local draft with stable IDs, closed origins, reusable policy-driven fields, catalog-only additions, merge rules, atomic container detachment, semantic undo/redo with text coalescing, per-Group caching, and discard protection. | Renderer Group management | Group Loot draft reducer and `GroupManagerState` | Draft commands, history, caching, invalidation, component, accessibility, and Golden tests | DONE |
| SGL-75 | The draft budget reports non-magic copper against the generated target with informational plus/minus 15 percent classification and reports magic target/current separately; it never blocks confirmation. | Renderer Loot | Group Loot budget projector | Budget boundary unit tests and E2E value-change assertion | DONE |
| SGL-76 | Atomic confirmation validates generated and pinned-catalog origins, derives magic/rarity/curse and explicit provenance server-side, persists edited/removable/added lines and packing through the Schema-27 aggregate writer, fingerprints the full draft, and rolls every owner back on invalid or stale input. | Loot application/persistence | `loot.commitGroupReward`, shared generated writer | Integration tests for metadata, assignments, exact retry/conflict, stale revisions, restart, and rollback | DONE |

## Architecture hardening evidence

| ID | Guarantee | Owner | Contract / command | Required direct evidence | Status |
| --- | --- | --- | --- | --- | --- |
| SGL-77 | One immutable catalog registry validates unique versions/hashes, manifests and table hashes; historical artifacts remain resolvable and the importer never overwrites a published directory. | Session Generation catalog | Registry/provider/importer | Current/historical, duplicate, corrupted-artifact, activation, and overwrite tests | DONE |
| SGL-78 | One prepared Loot index per catalog hash owns stable ordering, normalized search/filter data, and O(1) maps for each entry kind. | Loot catalog | `LootCatalogIndexCache` | Cache identity, ordering, filter, and lookup tests | DONE |
| SGL-79 | Capability validation failures preserve closed issue codes, stable Draft-ID paths, and bounded primitive parameters across every process boundary; missing historical catalogs use `catalog_unavailable`. | Shared/Utility/Main/Preload/Renderer | Capability failure/error contract | Contract, propagation, and field-association tests | DONE |
| SGL-80 | Schema 27 discriminates manual, generator, and ordinary/magic catalog provenance and enforces source uniqueness and metadata combinations in SQL. | Loot persistence | Treasure contract and DDL | Public-union round trip plus direct invalid-SQL tests | DONE |
| SGL-81 | Plain generated acceptance and edited Group rewards materialize into one internal shape and use one aggregate writer; commit phases have deterministic error priority. | Loot application/persistence | Materializers, revision guard, aggregate writer | Architecture, handler-order, rollback, and writer integration tests | DONE |
| SGL-82 | Exactly one reducer owns every Group-manager session, both histories, requests, views, pending intents, and conflicts; stale async results and unsafe transitions are centrally rejected. | Renderer Group management | `GroupManagerState` and intent guard | Exact-owner architecture test plus transition/token/conflict unit tests | DONE |
| SGL-83 | Group manager views are pure recipients of narrow state/actions and the only capability-aware application adapter injects entity-focused ports. | Renderer Group management | View/controller/capability adapter | Static import/ownership and component tests | DONE |
| SGL-84 | Lint and Vitest run in bounded sequential partitions, every TS/TSX source belongs to exactly one lint partition, and E2E suites produce atomic resumable per-suite evidence without automatic retries. | Developer feedback | Check and E2E runners | Partition coverage, suite registry, resume identity, and canonical-run evidence | DONE |

## Current audit summary

The named integration baseline is commit
`94d9576c87f98cf1731c54de2990d1c7e1fb84c1`, tagged
`group-loot-refactor-baseline`. Its recorded reachable-renderer snapshot is
2,981,101 bytes. No complete successful canonical-check run is attached to
that baseline SHA; it must not be represented as green evidence.

The direct architecture, unit, integration, bundle, component, and focused
Electron evidence is recorded by the named tests. A predecessor tree at
`2226468c2bbf93e10f1977169660bb7a8100e3f8` passed the linked cross-platform
[GitHub Actions run 31751190304](https://github.com/ThonkTank/Salt-Marcher/actions/runs/31751190304),
but subsequent issue-propagation, request-token, rollback, and Golden-policy
corrections changed the final tree. SGL-72 therefore remains `PARTIAL` until
the head SHA of the fifth stacked refactor PR passes `pnpm check` and its
linked CI run. The current reachable renderer measures 1,435,971 bytes without
increasing a fixed ceiling.

This summary is informational. The row statuses and direct evidence govern
completion and must be updated as the implementation advances.
