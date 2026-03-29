# AGENTS.md

This file defines the repository-specific operating constraints for Claude Code (claude.ai/code) and OpenAI Codex agents. Treat it as local engineering law: preserve the documented architecture, prefer repository-specific precedent over generic agent habits, and do not weaken an invariant unless the user explicitly asks for that change.

## Project Structure & Module Organization

**Language:** Java (no modules), JavaFX UI, SQLite via raw JDBC. Build via Gradle wrapper (`./gradlew`) with Java 21 toolchain and OpenJFX plugin.

**Structure** (feature-first):
- `src/features/<feature>/{model,application,repository,state,ui,api,bootstrap}` — canonical architecture by ownership layer; each feature uses only the roles it actually needs
- `src/database/DatabaseManager` — connection factory. `getConnection()` returns a fresh Connection with `PRAGMA foreign_keys=ON` and `journal_mode=WAL`; callers own it via try-with-resources. `setupDatabase()` uses idempotent `CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE` seeding
- `src/importer/` and `src/shared/crawler/` — crawler/import pipeline
- `src/ui/` — JavaFX shell/bootstrap (`src/ui/bootstrap/`) plus shared UI-only components (`src/ui/components/`)
- `resources/salt-marcher.css` — single CSS source of truth. `data/` for runtime data and backups

**AGENTS.md placement convention:** the root `AGENTS.md` is for project-wide rules only. Feature-specific architecture, workflows, invariants, package roles, and editor/runtime behavior belong in the nearest local `AGENTS.md` under that feature subtree. If a rule stops being globally true and starts describing one feature, move it out of the root file. When both files exist, apply both, with the deeper local file governing the feature-specific details. Before changing files in a subtree, check whether that subtree defines a nearer `AGENTS.md`; if it does, treat that local file as required context, not optional reference.

