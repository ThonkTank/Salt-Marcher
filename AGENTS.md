# Repository Guidelines

## Project Structure & Module Organization
- `src/features/`: primary architecture (feature-first modules).
  - `src/features/encounter/`: encounter domain (model/service/ui).
  - `src/features/encountertable/`: encounter table domain (model/repository/service).
  - `src/features/world/hexmap/`: hex map world feature (model/repository/service/ui for overworld + editor).
  - `src/features/party/`: party management (model/repository/service/ui).
  - `src/features/calendar/`: calendar model/repository/service.
  - `src/features/campaignstate/`: campaign state model/repository.
  - `src/features/creaturecatalog/`: creature catalog/search/filter/statblock (model/repository/service/ui).
  - `src/features/items/`: items model/repository/importer.
- `src/ui/`: JavaFX app shell/bootstrap and shared UI-only components (`AppShell`, view registry, reusable controls).
- `src/importer/`: crawler/import pipeline.
- `src/database/`: DB bootstrap and schema checks.
- `resources/`: app styling (`salt-marcher.css`).
- `lib/`: optional local third-party JAR cache (not required by Gradle dependencies). `out/`: compiled classes. `data/`: crawl artifacts. `game.db`: local SQLite DB.

## Build, Test, and Development Commands
- Compile app:
```bash
./gradlew build
```
- Run app:
```bash
./gradlew run
```
- Populate monsters/items: `./scripts/crawl.sh`, `./scripts/crawl-items.sh` (optional: `./scripts/crawl-items.sh --build-slugs`).
- Gradle crawler alternatives: `./gradlew crawler`, `./gradlew crawlerItemsPipeline`, `./gradlew crawlerItemsSlugs`.

## Coding Style & Naming Conventions
- Language: Java (Gradle wrapper via `./gradlew` is the canonical build interface).
- Indentation: 4 spaces; keep lines readable and method-focused.
- Naming: `PascalCase` for classes/files, `camelCase` for methods/locals, package names lowercase.
- UI classes: use suffixes consistently (`*View`, `*Pane`, `*Dialog`, `*Controls`, `*Canvas`).
- Keep repositories stateless/static with `Connection` passed in.
- Repository SQL contract: prefer propagating `SQLException` from repositories; service/application layers own fallback policy and user-facing error handling.
- Prefer static utility services for pure calculations/classification/tuning and give them a private constructor.
- Mark static-only utility/facade classes as `final` unless inheritance is intentionally required.
- When touching static-only classes, enforce both `final` and a private constructor (`AssertionError("No instances")` pattern is preferred).
- Use instance-based services only for stateful workflows/sessions (for example `*ApplicationService`, `*Session`).
- Service/generation APIs should return typed failure reasons/status codes; UI layers own localized/user-facing message text.
- Do not use `System.out`/`System.err` in feature services; prefer structured logging or silent fallback handling.
- Persistence row DTO models may remain mutable public-field carriers for JDBC mapping; domain/value models should prefer immutable camelCase APIs (`record` or final fields).
- Keep ID types consistent per feature API surface; for creature/row IDs in this codebase, use `Long` end-to-end unless a primitive is required by an external API.
- Keep language usage consistent within a class (no mixed-language comments or user-facing literals in the same class).
- Language policy: backend code (model/repository/service and non-UI infrastructure) uses English for comments/docs/messages; frontend UI code uses German for user-facing text and inline UI comments.
- UI text must be German by default; do not translate established DnD terminology.
- DnD game terminology is not localized in UI text/comments (for example: "Encounter", "Stat Block", "CR", "XP", "Deadly").
- For JavaFX background tasks in UI code, use `UiAsyncExecutor.submit(Task<?>)` instead of creating raw `Thread`s.
- For UI background-task failures, use `UiErrorReporter.reportBackgroundFailure(...)` instead of direct `System.err` logging.
- In encounter generation, route time/random behavior through `GenerationContext` (no direct `System.nanoTime`/`ThreadLocalRandom` usage outside `GenerationContext`).
- Prefer `try-with-resources` for JDBC.
- New domain code belongs under `src/features/<feature>/{model,service,repository,ui}` by default.
- Put shared UI only in `src/ui/components` when it is used by 2+ features.
- Avoid introducing cross-feature dependencies unless the dependency is intentionally shared.

## Testing Guidelines
- No formal test framework is configured yet.
- Do not create, modify, or restore automated tests unless the user explicitly requests it for the current task.
- Minimum quality gate: run `./gradlew build` after each change and run the app flow you touched.
- Build includes convention drift checks for feature service/repository `System.out`/`System.err` usage and repository `SQLException` swallowing.
- Validate parser/importer changes via crawler tasks/scripts (`./scripts/crawl.sh`, `./scripts/crawl-items.sh`, or Gradle crawler tasks).
- If schema changes, recreate `game.db` and repopulate via crawl scripts.
- For structure-only refactors, keep commits behavior-neutral (moves/import updates only) and smoke-test impacted flows.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat: ...`, `refactor: ...`, `chore: ...` (scopes optional, e.g., `feat(combat): ...`).
- Keep commits focused (one concern per commit).
- PRs should include: concise summary, impacted modules, manual test steps, and screenshots/GIFs for UI changes.
- Link related issues/tasks and call out DB/schema or crawler-config impacts explicitly.
- Structure PRs should list moved modules and any newly introduced shared touchpoints explicitly.

## Security & Configuration Tips
- Do not commit secrets. Keep session cookies in local `crawler.properties` only.
- Start from `crawler.properties.example` for local setup.
- Store local database backups under `data/backups/db/` (for example `data/backups/db/game.db.bak-<timestamp>`), never in the repository root.
