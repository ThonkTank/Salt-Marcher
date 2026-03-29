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

This section defines the repository's canonical architecture vocabulary, the target architecture, and the required behavior when changing code.

## Canonical Package Roles

Use the following package roles with their exact meanings. Do not create new architectural package names when one of these roles already fits.

### Feature Module

- A feature module is the top-level boundary under `src/features/<feature>/`
- A feature may contain `api/`, `bootstrap/`, `model/`, `application/`, `service/`, `repository/`, `loading/`, `persistence/`, `state/`, `ui/`, and `shell/`
- Everything inside a feature is internal by default unless explicitly exposed through `api/`

### Specialized Subfeature Namespace

- A specialized namespace such as `builder/`, `combat/`, `generation/`, `catalog/`, or `recovery/` is allowed only for a coherent bounded subsystem inside one feature
- A specialized namespace is not an architectural role; it is a local feature slice
- Inside that namespace, reuse the canonical package roles again instead of inventing ad-hoc buckets
- Do not create namespaces that merely restate implementation technique or file size

### Public Feature Boundary

- `api/` is the only cross-feature entrypoint
- Root-level `api/` contains only public boundary types: `*Api`, `*Module`, `*Port`, `*Summary`, `*Request`, `*Result`, `*Handle`, and public enums or records required by those contracts
- `api/` must not contain implementation-detail wrappers, storage facades, or UI re-exports
- If a feature intentionally exposes reusable UI as part of its public contract, place it under `api/ui/`; do not place UI aliases at the root of `api/`

### Composition Root

- `bootstrap/` contains internal composition roots and assembly-only wiring
- Cross-feature top-level composition belongs in `SaltMarcherApp`
- Feature-local composition belongs in one `*Module` entrypoint under `api/` if public, or under `bootstrap/` if internal
- Views, repositories, state containers, and domain objects must not act as hidden composition roots

### Domain Model

- `model/` contains canonical business and editor truth
- Put state and behavior on the lowest-level owner that is the real source of truth
- If an operation preserves or transforms an object's own invariant, that behavior belongs on the model
- `model/` must not depend on JavaFX, repositories, shell classes, or persistence helpers

### Application Layer

- `application/` contains use-case orchestration
- Application code may normalize requests, open transactions, coordinate repositories and loaders, call other features through ports, schedule background work, reload state, and map failures for callers
- `application/` owns workflow sequencing, not canonical domain truth
- Any class that owns async orchestration, task submission, reload-after-write behavior, transaction boundaries, or cross-feature coordination belongs in `application/`, not in `ui/`, `service/`, or `loading/`

### Domain Logic Layer

- `service/` contains pure or near-pure domain logic
- `service/` code may compute, classify, score, normalize, validate, or generate
- `service/` must not own transactions, JDBC access, background threading, JavaFX nodes, or workflow sequencing
- If a class needs storage, task orchestration, or reload logic, it is not a `service/` concern

### Repository Layer

- `repository/` contains direct storage adapters
- Repositories own SQL, row mapping, query construction, persistence ordering, and storage-specific lookup methods
- Repositories are stateless and receive `Connection` from callers
- Repositories must not own workflow state, background work, UI state, or cross-feature orchestration

### Loading Layer

- `loading/` is read-side aggregate assembly
- Loaders synchronously reconstruct rich aggregates or read models from one or more repository-level queries
- `loading/` must not submit tasks, own JavaFX callbacks, mutate UI state, or hide workflow sequencing
- Ordinary one-query finders stay in `repository/`, not `loading/`

### Persistence Layer

- `persistence/` is write-side aggregate persistence support
- Use it for multi-table write orchestration helpers, write repositories, schema helpers, and persistence mappers
- `persistence/` must not become a second generic repository layer
- Do not add pass-through wrapper classes in `persistence/` that only rename a repository without adding aggregate persistence behavior

### State Layer

- `state/` contains shared transient UI, editor, or workflow state
- State containers are the canonical owner of transient interaction truth shared across multiple UI classes
- `state/` must not perform persistence directly and must not duplicate canonical domain truth

### UI Layer

- `ui/` contains feature-local presentation and interaction code
- Views, panes, dropdowns, popups, canvases, and UI controllers live here
- `ui/` may call application services and state containers but must not own storage access, transaction boundaries, or cross-feature composition