**DB storage conventions:** Multi-value fields stored as delimited strings — `KEY:value,KEY:value,...` (e.g. `SavingThrows = "CON:10,INT:12"`, `Senses = "darkvision:60"`). Junction tables (`creature_biomes`, `creature_subtypes`, `item_tags`) for many-to-many. `campaign_state` is a singleton row (id=1). No name-column indexes anywhere (leading-wildcard `LIKE` can't use B-tree).

## Build & Run

```bash
./gradlew build                  # compile + convention checks
./gradlew build --console=plain 2>&1  # recompile after every code change — fix all errors before proceeding
./gradlew run                    # start JavaFX app
./gradlew installDesktopApp      # reinstall desktop launcher
./gradlew crawler                # monster crawl + import
./gradlew crawlerItemsPipeline   # item crawl + import
./gradlew crawlerItemsSlugs      # slug-list only
./gradlew importMonsters         # import only (no crawl)
./gradlew importItems            # import only (no crawl)
```

Legacy end-to-end scripts: `./scripts/crawl.sh`, `./scripts/crawl-items.sh`.

No test framework. No linter. The app database is SQLite at `${XDG_DATA_HOME:-~/.local/share}/salt-marcher/game.db` (auto-created on first run). Schema changes require deleting that DB and re-running `./scripts/crawl.sh` — there are no ALTER TABLE migrations. For ad-hoc DB inspection, prefer the vendored CLI at `./tools/sqlite3` or `./gradlew sqliteQuery --args='data/game.db .tables'`.

**After code changes, do not stop at `./gradlew build` alone** when the desktop app is the manual test surface. Default to running `./gradlew build` and then `./gradlew installDesktopApp` before handoff unless the user explicitly says not to reinstall the desktop app. Notes about "nicht geprüfte Vorgänge" (unchecked operations) are expected and can be ignored.

**First run:** database is empty after clone. Run `./scripts/crawl.sh` to populate monster data (requires `crawler.properties` — copy from `crawler.properties.example` and add a valid D&D Beyond session cookie). `./scripts/crawl-items.sh` does the same for items. Without data the app starts but shows no creatures.

## UI Shell Architecture — Cockpit Layout

The shell uses a four-panel "cockpit" layout. Views project content into fixed panels:

```
+---toolbar------------------------------+
| side | Controls      | Details         |
| bar  | (top-left)    | (top-right)     |
|      |---------------+-----------------|
|      | Main          | State           |
|      | (bottom-left) | (bottom-right)  |
+------+---------------+-----------------+
```

- **Controls** — filters, sliders, tool palettes (`getControlsContent()`)
- **Main** — primary workspace: monster table, hex map, canvas (`getMainContent()`)
- **Details** — detail inspector: stat blocks, tile properties (`getDetailsContent()`)
- **State** — game state: encounter roster/tracker, travel info (`getStateContent()`)

Left column is a VBox (Controls takes natural height, Main fills rest — not resizable). Right column is a vertical SplitPane (Details / State — resizable). SplitPane items are set once and never mutated; content is swapped inside StackPane containers to preserve divider positions.

- **AppShell** — `BorderPane`: sidebar (left) | `mainSplit` (center, horizontal SplitPane: `leftColumn` | `rightSplit`). Divider positions saved per-ViewId and restored on navigate-back
- **AppView** interface: `getMainContent()`, `getControlsContent()`, `getDetailsContent()`, `getStateContent()`, `getTitle()`, `getToolbarItems()`, `getIconText()`, `onShow()`/`onHide()`. Only `getMainContent()` and `getTitle()` are required; all others have defaults
- **ViewId** enum + **ViewCategory** (SESSION vs EDITOR). To add a new view: (1) add enum entry, (2) implement AppView, (3) call `shell.registerView()` in SaltMarcherApp
- **AppShell navigation:** `navigateTo()` saves dividers → `onHide()` → `applyViewContent()` → restores dividers → `onShow()`. `refreshPanels()` re-reads all 4 panels without touching SplitPane items (safe for mode switches). `refreshToolbar()` rebuilds toolbar only
- **SESSION views** return `null` from `getDetailsContent()`/`getStateContent()` → shell shows its own **InspectorPane** and **ScenePane**, persistent across SESSION view switches. **EDITOR views** override these to provide view-specific content
- **InspectorPane** (shell-owned Details default): `showStatBlock(id)` toggles; `ensureStatBlock(id)` always shows; `showContent(title, node)` for arbitrary content; cancels pending async loads on new requests
- **ScenePane**/**SceneHandle** (shell-owned State default) — tabbed bottom-right area. Views register persistent tabs via `SceneHandle`. Tab bar auto-hidden when only 1 tab. `SceneHandle.setContent(node)` swaps content

### Feature-Local AGENTS Files

- `src/features/encounter/AGENTS.md` — encounter-specific interaction, generation, and combat/runtime behavior
- `src/features/world/hexmap/AGENTS.md` — hex map and overworld-specific rendering, editing, and calendar rules
- `src/features/world/dungeonmap/AGENTS.md` — dungeon editor architecture, model layering, and package roles

## Architecture Guidelines

Salt Marcher is a feature-oriented monolith.
Code is organized primarily under `src/features/<feature>/`.
This architecture exists to prevent drift: every capability should be defined once, owned once, and subordinated to the layer that is responsible for keeping it coherent.

This root file is binding for the entire repository.
Local `AGENTS.md` files refine these rules for a feature.
Local `AGENTS.md` files may define additional local structure, but they must not weaken the global ownership and dependency rules.

If a package layer, filename role, or global rule is not defined here, it is not part of the repository-wide architecture.
Additional structure belongs only in the nearest feature-local `AGENTS.md`, or as a precise domain name that does not pretend to be a new global role.

### Guidelines

- Give every capability one central owner.
- Place each capability on the lowest common owner that is actually edited, described, or constrained by it.
- Objects and types may gain capabilities through composition, inheritance, or references, but ownership of the capability stays with the central owner instead of being mirrored in consumers.
- Treat package layers as ownership boundaries. A capability belongs to the layer that subordinates it to its owner, not to the first caller that happens to use it.
- Treat filename roles as ownership markers. A role name tells the reader what kind of capability a file encapsulates and whether it is the owner or support code around that owner.
- Treat the role families below as function patterns, not as a mandatory suffix list. Use the family that matches the file's job, then choose the narrowest clear domain name for the concrete type.
- In `model/`, the central owner will usually be a precise domain type, not a generic role suffix. Prefer the domain name when the type itself is the canonical owner.
- If several sibling files in one directory share the same role name, treat that as a smell: either the capability is duplicated or the directory needs a narrower subpackage with clearer ownership.
- Use only the canonical roles defined below when one fits cleanly. If none fits, use a precise domain name instead of stretching a near-match.
- Passive domain nouns such as `*Snapshot`, `*Descriptor`, `*Entry`, `*Criteria`, `*Option`, `*Profile`, `*Resolution`, `*Lookup`, `*Parser`, and `*Renderer` may remain precise domain names without becoming new global architecture roles.
- Operation-shape names such as `*Factory`, `*Generator`, `*Calculator`, `*Classifier`, `*Normalizer`, `*Assembler`, `*Coordinator`, `*Context`, `*Planner`, `*Matcher`, `*Engine`, and `*Realizer` may remain precise helper names, but they are not repository-wide architecture roles.
- New code must follow the target architecture immediately.
- Touched code should move toward the target architecture at the nearest safe seam without widening scope.
- Preserve behavior, storage assumptions, user workflows, and explicit invariants unless the task explicitly requires changing them.
- Avoid wrappers, adapters, or intermediate packages whose only purpose is to rename existing complexity.
- Legacy code may remain until touched, but legacy shapes do not create new precedent.
- When goals compete, use this order: preserve correctness and satisfy the user request; preserve explicit repository invariants and local `AGENTS.md` rules; keep the change small enough to verify safely; then move the touched code toward the target architecture.

### Layers

Reason about ownership in this order:
- domain and editor truth live in `model/`
- use-case and workflow logic live in `application/`
- persistence access lives in `repository/`
- shared transient runtime state lives in `state/`
- feature-local presentation and interaction live in `ui/`
- public feature boundaries live in `api/`
- internal wiring lives in `bootstrap/`

The default dependency direction is `ui -> application -> repository -> model`.
`state/` may be observed by `ui/` and coordinated by `application/`, while `model/` remains the canonical truth.
Typical read flow still starts at `ui/` and follows dependencies inward.
If a feature defines a nearer `AGENTS.md`, that file is required context before any change in that subtree.

#### `model/`

- Owns canonical business and editor truth.
- Carries behavior on the lowest stable owner that actually enforces the invariant.
- Stays framework- and storage-agnostic.
- `model/` contains an owner ecosystem, not just owner types.
- `Owner` — canonical domain or editor truth. Usually named as the precise domain type instead of a generic suffix.
- `Primitive` — fundamental value, geometry, vocabulary, or identity type reused by owners and operators.
- `Relation` — reference, binding, endpoint, or link type that connects owners without becoming the owner of either side.
- `Derivative` — model-internal derived form such as a plan, rewrite, network, or projection built from owner truth.
- `OperationData` — model-local input, context, request, or intermediate result carrier for one operator family.
- `Operator` — model-local planning, matching, generation, or transformation logic that stays framework-free and answers to owner truth instead of workflow orchestration.
- `ComputationModel` — internal search, graph, topology, or solver structure used by an operator and not exposed as canonical domain truth.
- `*Policy` — decision-focused operator family for allowed options or rule selection.
- `*Session` — only when the session itself is pure in-memory canonical runtime truth rather than workflow orchestration.

#### `application/`

- Owns use-case orchestration.
- Sequences workflows, async work, transactions, reload-after-write behavior, and cross-feature coordination.
- Coordinates repositories, state containers, and feature APIs without becoming canonical domain truth.
- `*ApplicationService` — user-visible workflow entrypoint for one use case or workflow slice.
- `*Loader` — one-shot loading or materialization into domain or UI-ready structures.
- `*Catalog` — read-only selection, lookup, or index surface that supports workflow decisions.
- `*Projector` — derivation of read, preview, or presentation-oriented structures from authoritative state.
- `*Projection` — derived internal data shape produced from authoritative truth for one workflow, planner, or consumer surface.
- `*Session` — long-lived mutable runtime workflow context with explicit lifecycle.
- `*Port` — internal capability contract when the seam belongs to one application slice instead of the public API.

#### `repository/`

- Owns direct storage access.
- Carries SQL, row mapping, query construction, persistence ordering, and storage-specific lookups.
- Remains stateless; callers provide the `Connection`.
- `*Repository` — direct relational storage adapter.
- `*Store` — persistence surface for non-relational blobs, backups, snapshots, or file-oriented payloads.
- `*Schema` — storage-structure owner for DDL, compatibility, and schema-shape maintenance in one persistence area.
- `*Mapper` — storage-facing translation between rows, records, and owned domain representations.
- `*Codec` — bidirectional encoding/decoding for stored representations and persistence formats.

#### `state/`

- Owns shared transient UI, editor, and workflow state.
- Carries selection, drafts, previews, modes, and other runtime interaction truth.
- Supports the workflow around canonical truth without replacing it.
- `*State` — shared transient mutable runtime truth.
- `*Draft` — in-progress editable state that is not yet committed.
- `*Preview` — ephemeral possible result shown before commit.

#### `ui/`

- Owns feature-local presentation and interaction code.
- Contains views, panes, dropdowns, canvases, controls, and UI controllers.
- Talks to application services and state containers, not directly to persistence policy.
- `*View` — top-level application surface for the shell and navigation model.
- `*Pane` — composed UI region with its own layout and local behavior.
- `*Controls` — dedicated controls region for one surface.
- `*Canvas` — primary draw and direct-manipulation surface.
- `*Dropdown` — anchored non-modal editor window or popup surface.
- `*Controller` — interaction coordinator for one concrete surface.
- `*Navigator` — history, focus, or directional traversal owner for one content surface.
- `*Tool` — user-selectable editor interaction mode or narrow operator-facing action surface.
- UI-local `*Handle` types may live next to the UI surface that returns them.

#### `api/`

- Is the cross-feature entrypoint.
- Contains deliberate boundary contracts and boundary data only.
- Root-level `api/` holds the public role families exposed to other features.
- `*Api` — deliberate cross-feature boundary surface.
- `*Port` — public capability contract across package or feature boundaries.
- `*Summary` — lightweight read projection for selectors, lists, and inspectors.
- `*Request` — named input payload for one use case or API call.
- `*Result` — named output payload for one use case or API call.
- `*Handle` — public capability token for later interaction, cleanup, or content replacement.
- Boundary-facing `*Mapper` and `*Codec` types may live here when they serve the public API seam rather than persistence.

#### `bootstrap/`

- Owns internal composition roots and assembly-only wiring.
- Wires collaborators and exposes feature entrypoints.
- `SaltMarcherApp` remains the cross-feature top-level composition root.
- `*Module` — composition root for one feature surface. Only place a `*Module` in `api/` when the module itself is the public feature entrypoint.

### Legacy Name Transition

New code uses the canonical families above.
Legacy names may remain in untouched code, but touched code should converge toward the allowlist:
- bare `*Service` only when it is truly an `*ApplicationService`
- `*Provider` -> `*Port`
- `*Popup` -> `*Dropdown` or `*Pane`
- `*Scoring` -> `*Policy` or a precise domain helper name
- `*Presenter` -> `*Pane`, `*Projector`, or `*Controller`
- prefer a precise owner or target role over `*Manager`, `*Helper`, `*Util`, `*Processor`, `*Support`, or `*Surface`

## Key Conventions

The rules in this section are decision filters, not soft preferences. When multiple approaches are possible, choose the one that preserves ownership, minimizes hidden coupling, and matches the existing repository pattern. If a proposed change requires an exception, name the exception explicitly instead of silently drifting the pattern.

### Code Style
- 4-space indentation, `PascalCase` for classes, `camelCase` for methods and locals, lowercase packages
- `try-with-resources` for all JDBC connections, statements, result sets
- UI text stays German; established DnD terms (`Encounter`, `CR`, `Deadly`) remain English. Code identifiers, comments, and commit messages are English
- Avoid `System.out` and `System.err` in feature application/repository code. Error logging elsewhere: `System.err.println` with format `ClassName.methodName(): message` (no logging framework)
- Comments must earn their keep. Use them to preserve invariants, UX rules, or non-obvious constraints; do not narrate obvious control flow or restate the code in English

### Repository & Application Conventions
- Repositories are stateless (`Connection` passed in). Let repositories propagate `SQLException`; fallback behavior, retries, and user-facing degradation belong in application workflows
- Application workflows may propagate `SQLException` from repositories and transaction boundaries, but business validation must use domain/argument exceptions (`IllegalArgumentException` or a feature-specific edit exception), not `SQLException`
- Precise helper types such as `*Factory`, `*Generator`, `*Calculator`, `*Classifier`, `*Normalizer`, `*Assembler`, `*Coordinator`, `*Planner`, `*Matcher`, and comparable pure helpers are static-only with private constructor unless they need explicit state
- Stateful workflow entrypoints (`*ApplicationService`, `*Session`) are instance-based
- Legacy `service/` packages may remain in untouched code, but new code uses `application/`. When touching legacy `service/` code, keep public workflow entrypoints at the package root and move close collaborators into focused subpackages instead of widening visibility
- Cross-feature read DTOs belong in `src/features/<feature>/api/`, not in `model/`. Use the `*Summary` naming pattern for lightweight selector DTOs. Keep `model/` focused on domain/editor state, not transport shapes for other features
- Feature module APIs should expose narrow, role-specific setup methods. Do not hide unrelated wiring behind a generic `initialize(...)` entrypoint

### Async & Threading
- `javafx.concurrent.Task` + `new Thread()` (daemon, named `sm-<operation>` e.g. `sm-filter-load`, `sm-encounter-gen`, `sm-combat-setup`, `sm-stat-block`, `sm-save-terrain`)
- Always set `setOnFailed` handler; guard cancellation via `if (!task.isCancelled())`. Background work without explicit failure handling is incomplete, not "good enough"
- **Callbacks:** `Consumer`/`Runnable` pattern; pane setters follow `setOn<Event>()` naming

### CSS & Theming
- `resources/salt-marcher.css` is the single source of truth for design tokens (CSS variables on `.root`)
- `ThemeColors.java` has `Color` constants mirroring CSS variables for Canvas-only drawing — must be kept in sync manually

### UI Naming
- `*View` = AppView impls, `*Pane` = Region subclasses, `*Dropdown` = anchored non-modal editor windows backed by `Popup`, `*Popup` = legacy popup controllers not yet renamed, `*Controls` = left-column control panels, `*Canvas` = canvas subclasses for specific contexts

### Editor & Inspector Design Rules

**Editor windows:** must be anchored dropdown windows, not modal pop-up dialogs. Use non-modal `Popup`-based dropdowns that stay within fullscreen mode, return focus to the trigger, and render confirmations inline. Do not introduce modal flows for editor CRUD just because they are faster to wire.

**Inspector (upper-right Details):** the single global, context-spanning information surface. Static or read-mostly content (stat blocks, item descriptions, room/area descriptions, table summaries) must be shown via the shared `DetailsNavigator`/`InspectorPane` flow so back/forward history works consistently. Do not introduce feature-local "details" panels that duplicate this role; that is architectural drift, not harmless local convenience. Treat the inspector as persistent global navigation state — do not clear or replace it just because a view temporarily has no selection. Selection state and inspector state are separate concerns: only update the inspector if the same card is still the currently visible global entry.

**State pane (lower-right):** view-local forms, tool settings, create/rename/delete actions, validation feedback, transient workflow hints, and interactive workflow UI belong here.

**Narrow inspector exceptions:** small, direct GM quick interactions on the currently open reference object (short name/notes/description edits) are allowed. Keep these lightweight, single-entity scoped, and subordinate to the inspector's primary role as a read-first reference surface.

**Editor controls:** must be self-explanatory without helper prose. No explanatory copy, onboarding text, repeated summaries, or filler narration. Prefer short labels, stable grouping, and consistent ordering. In sidebars: active context first, tool-specific settings second, management actions after selectors, visibility toggles last. Render control text from enum label/value accessors instead of duplicating German strings in multiple panes.

## Testing & Verification

Do not add or change automated tests unless explicitly requested. The minimum quality gate is `./gradlew build`. If you change importer or parser flows, run the relevant crawler/import task. If you change schema or storage assumptions, rebuild `game.db` from crawled data and protect user-created data with backups or migration logic.

Verification claims must be literal. Do not imply that a build, install, import, migration, or manual check happened unless you actually ran it. If something was not verified, say so directly and name the missing check.

After each completed implementation pass, rerun `./gradlew build` and then `./gradlew installDesktopApp` before handoff. Skip the reinstall only when the user explicitly waives it or when the task is purely non-code planning/review work.

## Commit Guidelines

Follow Conventional Commits: `feat: add encounter recovery filter`, `refactor(ui): simplify shell navigation`. Keep each commit focused on one concern. Call out schema, crawler, or backup-format impacts explicitly. Do not hide unrelated cleanup inside a convenience commit.

Start-of-task protocol for every implementation request:
1. Inspect the worktree for pre-existing local modifications.
2. Commit those existing modifications.
3. Push them to `main`.
4. Only then begin the newly requested change.

This is mandatory, not advisory. The presence of pre-existing local modifications is not a reason to pause and ask whether you should commit them; it is the trigger to perform steps 2 and 3 before starting the new task. Do not reinterpret this rule into "never commit/push existing changes" or "wait for approval because the tree is dirty". The required default action is: inspect, commit, push, then proceed.

Only stop and surface a blocker when you hit a concrete obstacle that prevents the protocol itself from being completed safely, for example merge conflicts, missing push credentials, sandbox restrictions that require explicit approval, or suspected secrets in the pending changes. "There are already modified files" is not a blocker; it is the condition the protocol exists to handle.

## Security

Never commit secrets. Keep crawler cookies only in local `crawler.properties` (copy from `crawler.properties.example`). Store database backups in `data/backups/db/`, not in the repository root.
