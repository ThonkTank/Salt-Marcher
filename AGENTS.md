# AGENTS.md

This file defines the repository-specific operating constraints for Claude Code (claude.ai/code) and OpenAI Codex agents. Treat it as local engineering law: preserve the documented architecture, prefer repository-specific precedent over generic agent habits, and do not weaken an invariant unless the user explicitly asks for that change.

## Project Structure & Module Organization

**Language:** Java (no modules), JavaFX UI, SQLite via raw JDBC. Build via Gradle wrapper (`./gradlew`) with Java 21 toolchain and OpenJFX plugin.

**Structure** (feature-first):
- `src/features/<feature>/{model,repository,service,ui}` — primary architecture by domain capability
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

## Architecture Direction

Salt Marcher has a defined target architecture. Agents must treat this target architecture as the default for all new code and as the direction of travel for all modified code.

Architectural convergence is mandatory, but it is incremental. Do not plan or execute large architecture-only refactors unless the user explicitly asks for them.

## Canonical Package Roles

Use the following package roles with their exact meanings. Do not create new architectural package names when one of these roles already fits.

- Organize feature code under `src/features/<feature>/`
- A feature may contain `api/`, `bootstrap/`, `model/`, `application/`, `service/`, `repository/`, `loading/`, `persistence/`, `state/`, `ui/`, and `shell/`
- `api/` is the only cross-feature entrypoint; internal packages are not public architecture even if Java visibility would allow access
- Root-level `api/` contains only public boundary types: `*Api`, `*Module`, `*Port`, `*Summary`, `*Request`, `*Result`, `*Handle`, and public enums or records required by those contracts
- `api/` must not contain implementation-detail wrappers, storage facades, or UI re-exports
- Public UI reuse is opt-in and lives under `api/ui/`; do not place UI aliases at the root of `api/`
- `bootstrap/` contains internal composition roots and assembly-only wiring; `SaltMarcherApp` owns cross-feature top-level composition
- The default dependency direction is `ui -> application -> loading/repository/persistence -> model`; `service/` may be used wherever its logic stays pure
- Specialized namespaces such as `builder/`, `combat/`, `generation/`, `catalog/`, or `recovery/` are allowed only for coherent bounded subsystems; they are local slices, not new architectural roles, and must reuse the same package roles internally

### `model/`

- Contains canonical business and editor truth
- Put state and behavior on the lowest-level owner that is the real source of truth
- If an operation preserves or transforms an object's own invariant, that behavior belongs on the model
- Must not depend on JavaFX, repositories, `loading/`, `persistence/`, or shell classes

### `application/`

- Contains use-case orchestration
- Owns workflow sequencing, async orchestration, task submission, transaction boundaries, reload-after-write behavior, and cross-feature coordination
- May normalize requests, coordinate repositories and loaders, call other features through ports, and map failures for callers
- Does not own canonical domain truth

### `service/`

- Contains pure or near-pure domain logic
- May compute, classify, score, normalize, validate, map, or generate
- Must not own transactions, JDBC access, background threading, JavaFX nodes, or workflow sequencing

### `repository/`

- Contains direct storage adapters
- Owns SQL, row mapping, query construction, persistence ordering, and storage-specific lookup methods
- Repositories are stateless and receive `Connection` from callers
- Must not own workflow state, background work, UI state, or cross-feature orchestration

### `loading/`

- Is synchronous read-side aggregate assembly
- Reconstructs rich aggregates or read models from one or more repository-level queries
- Must not submit tasks, own JavaFX callbacks, mutate UI state, or hide workflow sequencing
- Ordinary one-query finders stay in `repository/`, not `loading/`

### `persistence/`

- Is write-side aggregate persistence support
- Use it for multi-table write orchestration helpers, `*WriteRepository`, schema helpers, and `*PersistenceMapper`
- Must not become a second generic repository layer
- Do not add pass-through wrappers that only rename a repository without adding aggregate persistence behavior

### `state/`

