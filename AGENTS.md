# Repository Guidelines

## Project Structure & Module Organization
`src/features/` contains the feature-first Java code. Key modules include `encounter/`, `encountertable/`, `world/hexmap/`, `creaturecatalog/`, `party/`, and `items/`. Shared JavaFX infrastructure lives in `src/ui/`, with app bootstrap in `src/ui/bootstrap/` and reusable controls in `src/ui/components/`. Database setup is under `src/database/`, importer/crawler code under `src/importer/` and `src/shared/crawler/`. Styles live in `resources/`, especially `resources/salt-marcher.css`. Runtime data and backups belong in `data/`; Gradle output goes to `build/`.

## Build, Test, and Development Commands
Use `./gradlew build` as the baseline verification step; it compiles the app and runs repository/convention checks. Reinstall the desktop app with `./gradlew installDesktopApp`; this is the standard post-change step for any implementation work that could be manually tested through the desktop launcher. Start the JavaFX app with `./gradlew run`. Common maintenance tasks include `./gradlew crawler`, `./gradlew crawlerItemsPipeline`, `./gradlew importMonsters`, and `./gradlew importItems`. Legacy end-to-end scripts remain available as `./scripts/crawl.sh` and `./scripts/crawl-items.sh`.
After code changes, do not stop at `./gradlew build` alone when the desktop app is the manual test surface. Default to running `./gradlew build` and then `./gradlew installDesktopApp` before handoff unless the user explicitly says not to reinstall the desktop app.

## Coding Style & Naming Conventions
The stack is Java 21, Gradle Kotlin DSL, JavaFX, and SQLite via JDBC. Use 4-space indentation, `PascalCase` for classes, `camelCase` for methods and locals, and lowercase packages. Keep repositories stateless and pass `Connection` in from callers. Let repositories propagate `SQLException`; fallback behavior belongs in services. Use `try-with-resources` for JDBC, avoid `System.out` and `System.err` in feature service/repository code, and keep cross-feature dependencies intentional. UI text stays German, but established DnD terms such as `Encounter`, `CR`, and `Deadly` remain English.

Editor UI windows must be anchored dropdown windows, not modal pop-up dialogs. For editor create/rename/edit/delete flows, use non-modal `Popup`-based dropdowns that stay within fullscreen mode, return focus to the trigger, and render confirmations inline instead of opening a second dialog.

The upper-right shell inspector is the single global, context-spanning information surface. Static or read-mostly content such as stat blocks, item descriptions, room/area descriptions, table summaries, and similar reference material must be shown there via the shared `DetailsNavigator`/`InspectorPane` flow so back/forward history works consistently for the GM. Do not introduce feature-local "details" panels that duplicate this role. View-local forms, tool settings, create/rename/delete actions, validation feedback, transient workflow hints, and other interactive workflow UI belong in the lower-right state pane; only narrow exceptions such as stat-block mob controls should stay interactive inside the inspector. Treat the inspector as persistent global navigation state, not as a mirror of the current local selection: do not clear or replace it just because a view temporarily has no selection.
Selection state and inspector state are separate concerns. A view may publish a read-only summary to the inspector when the user explicitly opens or selects that reference content, but background reloads, selector refreshes, and other local state churn must only update the inspector if that same inspector card is still the currently visible global entry. Do not continuously republish local selection into the inspector just to keep it synchronized.

Editor controls and settings panes must be self-explanatory without helper prose. Do not add explanatory helper copy, onboarding text, repeated summaries, or other filler text to editor sidebars and selection editors just to narrate obvious controls. Prefer short labels, stable grouping, and consistent ordering over explanatory text. In editor sidebars, place active context first, tool-specific settings second, management actions after the relevant selectors, and visibility toggles last. Avoid duplicate summary-plus-form blocks when one compact editor card can show the same information.

Feature module APIs should expose narrow, role-specific setup methods. Do not add generic `initialize(...)` methods that bundle unrelated wiring such as shell callbacks plus async data loading.

Cross-feature read DTOs belong in `src/features/<feature>/api/`, not in `model/`. Keep `model/` focused on domain/editor state. For lightweight selector DTOs exposed across features, use the `*Summary` naming pattern consistently. Duplicate payload shapes only at explicit boundary adapters such as `application/ports`; avoid redefining the same read DTO in repository, service, model, and API layers without a boundary reason.

## Testing Guidelines
Do not add or change automated tests unless explicitly requested. The minimum quality gate is `./gradlew build`. If you change importer or parser flows, run the relevant crawler/import task. If you change schema or storage assumptions, rebuild `game.db` from crawled data and protect user-created data with backups or migration logic.
After each completed implementation pass, rerun `./gradlew build` and then `./gradlew installDesktopApp` before handoff so manual desktop-app verification always uses the freshly reinstalled desktop application. Skip the reinstall only when the user explicitly waives it or when the task is purely non-code planning/review work.

## Commit & Pull Request Guidelines
Follow Conventional Commits such as `feat: add encounter recovery filter` or `refactor(ui): simplify shell navigation`. Keep each commit focused on one concern. PRs should include a short summary, impacted modules, manual verification steps, and screenshots or GIFs for UI work. Call out schema, crawler, or backup-format impacts explicitly.

## Security & Configuration Tips
Never commit secrets. Keep crawler cookies only in local `crawler.properties`, using `crawler.properties.example` as the template. Store database backups in `data/backups/db/`, not in the repository root.