### Shell Layer

- `shell/` is reserved for adapters that bind a feature to the global app shell, shared inspector, shell-owned workspaces, or shell lifecycle
- `shell/` is not a general-purpose second UI package

## Canonical Type Names

Use the following names with their exact meanings. New code must pick one of these names when the role fits. If none fits, the design is still underspecified.

### `*Module`

- A composition root
- Wires collaborators and exposes a feature surface
- Lives in `api/` if public, `bootstrap/` if internal

### `*Api`

- A public boundary facade
- Exposes a stable role-specific capability for other features
- Lives in `api/`
- Must not expose implementation-only collaborators or JavaFX-only concerns

### `*Port`

- A narrow dependency contract between caller and collaborator
- Use for role-specific capabilities, not broad subsystem access
- Lives in `api/` if public, otherwise next to the owning application package

### `*ApplicationService`

- A use-case or workflow orchestrator
- Lives in `application/`
- May own collaborators, callbacks, task submission, transactions, reload behavior, and failure mapping
- If a class coordinates a user-visible workflow, it is an `*ApplicationService`

### `*Session`

- A long-lived mutable runtime object with explicit lifecycle
- Use only when the object is opened, advanced, reset, shut down, or otherwise managed over time
- A session may expose command-like methods and hold evolving runtime truth
- If it owns IO, timers, or background work, it belongs in `application/`
- If it is purely in-memory canonical domain/runtime state, it belongs in `model/`
- Passive data holders are not sessions; they are `*State`, `*Draft`, or domain objects

### `*Repository`

- A direct storage adapter
- Lives in `repository/`, or in `persistence/` as `*WriteRepository` for aggregate write support
- Talks to storage directly and returns rows, entities, or narrow read models

### `*Loader`

- A synchronous read assembler
- Lives in `loading/`
- Reads from storage or another external source and builds an aggregate or read model
- Must not create threads, submit JavaFX tasks, or mutate UI/state containers
- Async orchestration around a loader belongs in `application/`

### `*Generator`

- A pure or near-pure constructor/search algorithm that produces new candidates, layouts, or outputs from inputs
- Lives in `service/` or a model subpackage when tightly coupled to domain invariants
- Must not talk to storage, JavaFX, or task schedulers

### `*Calculator`, `*Scoring`, `*Classifier`, `*Normalizer`, `*Rules`

- Pure domain logic with a narrow responsibility
- Lives in `service/`
- Use the most specific suffix available instead of a vague `*Service`

### `*Catalog`

- A read-only index, lookup, or descriptor source over already-available data
- Use only when the object does not mutate state and does not talk to storage directly
- A catalog may organize, label, filter, or describe loaded domain data
- If it must query storage, it is a `*Loader`, `*Repository`, or `*ApplicationService` instead

### `*Mapper`

- A translation component between representations
- Owns structure transformation only, not workflow or persistence policy
- Use `*PersistenceMapper` inside `persistence/` for write-side encoding helpers

### `*Controller`

- A UI interaction coordinator for one concrete view, pane, dropdown, canvas, or toolbar
- Lives in `ui/` or `shell/`
- Translates user interaction into calls to state containers and application services
- If a class mostly owns workflow sequencing, task orchestration, or storage side effects, it is not a controller

### `*View`, `*Pane`, `*Dropdown`, `*Popup`, `*Canvas`, `*Controls`

- UI surface names
- `*View` is a top-level shell-facing surface
- `*Pane` is a reusable JavaFX region
- `*Dropdown` and `*Popup` are anchored non-modal interaction surfaces
- `*Canvas` is a drawing surface
- `*Controls` is a grouped control surface

### `*State`, `*Draft`, `*Preview`

- Shared transient state names
- `*State` is stable mutable interaction/runtime state
- `*Draft` is in-progress user-authored state before commit
- `*Preview` is ephemeral render or interaction preview data

### `*Summary`, `*Request`, `*Result`, `*Handle`

- Boundary and transport names
- Use in `api/` or other explicit boundary packages
- Do not place these transport types in `model/` unless they are true domain records

### `*Provider`

- Reserved for simple pull-based value suppliers only
- If the dependency is a capability contract rather than a supplier role, use `*Port`
- If the dependency creates objects, use `*Factory`