- Contains shared transient UI, editor, or workflow state
- Is the canonical owner of transient interaction truth shared across multiple UI classes
- Must not perform persistence directly and must not duplicate canonical domain truth

### `ui/`

- Contains feature-local presentation and interaction code
- Views, panes, dropdowns, popups, canvases, controls, and UI controllers live here
- May call application services and state containers but must not own storage access, transaction boundaries, or cross-feature composition

### `shell/`

- Is reserved for adapters that bind a feature to the global app shell, shared inspector, shell-owned workspaces, or shell lifecycle
- Is not a second general-purpose UI package

## Canonical Type Names

Use the following names with their exact meanings. New code must pick one of these names when the role fits. If none fits, the design is still underspecified.

### Composition And Boundary

- `*Module` wires collaborators and exposes a feature surface; it lives in `api/` if public and `bootstrap/` if internal
- `*Api` is a stable public boundary facade in `api/`; it must not expose implementation-only collaborators or JavaFX-only concerns
- `*Port` is a narrow capability contract; it lives in `api/` if public and otherwise next to the owning application package
- `*Summary`, `*Request`, `*Result`, and `*Handle` are boundary transport names; they live in `api/` or another explicit boundary package, not in `model/` unless they are true domain records

### Workflow And Storage

- `*ApplicationService` is a use-case or workflow orchestrator in `application/`; if a class coordinates a user-visible workflow, tasks, transactions, reloads, or failure mapping, it is an `*ApplicationService`
- `*Session` is a long-lived mutable runtime object with explicit lifecycle; it belongs in `application/` when it owns IO, timers, or background work, and in `model/` when it is purely in-memory canonical runtime truth; passive data holders are not sessions
- `*Repository` is a direct storage adapter in `repository/`; use `*WriteRepository` in `persistence/` for aggregate write support
- `*Loader` is a synchronous read assembler in `loading/`; it must not create threads, submit JavaFX tasks, or mutate UI/state containers
- `*Catalog` is a read-only index or descriptor over already-available data; if it queries storage directly, it is not a catalog
- `*Mapper` translates between representations and owns structure transformation only; use `*PersistenceMapper` in `persistence/` for write-side encoding helpers

### Pure Domain Logic

- `*Generator` is a pure or near-pure constructor or search algorithm that produces new candidates, layouts, or outputs from inputs; it lives in `service/` or in a model subpackage when tightly coupled to invariants
- `*Calculator`, `*Scoring`, `*Classifier`, `*Normalizer`, and `*Rules` are narrow pure-domain roles in `service/`; prefer the most specific suffix over a vague `*Service`

### UI And State

- `*Controller` coordinates interaction for one concrete view, pane, dropdown, canvas, or toolbar in `ui/` or `shell/`; if it mostly owns workflow sequencing, task orchestration, or storage side effects, it is not a controller
- `*View`, `*Pane`, `*Dropdown`, `*Popup`, `*Canvas`, and `*Controls` are UI surface names
- `*State`, `*Draft`, and `*Preview` are transient shared-state names: stable mutable runtime state, in-progress user-authored state, and ephemeral preview data respectively

### Restricted Names

- `*Provider` is reserved for simple pull-based suppliers only; use `*Port` for capability contracts and `*Factory` for object creation
- Bare `*Service` is forbidden for new code; choose a precise suffix instead
- Bare `*Manager`, `*Helper`, `*Util`, `*Processor`, and `*Persistence` are forbidden when a canonical name above fits
- New code must not use `*Catalog` for storage-backed readers, `*Loader` for async orchestration or UI task helpers, `*Controller` for workflow orchestrators, or `*Session` for passive data holders

## Architecture Convergence Rules

Agents must treat the package roles and type names above as the default for all new code and as the direction of travel for all touched code.

### Required Behavior

