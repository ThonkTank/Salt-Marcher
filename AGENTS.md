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

Salt Marcher is a feature-oriented monolith.
Code is organized primarily under `src/features/<feature>/`.
The root `AGENTS.md` defines the shared project grammar: the standard building blocks of the project, what those names mean, how the code should be read, and the central ownership rules.

This root file is binding for the entire repository.
Local `AGENTS.md` files refine these rules for a feature.
Local `AGENTS.md` files may define additional local structure, but they must not weaken the global ownership and dependency rules.

Do not introduce new global architectural building blocks.
The root `AGENTS.md` allows only the standard roles defined below.
Additional structure is allowed only inside a feature-local `AGENTS.md`.

## Canonical Package Roles

Organize feature code under `src/features/<feature>/`.
Each feature uses only the roles it actually needs.
Not every feature needs every role.
If a role is used, it must match the meaning defined here exactly.

Read the project in this order:
- UI behavior lives in `ui/`
- use-case and workflow logic lives in `application/`
- domain and editor truth live in `model/`
- persistence access lives in `repository/`
- shared transient runtime state lives in `state/`
- public feature boundaries live in `api/`
- internal wiring lives in `bootstrap/`

The default dependency direction is `ui -> application -> repository -> model`.
`state/` may be observed by `ui/` and coordinated by `application/`, but it must not become a second domain model.
If a feature defines a nearer `AGENTS.md`, that file is required context before any change in that subtree.

### `model/`

- Contains canonical business and editor truth.
- Put state and behavior on the lowest-level owner that is the real source of truth.
- If an operation preserves or transforms an object's own invariant, that behavior belongs on the model.
- Must not depend on JavaFX, JDBC, repositories, shell classes, or transient UI state.

### `application/`

- Contains use-case orchestration.
- Owns workflow sequencing, async orchestration, task submission, transaction boundaries, reload-after-write behavior, and cross-feature coordination.
- Coordinates repositories, state containers, and other features through explicit boundaries.
- Does not own canonical domain truth.

### `repository/`

- Contains direct storage adapters.
- Owns SQL, row mapping, query construction, persistence ordering, and storage-specific lookup methods.
- Repositories are stateless and receive `Connection` from callers.
- Must not own workflow state, background work, UI state, or cross-feature orchestration.

### `state/`

- Contains shared transient UI, editor, or workflow state.
- Owns shared interaction truth such as selection, drafts, previews, modes, and other transient runtime state.
- Must not perform persistence directly.
- Must not duplicate canonical domain truth.

### `ui/`

- Contains feature-local presentation and interaction code.
- Views, panes, dropdowns, popups, canvases, controls, and UI controllers live here.
- May call application services and state containers.
- Must not own direct storage access, transaction boundaries, or cross-feature composition.

### `api/`

- Is the only cross-feature entrypoint.
- Contains only deliberate boundary types and contracts.
- Root-level `api/` contains public boundary types such as `*Api`, `*Port`, `*Summary`, `*Request`, `*Result`, and `*Handle`.
- Must not contain implementation-detail wrappers, storage facades, or accidental UI re-exports.

### `bootstrap/`

- Contains internal composition roots and assembly-only wiring.
- Wires collaborators and exposes feature entrypoints.
- Must not contain domain logic.
- `SaltMarcherApp` owns cross-feature top-level composition.

## Canonical Type Names

Names must make responsibility legible and must imply concrete implementation rules.
Use a canonical name only when the file fully matches that name's purpose and constraints.
If no canonical name fits, use a precise domain name rather than stretching a near-match.
The list below is intended to cover the repository's recurring roles without overlap.

### Workflow, Storage, And Boundaries

- `*Repository`
  - Purpose: direct storage adapter.
  - May depend on: JDBC, SQL, `model/`, boundary read records.
  - Must not depend on: JavaFX, `ui/`, `state/`.
  - Must not own: workflow sequencing, retry/fallback policy, background task control, user-facing failure handling.
  - Lives in: `repository/`.

