# AGENTS.md

This file is local engineering law for this repository. Preserve documented ownership, workflows, and invariants unless the user explicitly asks to change them.

## Purpose

Salt Marcher is a Java 21 / JavaFX / SQLite application built with the Gradle wrapper. The active product rebuild lives in `src/clean`, and the default `build` / `run` / `installDesktopApp` lifecycle exercises that tree.

## Current Product Boundary

- Put new product work in `src/clean`, because that is the only active application tree.
- Treat the rest of `src/` as legacy support or migration reference unless the user explicitly asks to work there, because those trees are abandoned as product architecture precedent.
- Use legacy code to match behavior or migrate ideas, not to justify new package shapes, because abandoned structure is not valid precedent.
- Keep non-product support in its existing homes: `src/database/`, `src/importer/`, `src/shared/`, `src/ui/`, `resources/`, and `data/`.

## Build And Run

```bash
./gradlew build
./gradlew checkNoDeadCode
./gradlew run
./gradlew installDesktopApp
./gradlew inspectDatabase
./gradlew backupDatabase
./gradlew resetDungeonDatabase
./gradlew crawler
./gradlew crawlerItemsPipeline
./gradlew crawlerItemsSlugs
./gradlew importMonsters
./gradlew importItems
```

- Run `./gradlew build` after code changes, because it compiles the app and runs the owner / clean dead-code checks.
- Run `./gradlew installDesktopApp` after code changes unless the user explicitly waives it, because the desktop app is the normal manual test surface.
- `./gradlew checkNoDeadCode` is the strict `src/clean` hygiene gate. Any unreachable declaration, dead local flow, or unmodeled dynamic reachability under `src/clean` must fail there.
- There is no test framework and no linter. Verification claims must therefore be literal and command-based.
- The app database lives at `${XDG_DATA_HOME:-~/.local/share}/salt-marcher/game.db`. Schema changes require rebuilding from crawled data, because there are no `ALTER TABLE` migrations.
- First data load comes from `./scripts/crawl.sh` or `./scripts/crawl-items.sh` after creating `crawler.properties` from `crawler.properties.example`.

## Sensitive Surfaces

- Do not edit `build.gradle.kts`, `settings.gradle.kts`, `CODEOWNERS`, `~/Schreibtisch/SM/buildSrc`, or `~/Schreibtisch/SM/build-checks` unless the user explicitly asks, because they are guarded build infrastructure.
- Do not add a `buildSrc` directory to this repository, because Gradle is wired to the external `../buildSrc` include.
- Never commit secrets. Keep crawler cookies only in local `crawler.properties`, and keep database backups in `data/backups/db/`.

## Architecture Rules

- Choose the owning feature first, then the single owner slice, then the technical layer, because ownership is the primary architecture boundary.
- Give each capability one central owner, because mirrored ownership creates hidden coupling.
- Every owner exposes exactly one public root seam named `<Owner>Object` in its root package, because cross-owner work must stay structurally obvious.
- Keep each owner directory to exactly one Java file, because the owner-boundary build checks treat sibling Java files as ownership drift.
- Cross-owner access goes through the target owner root package and its canonical `input` types, because foreign `task`, `repository`, and `state` APIs are internal implementation details.
- Use only the canonical owner-internal layers `input`, `task`, `repository`, and `state`, because the build checks and documentation assume that vocabulary.
- Treat any other non-container directory under `src/` as an owner unless it ends with `Bucket`, because only `*Bucket` is a transparent organizational directory.
- Keep `*Bucket` directories shallow and organizational only, because ownership must remain directly readable from the tree.

## Canonical Owner Role Model

- `owner` is the single public seam of a capability. It exposes exactly one `<Owner>Object` in the owner root package, accepts canonical same-owner `input` requests, validates and routes the request, and keeps cross-owner orchestration structurally obvious.
- `owner` is the final consumer of owner-local static data. It may read same-owner `state`, send static request-shaped data through same-owner `task`, call same-owner `repository` when runtime snapshots must be loaded or persisted, and assemble final `Node` or `ComposeShellInput.SurfaceInput` results behind private owner assembly paths.
- Public owner request methods stay thin and auditable. Non-trivial assembly, branching, and terminal consumption may exist behind private owner-local paths, but the public seam remains the visible routing boundary.
- Cross-owner work goes only through the target owner's public `<Owner>Object` request methods plus that owner's canonical `input` types. Foreign `task`, `state`, and `repository` layers remain owner-internal implementation detail.

- `input` carries passive request or result data for one real owner request. Name each input file `<Request>Input`, keep it aligned to a real public request method on the same owner, and keep it as a pure value carrier.
- `task` is a stateless `Input -> Input` transformation seam. It prepares static data for owner consumption, keeps request-shaped translation explicit, and does not become a second orchestration or runtime-state home.
- `state` is the owner-local runtime and display truth. It holds transient selection, mode, visibility, active-resource identity, and other mutable runtime facts, and it exposes owner-local queries or transitions over that truth.
- `repository` is the owner-local state snapshot persistence seam. It hydrates runtime truth from persisted owner snapshots and persists updated owner snapshots when the owner decides runtime state must cross process boundaries.
- No additional canonical owner-internal layers exist beyond `input`, `task`, `state`, and `repository`, because the build checks and documentation assume this vocabulary.

## Documentation Contract

- Root `AGENTS.md` files document project-wide truth only. Child `AGENTS.md` files document local deltas only, because duplicated guidance drifts.
- Read the full root-to-leaf `AGENTS.md` chain before editing a path, because parent files define the default contract for the subtree.
- Update the governing `AGENTS.md` files whenever implementation changes durable truths, package ownership, invariants, or UI behavior, because documentation is part of done.
- Document current truth, not refactor history, because stale migration prose obscures the actual editing rules.
- Write rules as “do X because Y” wherever possible, because positive placement rules are easier to follow than long anti-pattern lists.
- Keep explicit hazard bullets only for real drift risks that would otherwise look valid.

## Code And UI Conventions

- Use 4-space indentation, `PascalCase` classes, `camelCase` methods/locals, and lowercase packages.
- Keep UI text German while established DnD terms such as `Encounter`, `CR`, and `Deadly` stay English.
- Use `try-with-resources` for every JDBC connection, statement, and result set, because connection ownership must remain explicit.
- Use domain or argument exceptions for validation failures, not `SQLException`, because persistence errors and user-input errors are different failure classes.
- Use `javafx.concurrent.Task` plus named daemon threads `sm-<operation>` for background work, and always wire `setOnFailed`, because silent async failure is incomplete behavior.
- Keep comments for invariants, UX rules, and non-obvious intent only, because narration of obvious control flow becomes stale quickly.

## CSS And Styling

- `resources/salt-marcher.css` and `resources/clean/clean.css` are the only stylesheet files allowed in this repository, because styling must stay centralized and reviewable.
- Do not use `setStyle(...)` in project Java code. Reuse stylesheet classes instead, because inline styling hides design decisions from the stylesheet source of truth.
- New selectors or new style-rule blocks in either stylesheet require explicit user approval, because CSS surface area is treated as product design scope.
- Keep `src/ui/theme/ThemeObject` manually aligned with the canvas palette in CSS, because canvas rendering cannot read CSS variables directly.

## Verification And Git Workflow

- State exactly what you verified and what you did not verify, because this repository has few automated safety rails beyond Gradle.
- Before starting a requested implementation, inspect the worktree, commit any pre-existing local modifications, push them to `main`, and only then begin the new task, because unrelated local state must be isolated before new work starts.
- Use focused Conventional Commit messages, because schema, crawler, and UI shell changes need clear history.
