# AGENTS.md

This file defines the repository-specific operating constraints for Claude Code (claude.ai/code) and OpenAI Codex agents. Treat it as local engineering law: preserve the documented architecture, prefer repository-specific precedent over generic agent habits, and do not weaken an invariant unless the user explicitly asks for that change.

## Project Structure & Module Organization

**Language:** Java (no modules), JavaFX UI, SQLite via raw JDBC. Build via Gradle wrapper (`./gradlew`) with Java 21 toolchain and OpenJFX plugin.

**Target structure:** Salt Marcher is a feature-oriented monolith with one binding target architecture:
- `src/features/<feature>/...` is the top-level product boundary
- inside a feature, organize new work by **owner slice first**
- only inside an owner slice may you use local technical layers such as `model`, `application`, `repository`, `state`, `ui`, `api`, or `bootstrap`
- non-feature code stays in shared homes such as `src/database/`, `src/importer/`, `src/shared/`, `src/ui/`, and `resources/`

**Owner slices:** a slice is the single central owner of one capability family. Allowed slice kinds are:
- aggregate owners such as `room`, `corridor`, `stair`, `transition`
- shared kernels such as `layout` or geometry only when they are the one canonical truth shared by several owners
- workflow or surface owners such as `runtime`, `catalog`, `editor interaction`, or `render/input` only when the workflow or surface is itself the stable central owner

**Legacy package names:** directories such as `service`, `builder`, `loading`, `shell`, `canvas`, `internal`, `maintenance`, or `support` may appear in the tree. They do **not** define architecture precedent by themselves. Treat them as exceptions that require an explicit local owner rule before using them as precedent.

**Stable infrastructure homes:**
- `src/database/DatabaseManager` — connection factory. `getConnection()` returns a fresh Connection with `PRAGMA foreign_keys=ON` and `journal_mode=WAL`; callers own it via try-with-resources. `setupDatabase()` uses idempotent `CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE` seeding
- `src/importer/` and `src/shared/crawler/` — crawler/import pipeline
- `src/ui/` — JavaFX shell/bootstrap (`src/ui/bootstrap/`) plus shared UI-only components (`src/ui/components/`)
- `resources/salt-marcher.css` — single CSS source of truth. `data/` for runtime data and backups

**AGENTS.md placement convention:** the root `AGENTS.md` is for project-wide rules only. Feature-specific architecture, workflows, invariants, package roles, and editor/runtime behavior belong in the nearest local `AGENTS.md` under that feature subtree. If a rule stops being globally true and starts describing one feature, move it out of the root file. When both files exist, apply both, with the deeper local file governing the feature-specific details. Before changing files in a subtree, check whether that subtree defines a nearer `AGENTS.md`; if it does, treat that local file as required context, not optional reference. Before handoff, re-check the `AGENTS.md` files governing the edited paths and update them whenever the implementation changed the truths they describe.

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

End-to-end scripts: `./scripts/crawl.sh`, `./scripts/crawl-items.sh`.

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

- `src/features/campaignstate/AGENTS.md` — campaign-state ownership and public boundary rules
- `src/features/creatures/AGENTS.md` — creatures platform ownership and reusable creature UI/API rules
- `src/features/encounter/AGENTS.md` — encounter-specific workflow and runtime behavior
- `src/features/encountertable/AGENTS.md` — encounter-table boundary and consumer-ownership rules
- `src/features/items/AGENTS.md` — item ownership and reusable item-catalog UI boundary rules
- `src/features/loottable/AGENTS.md` — loot-table ownership and item-catalog composition rules
- `src/features/party/AGENTS.md` — party feature public-boundary rules
- `src/features/partyanalysis/AGENTS.md` — party-analysis public-boundary rules
- `src/features/world/AGENTS.md` — world feature boundary and subfeature ownership rules
- `src/features/world/hexmap/AGENTS.md` — hex map and overworld-specific rules
- `src/features/world/dungeon/AGENTS.md` — dungeon owner atlas and canonical dungeon seams
- `src/features/world/dungeon/dungoenmap/AGENTS.md` — dungeon-map owner rules for loaded dungeon snapshots, load/reload workflows, and map session state
- `src/features/world/dungeon/dungoenmap/cluster/AGENTS.md` — cluster owner rules for top-level room-cluster aggregates, workflows, and persistence
- `src/features/world/dungeon/dungoenmap/corridor/AGENTS.md` — corridor owner rules for standalone corridor aggregates, workflows, and persistence
- `src/features/world/dungeon/geometry/AGENTS.md` — canonical dungeon grid algebra and shared geometry rules
- `src/features/world/dungeon/dungoenmap/structure/AGENTS.md` — shared structure-topology owner rules and persistence seams

