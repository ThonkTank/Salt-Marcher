# AGENTS.md

This file defines the repository-specific operating constraints for Claude Code (claude.ai/code) and OpenAI Codex agents. Treat it as local engineering law: preserve the documented architecture, prefer repository-specific precedent over generic agent habits, and do not weaken an invariant unless the user explicitly asks for that change.

## Project Structure & Module Organization

**Language:** Java (no modules), JavaFX UI, SQLite via raw JDBC. Build via Gradle wrapper (`./gradlew`) with Java 21 toolchain and OpenJFX plugin.

**Target structure:** Salt Marcher is a feature-oriented monolith with one binding target architecture:
- `src/features/<feature>/...` is the top-level product boundary
- inside a feature, organize new work by **owner slice first**
- every non-container directory under `src/` is either an owner, one of the four canonical owner-internal layers `input`, `task`, `repository`, `state`, or an organizational `*Bucket` directory directly under an owner
- every owner exposes exactly one public root entrypoint named `<Owner>Object` directly in its root package
- non-feature code stays in shared homes such as `src/database/`, `src/importer/`, `src/shared/`, `src/ui/`, and `resources/`

**Owner slices:** a slice is the single central owner of one capability family. Allowed slice kinds are:
- aggregate owners such as `room`, `corridor`, `stair`, `transition`
- foundational owner slices such as `layout` or geometry only when they are the canonical home of that capability family across several owners
- workflow or surface owners such as `runtime`, `catalog`, `editor interaction`, or `render/input` only when the workflow or surface is itself the stable central owner

**Legacy package names:** directories such as `service`, `builder`, `loading`, `shell`, `canvas`, `internal`, `maintenance`, or `support` may appear in the tree. They do **not** define architecture precedent by themselves. Treat them as exceptions that require an explicit local owner rule before using them as precedent.

**Stable infrastructure homes:**
- `src/database/DatabaseManager` — connection factory. `getConnection()` returns a fresh Connection with `PRAGMA foreign_keys=ON` and `journal_mode=WAL`; callers own it via try-with-resources. `setupDatabase()` uses idempotent `CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE` seeding
- `src/importer/` and `src/shared/crawler/` — crawler/import pipeline
- `src/ui/` — JavaFX shell/bootstrap (`src/ui/bootstrap/`) plus shared UI-only components (`src/ui/components/`)
- `src/clean/` — isolated clean application rebuild root. Code here must not import legacy project packages from `src/database`, `src/features`, `src/importer`, `src/shared`, or `src/ui`.
- `resources/salt-marcher.css` — single CSS source of truth. `data/` for runtime data and backups

**AGENTS.md placement convention:** the root `AGENTS.md` is for project-wide rules only. Feature-specific architecture, workflows, invariants, package roles, and editor/runtime behavior belong in the nearest local `AGENTS.md` under that feature subtree. If a rule stops being globally true and starts describing one feature, move it out of the root file.

**AGENTS.md load order and precedence:** AGENTS files are read from the repository root down to the edited directory. Parent files define the default contract for the whole subtree. Child files may narrow, extend, or document local exceptions, but they must not restate parent guidance unless the local wording adds a real subtree-specific constraint. If the same rule applies to multiple siblings, document it once in the nearest shared parent instead of duplicating it below. Before changing files in a subtree, read the full root-to-leaf AGENTS chain for that path. Before handoff, re-check the governing files for every edited path and update them whenever the implementation changed documented truths.

