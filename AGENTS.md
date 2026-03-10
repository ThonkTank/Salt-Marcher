# Repository Guidelines

## Project Structure & Module Organization
- `src/features/` is the primary feature-first architecture.
- Core feature modules currently include:
  - `src/features/encounter/` with `analysis`, `application`, `calibration`, `combat`, `generation`, `model`, `rules`, `service`, `ui`
  - `src/features/encountertable/` with editor, repository/service, and `recovery`
  - `src/features/world/hexmap/` with `model`, `repository`, `service`, `ui`
  - `src/features/creaturecatalog/`, `src/features/creaturepicker/`, `src/features/party/`, `src/features/items/`, `src/features/calendar/`, `src/features/campaignstate/`, `src/features/gamerules/`
- `src/ui/` contains the JavaFX shell/bootstrap and shared UI infrastructure:
  - `src/ui/bootstrap/` application entrypoint (`ui.bootstrap.SaltMarcherApp`)
  - `src/ui/shell/` app shell, view registry, navigation (`ENCOUNTER`, `OVERWORLD`, `MAP_EDITOR`, `TABLE_EDITOR`)
  - `src/ui/async/` async helpers (`UiAsyncTasks`, `UiErrorReporter`)
  - `src/ui/components/` shared UI components used across features
- `src/shared/crawler/` contains crawler plumbing shared by importer pipelines.
- `src/importer/` contains monster import/crawl and maintenance tools.
- `src/database/` contains DB bootstrap and schema setup.
- `resources/` contains app styling; `resources/salt-marcher.css` is the main theme source.
- Runtime/project data lives under `data/`; SQLite lives in `game.db`; Gradle output lives in `build/`.

## Build, Test, and Development Commands
- Build and verification:
```bash
./gradlew build
```
- Run the app:
```bash
./gradlew run
```
- Main crawler/import tasks:
```bash
./gradlew crawler
./gradlew crawlerItemsPipeline
./gradlew crawlerItemsSlugs
```
- Additional maintenance tasks currently available:
```bash
./gradlew recoverEncounterTables
./gradlew recomputeRoles
./gradlew backfillCreatureAnalysis
./gradlew applyCreatureOverrides
./gradlew crawlerMonsters
./gradlew importMonsters
./gradlew crawlerItems
./gradlew importItems
```
- Script entrypoints still exist for end-to-end local data population:
```bash
./scripts/crawl.sh
./scripts/crawl-items.sh
```

## Coding Style & Naming Conventions
- Language/runtime: Java 21, Gradle Kotlin DSL, JavaFX, SQLite via JDBC.
- Indentation: 4 spaces; keep methods focused and lines readable.
- Naming: `PascalCase` for classes/files, `camelCase` for methods/locals, lowercase packages.
- UI naming stays consistent: `*View`, `*Pane`, `*Dialog`, `*Controls`, `*Canvas`.
- Repositories stay stateless/static and receive `Connection` from callers.
- Repository SQL contract: prefer propagating `SQLException`; fallback policy belongs in service/application layers.
- Static utility/facade classes should be `final` with a private constructor (`AssertionError("No instances")` pattern preferred).
- Instance-based services are for stateful workflows/sessions such as `*ApplicationService`.
- Service/generation APIs should return typed statuses/failure reasons; UI owns user-facing wording.
- Do not use `System.out`/`System.err` in feature service/repository code.
- Use `try-with-resources` for JDBC.
- Keep ID types consistent across a feature surface; creature/row IDs should generally stay `Long`.
- Backend code/comments/messages stay English; UI text and UI inline comments stay German.
- Established DnD terminology is never localized, even in otherwise German UI text/comments. Keep canonical rules terms in English (`Encounter`, `Stat Block`, `CR`, `XP`, `Easy`, `Medium`, `Hard`, `Deadly`, etc.).
- Shared UI belongs in `src/ui/components` only when reused by 2+ features.
- Avoid cross-feature dependencies unless they are intentionally shared.

## UI & Async Conventions
- Use `UiAsyncTasks.submit(...)` as the public entrypoint for JavaFX background work.
- Report background-task failures via `UiErrorReporter.reportBackgroundFailure(...)`.
- Keep shell/view integration aligned with `AppShell` and `AppView`; new top-level views must be registered in `SaltMarcherApp` and `ViewId`.
- `resources/salt-marcher.css` is the source of truth for theme tokens; keep Java-side theme constants in sync when touching canvas colors.

## Testing Guidelines
- The minimum quality gate for any change is:
```bash
./gradlew build
```
- Build verification already includes convention checks for:
  - compiled artifacts accidentally committed under `src/`
  - `System.out`/`System.err` usage in feature service/repository code
  - repositories swallowing `SQLException`
  - UI code bypassing `UiAsyncTasks`
- Do not create or modify automated tests unless explicitly requested.
- If you touch importer/parser flows, validate with the relevant crawler task or script.
- If you change schema/storage assumptions, recreate `game.db` and repopulate from crawler data; crawled data can be rebuilt, user-created data must be preserved carefully.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style: `feat: ...`, `refactor: ...`, `chore: ...` (optional scope).
- Keep commits focused on a single concern.
- PRs should include concise summary, impacted modules, manual test steps, and screenshots/GIFs for UI changes.
- Call out schema, crawler, or backup-format impacts explicitly.

## Security & Local Configuration
- Do not commit secrets. Keep crawler session cookies only in local `crawler.properties`.
- Start from `crawler.properties.example`.
- Store database backups under `data/backups/db/`, not in the repository root.

## Data Management
- This local installation is the only working copy of the program, so compatibility work for external deployments is not required.
- We work with a mix of crawled and custom data:
  - crawled data can be re-imported after schema changes
  - user-created data must be protected with backups/migrations