- `*ApplicationService`
  - Purpose: user-visible use-case orchestration.
  - May depend on: `repository/`, `state/`, `api/`, `model/`, async/task utilities.
  - Must not depend on: concrete JavaFX surface classes as collaborators of record, raw SQL as core implementation detail.
  - Must not own: canonical domain truth, low-level storage mapping, reusable UI composition.
  - Lives in: `application/`.

- `*Session`
  - Purpose: long-lived mutable runtime context with explicit lifecycle.
  - May depend on: `model/`, `application/` collaborators, narrowly scoped runtime utilities, IO/timers/background work when lifecycle requires them.
  - Must not depend on: arbitrary JavaFX surface trees unless the session is explicitly UI-local and feature-local rules allow it.
  - Must not own: passive transport data, generic utility logic, broad cross-feature wiring.
  - Lives in: `application/` when it owns workflow, IO, timers, or background work; `model/` only when it is purely in-memory canonical runtime truth.

- `*Api`
  - Purpose: deliberate cross-feature boundary.
  - May depend on: boundary records, `ApplicationService`, stable feature-facing collaborators.
  - Must not depend on: JavaFX-only concerns, repository internals, feature wiring internals.
  - Must not own: assembly logic, storage logic, feature-local UI behavior.
  - Lives in: `api/`.

- `*Module`
  - Purpose: composition root that wires a feature surface.
  - May depend on: constructors and wiring targets across that feature.
  - Must not depend on: nothing is forbidden at assembly time, but every dependency must be there only for construction and exposure.
  - Must not own: domain rules, workflow behavior, storage behavior, UI interaction behavior.
  - Lives in: `bootstrap/` if internal, `api/` if it exposes the public feature surface.

### Shared Runtime State

- `*State`
  - Purpose: shared transient runtime truth.
  - May depend on: `model/`, `Draft`, `Preview`, observation/listener utilities.
  - Must not depend on: JDBC, repositories, feature-external wiring.
  - Must not own: persistence, transaction boundaries, canonical domain truth, long-running workflow orchestration.
  - Lives in: `state/`.

- `*Draft`
  - Purpose: in-progress user-authored state that is not yet committed.
  - May depend on: `model/`, validation-oriented value types, editor-local transient data.
  - Must not depend on: repositories, JavaFX surface classes, cross-feature APIs unless the draft itself is the explicit boundary payload.
  - Must not own: persisted truth, workflow sequencing, preview-only visualization concerns.
  - Lives in: `state/` or a feature-local editor model package when local rules make the draft part of editor truth.

- `*Preview`
  - Purpose: ephemeral preview of a possible result.
  - May depend on: derived model data, geometry/layout intermediates, editor-local transient data.
  - Must not depend on: repositories, transaction logic, JavaFX surface classes except where the preview type is intentionally UI-local.
  - Must not own: commit authority, persisted truth, shared workflow sequencing.
  - Lives in: `state/` or a feature-local editor model package when local rules make preview data part of editor truth.

### UI Surfaces

- `*View`
  - Purpose: top-level application surface that plugs into the shell/navigation model.
  - May depend on: `ApplicationService`, `State`, feature-local UI components.
  - Must not depend on: JDBC, repositories, low-level storage code.
  - Must not own: storage logic, transaction boundaries, cross-feature assembly.
  - Lives in: `ui/`.

- `*Pane`
  - Purpose: concrete composed UI region.
  - May depend on: `ApplicationService`, `State`, other UI components.
  - Must not depend on: JDBC, repositories, low-level storage code.
  - Must not own: cross-feature orchestration, persistence policy, long-lived background workflows.
  - Lives in: `ui/`.

- `*Controls`
  - Purpose: UI region dedicated to filters, settings, tools, and actions for a specific surface.
  - May depend on: `ApplicationService`, `State`, feature-local UI components.
  - Must not depend on: repositories, low-level storage code.
  - Must not own: inspector-style read surfaces, primary workspace rendering, persistence logic.
  - Lives in: `ui/`.