Non-feature local rules may also live under shared or tooling directories such as `src/shared/AGENTS.md` and `sync/AGENTS.md` when those directories need durable agent guidance.

## Architecture Guidelines

Salt Marcher is a feature-oriented monolith. The binding target architecture is:

1. choose the owning feature
2. choose the single owner slice inside that feature
3. only then choose the local technical layer inside that slice if one is needed

Do not reverse that decision order. A capability does not belong in a package because the package name sounds familiar; it belongs with the owner that keeps the capability coherent.

### Core Rules

- Give every capability one central owner.
- Place each capability on the lowest common owner that is actually edited, described, or constrained by it.
- Objects and types may gain capabilities through composition, inheritance, or references, but ownership of the capability stays with the central owner instead of being mirrored in consumers.
- Central owner types should hold their own mutable state and behavior. Keep invariants and mutation behind explicit owner APIs instead of exposing writable internals.
- Do not force every type into owner-style encapsulation. Immutable geometry types, DTOs, requests, projections, snapshots, render payloads, and similar value carriers may stay transparent values when they do not own invariants or workflow state.
- New code must follow the target architecture immediately.
- Touched code should move toward the target architecture at the nearest safe seam without widening scope.
- Preserve behavior, storage assumptions, user workflows, and explicit invariants unless the task explicitly requires changing them.
- Avoid wrappers, adapters, or intermediate packages whose only purpose is to rename existing complexity.
- Existing code may keep older local shapes until touched. Use the target architecture as the editing precedent for new or changed work.
- Do not do rename-only churn just to satisfy the naming system. Rename when it clarifies ownership, removes a misleading role signal, or accompanies a real boundary change.
- When goals compete, use this order: preserve correctness and satisfy the user request; preserve explicit repository invariants and local `AGENTS.md` rules; keep the change small enough to verify safely; then move the touched code toward the target architecture.

### Local Layer Vocabulary

Technical layers are subordinate tools inside an owner slice, not the primary architecture story:
- `model` — canonical business and editor truth for that owner
- `application` — workflows and use cases for that owner
- `repository` — storage access for that owner
- `state` — shared transient UI or workflow state for that owner
- `ui` — presentation and interaction owned by that owner
- `api` — deliberate exported boundary for that owner or feature
- `bootstrap` — internal composition and wiring

Use these layer names only when they clearly describe a local responsibility inside the already-chosen owner slice.

### Owner Types vs Value Types

- Treat aggregates, workflow owners, and shared mutable state holders as owner types. They should expose narrow, intentional APIs and keep internal mutation private.
- Treat immutable records and small transport shapes as value types. They may expose their data directly when they do not enforce invariants beyond construction.
- When deciding between the two, ask whether callers should be able to freely combine and inspect the data, or whether all meaningful changes must pass through one owner that protects invariants.

### AGENTS Contract

`AGENTS.md` files are architecture libraries, not changelogs and not implementation walkthroughs. A durable AGENTS file should usually provide these sections:
- `Purpose`
- `Owner Atlas`
- `Canonical Types and APIs`
- `Where New Code Goes`
- `Forbidden Drift`

`Canonical Types and APIs` should document only the central seams an implementer should reuse. Use short entries of the form `Type or entrypoint - input summary - output or side effect`.

Do not use AGENTS files to:
- restate obvious implementation details that the edited file already shows clearly
- dump per-method control flow or table-by-table storage layout
- preserve stale migration notes after the migration is over
- present the current folder layout as the target architecture when the target has already changed
- narrate a recent refactor just because it was recent
- describe temporary ownership such as `still`, `for now`, `until X exists`, `future owner`, `new flow after refactor`, or `used to`
- repeat parent-directory guidance in child files when the rule applies to siblings