**DB storage conventions:** Multi-value fields stored as delimited strings — `KEY:value,KEY:value,...` (e.g. `SavingThrows = "CON:10,INT:12"`, `Senses = "darkvision:60"`). Junction tables (`creature_biomes`, `creature_subtypes`, `item_tags`) for many-to-many. `campaign_state` is a singleton row (id=1). No name-column indexes anywhere (leading-wildcard `LIKE` can't use B-tree).

## Build & Run

```bash
./gradlew build                  # compile + convention checks
./gradlew build                  # recompile after every code change — fix all errors before proceeding
./gradlew checkNoDeadCode        # fail when touched Java files add dead declarations or dead local code
./gradlew run                    # start JavaFX app
./gradlew installDesktopApp      # reinstall desktop launcher
./gradlew inspectDatabase        # inspect current or requested SQLite database
./gradlew backupDatabase         # create a SQLite backup copy
./gradlew resetDungeonDatabase   # drop dungeon tables after backup
./gradlew crawler                # monster crawl + import
./gradlew crawlerItemsPipeline   # item crawl + import
./gradlew crawlerItemsSlugs      # slug-list only
./gradlew importMonsters         # import only (no crawl)
./gradlew importItems            # import only (no crawl)
```

End-to-end scripts: `./scripts/crawl.sh`, `./scripts/crawl-items.sh`.

Repo defaults force plain Gradle console output plus failure stacktraces, so standard agent runs do not need extra `--console=plain`, `2>&1`, or stacktrace flags just to surface build failures clearly.

No test framework. No linter. The app database is SQLite at `${XDG_DATA_HOME:-~/.local/share}/salt-marcher/game.db` (auto-created on first run). Schema changes require deleting that DB and re-running `./scripts/crawl.sh` — there are no ALTER TABLE migrations. For ad-hoc DB inspection, prefer the vendored CLI at `./tools/sqlite3` or `./gradlew sqliteQuery --args='data/game.db .tables'`.

`./gradlew build` also runs a post-build cleanup that deletes empty directories left behind under `src/` and `resources/`.

`./gradlew check` includes a touched-Java dead-code gate. If a touched `src/**/*.java` file introduces unreachable types, methods, constructors, fields, dead locals, dead assignments, or obvious constant-condition branches, the build must fail. Intentionally retained declarations must be marked with `@SuppressWarnings("unused")` instead of being left as ambiguous fake/live code.

**Sensitive build-check surfaces:** `build.gradle.kts`, `settings.gradle.kts`, and `CODEOWNERS` are protected guardrail infrastructure. The authoritative build logic lives outside the repo under `~/Schreibtisch/SM/buildSrc` and is loaded through `pluginManagement.includeBuild("../SM/buildSrc")`; the repository must not contain a `buildSrc` path at all. Local Gradle verification is expected to fail if the external include wiring drifts from its external reference. Agents must never autonomously edit, stage, commit, or push these files, the external build-check logic under `~/Schreibtisch/SM/buildSrc`, or the external guard/reference files under `~/Schreibtisch/SM/build-checks`. Only a direct, explicit user instruction to change the build checks or guardrails themselves permits those edits; a failing check, a desired refactor, a migration under `src/clean`, or any other implied convenience is not permission.

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

Non-feature local rules may also live under shared or tooling directories such as `src/shared/AGENTS.md` and `sync/AGENTS.md` when those directories need durable agent guidance. Discover governing AGENTS files by walking the directory path, not by relying on a curated index.

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
- The public `<Owner>Object` seam must stay stateless and workflowless. It may expose canonical requests, bind already-final values, make simple routing decisions, and hand final values to terminal consumers, but it must not hide workflow state, business logic, or complex intermediate processing.
- Do not force every type into owner-style encapsulation. Immutable geometry types and strictly local transparent values may stay plain values when they do not own invariants or workflow state.
- New code must follow the target architecture immediately.
- Touched code should move toward the target architecture at the nearest safe seam without widening scope.
- Preserve behavior, storage assumptions, user workflows, and explicit invariants unless the task explicitly requires changing them.
- Avoid wrappers, adapters, or intermediate packages whose only purpose is to rename existing complexity.
- Existing code may keep older local shapes until touched. Use the target architecture as the editing precedent for new or changed work.
- Do not do rename-only churn just to satisfy the naming system. Rename when it clarifies ownership, removes a misleading role signal, or accompanies a real boundary change.
- When goals compete, use this order: preserve correctness and satisfy the user request; preserve explicit repository invariants and local `AGENTS.md` rules; keep the change small enough to verify safely; then move the touched code toward the target architecture.

### Local Layer Vocabulary

Technical layers are subordinate tools inside an owner slice, not the primary architecture story:
- `input` — the owner's canonical request carriers
- `task` — the owner's static input-to-input pipelines
- `repository` — the owner's static persistence boundary for owner `state`
- `state` — the owner's protected runtime/object state plus owner-local factory/transition APIs

### Canonical Owner Boundary Restraints

For touched Java files, these six rules are the single source of truth for the owner build checks:
- `owner` — public owner APIs are only the canonical request methods on `<Owner>Object`. Each request must accept exactly one same-stem `<Request>Input`, may expose only project `input` types, and its body may do only pass-through binding, simple routing, canonical layer delegation, private terminal consumption, returns, and throws. Private owner helpers are allowed only as terminal consumers behind a public request; they must stay `private`, return `void`, consume already-final values, and must not become alternate workflow seams.
- `input` — input files are passive canonical request carriers. They must match a real public owner request, must not declare methods or initializer blocks, may import only project `input` packages, and any request-local nested value types must stay passive as well.
- `task` — task files are stateless static `<Request>Task` pipelines. They must start from exactly one same-owner same-stem `<Request>Input`, end in exactly one canonical `input`, stay linear, and must not orchestrate owner, `state`, or `repository` APIs.
- `state` — state files are owner-local factory/transition boundaries. They may depend only on same-owner `input` and `state`, may read own input only through canonical accessors, may construct only own `state`, and must not touch database infrastructure, SQL APIs, UI, threads, I/O, owner seams, task APIs, or repository APIs.
- `repository` — repository files are stateless static persistence boundaries. They must not declare fields, initializer blocks, or nested types; may depend only on JDBC, `DatabaseManager`, approved transaction helpers, local helpers, and same-owner `state`; may construct only same-owner `state`; and must not orchestrate owner seams, task APIs, or other repository APIs.
- `api callers` — canonical `task` and `repository` APIs may be called only from the same owner's canonical `<Owner>Object` request methods. Canonical `state` APIs may be called only from the same owner's canonical `<Owner>Object` request methods or explicit same-owner `state`/`repository` collaborators that the checker allows.

Two frequent failure modes are not optional style points:
- Public owner request methods are not an implementation home for JavaFX composition. Do not allocate scene graphs, event handlers, surface catalogs, collections of sibling inputs, or other intermediate workflow structures inline in `*Object` request bodies just because the code is UI-facing.
- A neighboring owner is callable only through its real public `<Owner>Object` request seam. Do not keep peer-owner instances in owner fields as a workflow shortcut, and do not chain foreign owner return values through another owner's public request body except as canonical `input` values that the checker already allows.

No other technical layer names are canonical. Directories such as `model`, `application`, `service`, `ui`, `api`, `bootstrap`, `internal`, or `support` do not define valid package precedent for new or touched architecture work.

### Public Owner APIs

- Cross-owner imports must go through the target owner's root package and its single public `<Owner>Object` seam.
- Owner boundaries are derived structurally. Under `src/`, every non-container directory is either an owner, one of the four allowed layers `input`, `task`, `repository`, `state`, or a direct-child `*Bucket` under an owner.
- For touched Java files, `checkOwnerApiBoundaryConvention` is the final arbiter when documentation and the current filesystem layout diverge.
- `*Bucket` is the only organizational directory pattern. A directory that is not one of the four layers and does not end with `Bucket` is an owner by default.
- `*Bucket` directories are transparent organization only: they may contain only `AGENTS.md` plus direct child owners or direct child layer directories, and they may not contain nested `*Bucket` directories.
- Subowners must sit directly under their owner or inside one direct-child `*Bucket` of that owner. Layers are always flat and may not contain nested packages, subowners, or additional `*Bucket` directories.
- Each import may cross only one owner edge: parent, direct child, or sibling with the same parent. Do not skip over intermediate owners to reach a grandchild, niece, or cousin owner directly.
- Foreign code may import another owner's `input` package only to construct valid requests for that owner. Foreign code must never import another owner's `task`, `repository`, or `state` packages directly.
- Owner composition through `new` is narrower than import reachability. Public owner requests may construct only canonical `input` types. Private terminal consumer methods may construct canonical `input` types plus the public roots of direct sub-owners, and may call only canonical request methods on those direct sub-owner entrypoints.

### Owner Types vs Value Types

- Treat aggregates, workflow owners, and surface owners as owner types. They should expose narrow, intentional APIs, stay stateless with respect to hidden workflow state, and keep non-public consumption seams private. A surface owner may itself be a UI class when that class is the public owner seam; the rule constrains the seam behavior and dependencies, not the base class.
- Treat immutable records and small transport shapes as value types when they stay strictly local. If a passive project type must be passed across owner seams or composed by another owner, make it canonical `input` instead of introducing a parallel DTO or payload category.
- When deciding between the two, ask whether callers should be able to freely combine and inspect the data, or whether all meaningful changes must pass through one owner that protects invariants.

### AGENTS Contract

`AGENTS.md` files are architecture libraries, not changelogs and not implementation walkthroughs. A durable AGENTS file should usually provide these sections:
- `Purpose`
- `Owner Atlas`
- `Canonical Types and APIs`
- `Where New Code Goes`
- `Forbidden Drift`

`Canonical Types and APIs` should document only the central seams an implementer should reuse. Use short entries of the form `Type or entrypoint - input summary - output or side effect`.

Child AGENTS files are delta documents. They may assume parent context is already loaded, so they should document only:
- the local public seams that are specific to that directory
- the local invariants or hazards that are not already fully stated in a parent
- any true local exception to the parent contract

Do not use AGENTS files to:
- restate obvious implementation details that the edited file already shows clearly
- dump per-method control flow or table-by-table storage layout
- preserve stale migration notes after the migration is over
- present the current folder layout as the target architecture when the target has already changed
- narrate a recent refactor just because it was recent
- describe temporary ownership such as `still`, `for now`, `until X exists`, `future owner`, `new flow after refactor`, or `used to`
- repeat parent-directory guidance in child files when the rule applies to siblings
- keep a child file whose contents are fully implied by already-loaded parent AGENTS files
- maintain curated AGENTS file indexes when structural discovery from the edited path is sufficient

### Agent Compliance Checklist

Before adding new code:
1. Read the root `AGENTS.md` and the nearest governing local `AGENTS.md` files.
2. Identify the owner slice before choosing a package.
3. Inspect the documented canonical owner and entry points before introducing a new class, service, helper, or package.
4. Extend the listed owner first. Create a new owner, public seam, or package family only when the current owners truly cannot absorb the change.
5. When editing AGENTS files, move shared guidance to the highest directory that governs every affected path and remove lower-level duplication in the same pass.

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
- Treat child AGENTS files as local deltas over already-loaded parents. Move shared guidance upward and delete lower duplicates in the same change.
- Default local-file shape is `Purpose`, `Canonical Types and APIs`, `Where New Code Goes`, and `Forbidden Drift`. Add `Owner Atlas` only when the directory itself is the first real owner node for its subtree
- During implementation, new or changed non-trivial code must document its intended behavior briefly at the owner seam that enforces it, so later contributors can understand the intent without reconstructing it from surrounding call sites
- Prefer one concise intent comment on the stable owner over repeated narration on every branch or statement
- Before handoff, inspect the root `AGENTS.md` and any nearer local `AGENTS.md` files governing the edited paths
- Update those `AGENTS.md` files whenever the implementation changes documented truths, invariants, workflows, package roles, or UI behavior, and clean out stale statements that no longer describe current code or guidance
- If a child AGENTS file no longer contains a unique local seam, invariant, or hazard after consolidation, delete it instead of leaving a placeholder copy of parent rules
- Treat documentation updates as part of done, not optional cleanup

### Repository & Owner Conventions
- Business validation must use domain/argument exceptions (`IllegalArgumentException` or a feature-specific edit exception), not `SQLException`
- Precise helper types such as `*Factory`, `*Generator`, `*Calculator`, `*Classifier`, `*Normalizer`, `*Assembler`, `*Coordinator`, `*Planner`, `*Matcher`, and comparable pure helpers are static-only with private constructor unless they need explicit state
- New owner-local request and handoff schemas belong in the owner's `input` layer, not in legacy `api` or `model` roots. When one request needs small passive helper carriers, keep them nested inside the canonical `<Request>Input` instead of splitting them into artificial top-level pseudo-requests

### Async & Threading
- `javafx.concurrent.Task` + `new Thread()` (daemon, named `sm-<operation>` e.g. `sm-filter-load`, `sm-encounter-gen`, `sm-combat-setup`, `sm-stat-block`, `sm-save-terrain`)
- Always set `setOnFailed` handler; guard cancellation via `if (!task.isCancelled())`. Background work without explicit failure handling is incomplete, not "good enough"
- **Callbacks:** `Consumer`/`Runnable` pattern; pane setters follow `setOn<Event>()` naming

### CSS & Theming
- `resources/salt-marcher.css` is the single source of truth for design tokens (CSS variables on `.root`)
- `src/ui/theme/ThemeObject` mirrors the small Canvas-only color palette from CSS for Java rendering and must stay in sync manually

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