- `*Canvas`
  - Purpose: rendering and direct interaction surface centered on drawing.
  - May depend on: `State`, `ApplicationService`, render helpers, theme constants, feature-local interaction collaborators.
  - Must not depend on: repositories, low-level storage code.
  - Must not own: workflow orchestration, persistence logic, unrelated shell composition.
  - Lives in: `ui/`.

- `*Dropdown`
  - Purpose: anchored non-modal editor window.
  - May depend on: `ApplicationService`, `State`, feature-local UI components.
  - Must not depend on: repositories, low-level storage code.
  - Must not own: modal dialog workflows, cross-feature orchestration, persistence logic.
  - Lives in: `ui/`.

- `*Controller`
  - Purpose: interaction coordinator for exactly one concrete UI surface such as a `View`, `Pane`, `Canvas`, `Dropdown`, or toolbar.
  - May depend on: that surface's UI types, `ApplicationService`, `State`.
  - Must not depend on: repositories, low-level storage code, unrelated peer surfaces as hidden backchannels.
  - Must not own: feature-wide workflow orchestration, transaction boundaries, shared persistent truth.
  - Lives in: `ui/`.

### Boundary Data

- `*Summary`
  - Purpose: lightweight read-only boundary projection.
  - May depend on: ids, labels, small read-only field sets, other boundary value types.
  - Must not depend on: JavaFX, repositories, mutable runtime services.
  - Must not own: behavior beyond trivial accessors/value semantics, authoritative domain invariants.
  - Lives in: `api/` or another explicit boundary package.

- `*Request`
  - Purpose: named input payload for a use case or API call.
  - May depend on: boundary value types and validation-oriented fields.
  - Must not depend on: JavaFX, repositories, runtime services.
  - Must not own: execution logic, persistence logic, workflow state.
  - Lives in: `api/` or another explicit boundary package.

- `*Result`
  - Purpose: named output payload for a use case or API call.
  - May depend on: boundary value types, status values, summaries, outcome data.
  - Must not depend on: JavaFX, repositories, runtime services.
  - Must not own: execution logic, persistence logic, hidden side effects.
  - Lives in: `api/` or another explicit boundary package.

## Architecture Convergence Rules

Agents must treat the package roles and type names above as the default structure for all new code and as the direction of travel for touched code.

### Required Behavior

- New code must follow the target architecture immediately.
- New code must choose a canonical package role and a canonical type name when one fits.
- Do not add new code in a legacy shape just because nearby code has not yet been migrated.
- When modifying existing code, prefer the lowest-risk change that leaves the touched area closer to the target architecture than before.
- Preserve behavior, storage assumptions, user workflows, and existing invariants unless the task explicitly requires changing them.
- Do not widen scope merely to improve architectural purity.
- No incidental cross-feature rewrites, speculative cleanup passes, or subsystem reshaping unless explicitly requested.
- If full alignment would require unrelated file edits, public API churn, schema or storage changes, or broad retesting, stop at the nearest safe seam and improve the local design only.
- Prefer fewer, more clearly separated building blocks over a larger taxonomy with overlapping responsibilities.
- Do not add wrappers, adapters, or intermediate packages whose only purpose is to rename existing complexity.
- Legacy code may remain until touched; legacy code is not precedent for new code.

### Decision Order

When goals compete, use this order:

1. Preserve correctness and satisfy the user request
2. Preserve explicit repository invariants and local `AGENTS.md` rules
3. Keep the change small enough to verify safely
4. Within that safe scope, move the touched code toward the target architecture

### Non-goals

- Do not rewrite stable code solely for stylistic uniformity.
- Do not force simple record-oriented features into richer abstractions unless the complexity genuinely requires it.
- Do not flatten rich domain areas into generic service or repository CRUD just to make the codebase look more uniform.
- Do not create new global package roles for concerns that are already covered by the standard set above.

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