### Agent Compliance Checklist

Before adding new code:
1. Read the root `AGENTS.md` and the nearest governing local `AGENTS.md` files.
2. Identify the owner slice before choosing a package.
3. Inspect the documented canonical owner and entry points before introducing a new class, service, helper, or package.
4. Extend the listed owner first. Create a new owner, public seam, or package family only when the current owners truly cannot absorb the change.

When adding a genuinely new owner or public seam:
1. Update the governing `AGENTS.md` files in the same change.
2. Document the new owner, its purpose, and the small set of canonical entry points other agents should reuse.
3. Document only the durable truth needed to edit the code safely. If a legacy placement is a live hazard, name the hazard directly instead of narrating the migration.

## Key Conventions

The rules in this section are decision filters, not soft preferences. When multiple approaches are possible, choose the one that preserves ownership, minimizes hidden coupling, and matches the existing repository pattern. If a proposed change requires an exception, name the exception explicitly instead of silently drifting the pattern.

### Code Style
- 4-space indentation, `PascalCase` for classes, `camelCase` for methods and locals, lowercase packages
- `try-with-resources` for all JDBC connections, statements, result sets
- UI text stays German; established DnD terms (`Encounter`, `CR`, `Deadly`) remain English. Code identifiers, comments, and commit messages are English
- Avoid `System.out` and `System.err` in feature application/repository code. Error logging elsewhere: `System.err.println` with format `ClassName.methodName(): message` (no logging framework)
- Comments must earn their keep. Use them to preserve invariants, UX rules, non-obvious constraints, or the intended behavior of new or changed non-trivial logic; do not narrate obvious control flow or restate the code in English

### Documentation Updates
- `AGENTS.md` files document concrete truths that exist now and durable editing rules. They are guidance, not changelogs
- Remove or rewrite references to removed systems, rename history, and stale transition notes when they no longer affect current editing decisions
- Keep transition notes only when they describe a live compatibility constraint or a current implementation hazard
- If a rule applies to multiple sibling directories, document it once in the nearest shared parent instead of repeating it in each child file
- Default local-file shape is `Purpose`, `Canonical Types and APIs`, `Where New Code Goes`, and `Forbidden Drift`. Add `Owner Atlas` only when the directory itself is the first real owner node for its subtree
- During implementation, new or changed non-trivial code must document its intended behavior briefly at the owner seam that enforces it, so later contributors can understand the intent without reconstructing it from surrounding call sites
- Prefer one concise intent comment on the stable owner over repeated narration on every branch or statement
- Before handoff, inspect the root `AGENTS.md` and any nearer local `AGENTS.md` files governing the edited paths
- Update those `AGENTS.md` files whenever the implementation changes documented truths, invariants, workflows, package roles, or UI behavior, and clean out stale statements that no longer describe current code or guidance
- Treat documentation updates as part of done, not optional cleanup

### Repository & Application Conventions
- Repositories are stateless (`Connection` passed in). Let repositories propagate `SQLException`; fallback behavior, retries, and user-facing degradation belong in application workflows
- Application workflows may propagate `SQLException` from repositories and transaction boundaries, but business validation must use domain/argument exceptions (`IllegalArgumentException` or a feature-specific edit exception), not `SQLException`
- Precise helper types such as `*Factory`, `*Generator`, `*Calculator`, `*Classifier`, `*Normalizer`, `*Assembler`, `*Coordinator`, `*Planner`, `*Matcher`, and comparable pure helpers are static-only with private constructor unless they need explicit state
- Stateful workflow entrypoints (`*ApplicationService`, `*Session`) are instance-based
- Some existing feature areas use `service/` packages. Keep their public workflow entrypoints at the package root, place new code in `application/`, and move close collaborators into focused owner slices when touching that area
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
- `*View` = AppView impls, `*Pane` = Region subclasses, `*Dropdown` = anchored non-modal editor windows backed by `Popup`, `*Popup` = existing popup-oriented controllers, `*Controls` = left-column control panels, `*Canvas` = canvas subclasses for specific contexts

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
