# Repository Guidelines

## Project Structure & Module Organization
`src/features/` contains the feature-first Java code. Key modules include `encounter/`, `encountertable/`, `world/hexmap/`, `creaturecatalog/`, `party/`, and `items/`. Shared JavaFX infrastructure lives in `src/ui/`, with app bootstrap in `src/ui/bootstrap/` and reusable controls in `src/ui/components/`. Database setup is under `src/database/`, importer/crawler code under `src/importer/` and `src/shared/crawler/`. Styles live in `resources/`, especially `resources/salt-marcher.css`. Runtime data and backups belong in `data/`; Gradle output goes to `build/`.

## Build, Test, and Development Commands
Use `./gradlew build` as the baseline verification step; it compiles the app and runs repository/convention checks. Start the JavaFX app with `./gradlew run`. Common maintenance tasks include `./gradlew crawler`, `./gradlew crawlerItemsPipeline`, `./gradlew importMonsters`, and `./gradlew importItems`. Legacy end-to-end scripts remain available as `./scripts/crawl.sh` and `./scripts/crawl-items.sh`.

## Coding Style & Naming Conventions
The stack is Java 21, Gradle Kotlin DSL, JavaFX, and SQLite via JDBC. Use 4-space indentation, `PascalCase` for classes, `camelCase` for methods and locals, and lowercase packages. Keep repositories stateless and pass `Connection` in from callers. Let repositories propagate `SQLException`; fallback behavior belongs in services. Use `try-with-resources` for JDBC, avoid `System.out` and `System.err` in feature service/repository code, and keep cross-feature dependencies intentional. UI text stays German, but established DnD terms such as `Encounter`, `CR`, and `Deadly` remain English.

Editor UI windows must be anchored dropdown windows, not modal pop-up dialogs. For editor create/rename/edit/delete flows, use non-modal `Popup`-based dropdowns that stay within fullscreen mode, return focus to the trigger, and render confirmations inline instead of opening a second dialog.

Feature module APIs should expose narrow, role-specific setup methods. Do not add generic `initialize(...)` methods that bundle unrelated wiring such as shell callbacks plus async data loading.

Cross-feature read DTOs belong in `src/features/<feature>/api/`, not in `model/`. Keep `model/` focused on domain/editor state. For lightweight selector DTOs exposed across features, use the `*Summary` naming pattern consistently. Duplicate payload shapes only at explicit boundary adapters such as `application/ports`; avoid redefining the same read DTO in repository, service, model, and API layers without a boundary reason.

## Testing Guidelines
Do not add or change automated tests unless explicitly requested. The minimum quality gate is `./gradlew build`. If you change importer or parser flows, run the relevant crawler/import task. If you change schema or storage assumptions, rebuild `game.db` from crawled data and protect user-created data with backups or migration logic.

## Commit & Pull Request Guidelines
Follow Conventional Commits such as `feat: add encounter recovery filter` or `refactor(ui): simplify shell navigation`. Keep each commit focused on one concern. PRs should include a short summary, impacted modules, manual verification steps, and screenshots or GIFs for UI work. Call out schema, crawler, or backup-format impacts explicitly.

## Security & Configuration Tips
Never commit secrets. Keep crawler cookies only in local `crawler.properties`, using `crawler.properties.example` as the template. Store database backups in `data/backups/db/`, not in the repository root.