### Forbidden Or Restricted Names

- Bare `*Service` is forbidden for new code; choose a precise suffix instead
- Bare `*Manager`, `*Helper`, `*Util`, and `*Processor` are forbidden when a canonical name above fits
- Bare `*Persistence` as a class name is forbidden for new code; use `*WriteRepository`, `*SchemaSupport`, or `*PersistenceMapper`

## Target Architecture

Salt Marcher is a feature-first modular monolith. The target architecture is not that every feature must look identical internally. The target architecture is: one public boundary, explicit ownership, minimal overlap between layers, and a naming scheme that reveals responsibility without guesswork.

### Global Structure

- Organize code by feature under `src/features/<feature>/`
- A feature may expose exactly one public boundary rooted at `api/`
- Feature-local assembly belongs in `bootstrap/`; cross-feature assembly belongs in `SaltMarcherApp`
- Shared technical infrastructure belongs in `src/database/`, `src/ui/`, and narrowly scoped `src/shared/`
- `src/shared/` is for reusable technical or rule logic, not as a fallback home for feature behavior that lacks an owner
- If a feature contains a large bounded subsystem, create a specialized subfeature namespace and reapply the same package roles inside it

### Boundary Rules

- Other features may depend only on `api/`
- `api/` must not re-export implementation UI, repositories, or internal helper types
- Cross-feature UI reuse is opt-in and must live under `api/ui/`
- Internal packages are not public architecture even if Java visibility would allow access

### Dependency Direction

- The default dependency direction is `ui -> application -> loading/repository/persistence -> model`
- `service/` may be used by `model/`, `application/`, and `ui/` when it is pure domain logic
- `model/` must not depend on `ui/`, `shell/`, `repository/`, `loading/`, or `persistence/`
- `repository/`, `loading/`, and `persistence/` must not depend on JavaFX UI code
- `ui/` and `shell/` must not depend on another feature's internal packages

### Ownership Rules

- Every business concept must have one canonical owner
- Put state and behavior on the lowest-level owner that is actually edited, constrained, or queried as the source of truth
- Do not mirror domain truth in UI state, helper services, caches, or repositories
- Derived data should normally be computed from canonical state instead of stored as a second truth
- Shared transient interaction state belongs in explicit `state/` containers

### Layer Rules

- `application/` owns workflows, async orchestration, transaction boundaries, reload-after-write behavior, and cross-feature coordination
- `service/` owns pure or near-pure domain logic only
- `repository/` owns direct storage access only
- `loading/` owns synchronous read-side aggregate assembly only
- `persistence/` owns write-side aggregate persistence support only
- `ui/` owns rendering and local interaction only
- `shell/` owns shell integration only
- `state/` owns transient shared UI/editor/workflow state only

## Placement Rules

Use these rules when deciding where new code belongs.

- If it is canonical business or editor truth, it belongs in `model/`
- If it is transient shared UI or editor truth, it belongs in `state/`
- If it orchestrates a use case, task flow, reload flow, or transaction, it belongs in `application/`
- If it is pure domain logic with no workflow ownership, it belongs in `service/`
- If it directly queries or writes storage, it belongs in `repository/`
- If it synchronously reconstructs a rich aggregate from one or more storage reads, it belongs in `loading/`
- If it supports aggregate writes across multiple storage concerns, it belongs in `persistence/`
- If it is part of the cross-feature contract, it belongs in `api/`
- If it wires collaborators together, it is a `*Module` in `api/` or `bootstrap/`
- If it is a top-level shell-facing UI surface, it is a `*View`
- If it is a reusable JavaFX region, it is a `*Pane`

## Naming Discipline

- New code must not introduce bare `*Service`
- New code must not use `*Catalog` for storage-backed readers
- New code must not use `*Loader` for async orchestration or UI task helpers
- New code must not use `*Controller` for workflow orchestrators
- New code must not use `*Session` for passive data holders
- New code must not add pass-through `*Persistence` wrappers that only rename repositories
- Do not introduce new package names for architectural roles unless the canonical package names are clearly insufficient
- Prefer the most specific role name available over generic nouns

## Architecture Convergence Rules

Agents must treat the target architecture above as the default for all new code and as the direction of travel for all touched code.

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