- New code must follow the target architecture immediately
- New code must choose both a canonical package role and a canonical type name from the rules above
- Do not add new code in a legacy shape just because nearby code has not yet been migrated
- When modifying existing code, prefer the lowest-risk change that leaves the touched area closer to the target architecture than before
- If multiple solutions would satisfy the request, choose the one that better matches the target architecture and reduces future divergence
- Preserve behavior, storage assumptions, user workflows, and existing invariants unless the task explicitly requires changing them
- Do not widen scope merely to improve architectural purity
- No incidental cross-feature rewrites, speculative cleanup passes, or subsystem reshaping unless explicitly requested
- If full alignment would require unrelated file edits, public API churn, schema or storage changes, or broad retesting, stop at the nearest safe seam and improve the local design only
- Prefer removing hidden coupling, duplicate state, and ownership ambiguity over introducing new transitional abstractions
- Do not add wrappers, adapters, or indirection whose only purpose is to postpone a larger refactor unless they provide immediate value in the current change
- Legacy code may remain until touched; legacy code is not precedent for new code
- When a touched area still cannot reasonably be brought closer to the target architecture within the requested scope, note the remaining gap briefly in the final handoff instead of starting an unrelated refactor

### Decision Order

When goals compete, use this order:

1. Preserve correctness and satisfy the user request
2. Preserve explicit repository invariants and local `AGENTS.md` rules
3. Keep the change small enough to verify safely
4. Within that safe scope, move the touched code toward the target architecture

### Non-goals

- Do not rewrite stable code solely for stylistic uniformity
- Do not force simple record-oriented features into richer abstractions unless the complexity genuinely requires it
- Do not flatten rich domain areas into generic service or repository CRUD just to make the codebase look more uniform

## Key Conventions

The rules in this section are decision filters, not soft preferences. When multiple approaches are possible, choose the one that preserves ownership, minimizes hidden coupling, and matches the existing repository pattern. If a proposed change requires an exception, name the exception explicitly instead of silently drifting the pattern.

### Authoritative Model Ownership
- Model the domain as self-owning objects composed bottom-up from simpler primitives into higher-complexity objects
- Define each capability exactly once at the lowest common owner that is actually edited, described, or constrained by that capability
- Higher-level objects may compose and reuse lower-level capabilities, but must not mirror, duplicate, cache, or locally re-derive the same capability state
- The object being acted on is the authoritative owner of its capabilities; other systems must query that object for the central truth instead of maintaining parallel interpretations
- When choosing where behavior or state belongs, prefer the stable single owner over convenience adapters, projections, synchronization code, or cross-system shadow state

### Code Style
- 4-space indentation, `PascalCase` for classes, `camelCase` for methods and locals, lowercase packages
- `try-with-resources` for all JDBC connections, statements, result sets
- UI text stays German; established DnD terms (`Encounter`, `CR`, `Deadly`) remain English. Code identifiers, comments, and commit messages are English
- Avoid `System.out` and `System.err` in feature service/repository code. Error logging elsewhere: `System.err.println` with format `ClassName.methodName(): message` (no logging framework)
- Comments must earn their keep. Use them to preserve invariants, UX rules, or non-obvious constraints; do not narrate obvious control flow or restate the code in English

### Repository & Service Conventions
- Repositories are stateless (`Connection` passed in). Let repositories propagate `SQLException`; fallback behavior, retries, and user-facing degradation belong in services
- Services may propagate `SQLException` from repositories and transaction boundaries, but business validation must use domain/argument exceptions (`IllegalArgumentException` or a feature-specific edit exception), not `SQLException`
- Utility services (`*Calculator`, `*Scoring`, `*Tuning`, `*Setup`, `*Classifier`, `*Generator`) are static-only with private constructor
- Stateful workflow/session services (`*ApplicationService`, `*Session`) are instance-based
- `service/generation/internal` contains search collaborators; keep internals package-private where possible
- Within `service/` packages, keep public services at the package root. When a concern grows into a subsystem with multiple collaborators, place the coordinator and helpers together in a focused subpackage (e.g. `service.topology`). Same rule for editor/UI subpackages — move close helpers with the subpackage and keep internals non-public instead of widening visibility to cross package boundaries
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
