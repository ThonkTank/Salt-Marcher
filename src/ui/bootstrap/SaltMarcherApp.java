package ui.bootstrap;

import javafx.application.Application;
import javafx.application.Platform;
import javafx.application.Preloader;
import javafx.concurrent.Task;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.stage.Stage;

import java.util.logging.Level;
import java.util.logging.Logger;

import database.DatabaseManager;
import features.creatures.api.CreatureCatalogService;
import features.party.api.PartyModule;
import features.encounter.api.EncounterModule;
import features.spells.api.SpellCatalogModule;
import features.tables.api.TablesModule;
import features.world.api.WorldModule;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;
import ui.shell.AppShell;
import ui.shell.AppView;
import ui.shell.ViewId;

/**
 * Bootstrap class and cross-view wiring hub.
 * Constructs the AppShell and all views, then injects callbacks that cross view boundaries.
 * Internal feature wiring stays inside the modules/views.
 * Cross-view wiring (e.g. encounter feature callbacks updating shell panels) is done here
 * because the bootstrap is the only place that holds references to both ends.
 */
public class SaltMarcherApp extends Application {

    private static final Logger LOGGER = Logger.getLogger(SaltMarcherApp.class.getName());
    private static final String STARTUP_ERROR_TITLE = "Start fehlgeschlagen";
    private static final String STARTUP_ERROR_TEXT = "Salt Marcher konnte nicht gestartet werden.";

    @Override
    public void start(Stage primaryStage) {
        Platform.setImplicitExit(false);
        Task<Void> startupTask = new Task<>() {
            @Override
            protected Void call() {
                DatabaseManager.setupDatabase();
                logDatabaseState();
                return null;
            }
        };
        startupTask.setOnSucceeded(event -> {
            try {
                showMainStage(primaryStage);
            } catch (RuntimeException e) {
                handleStartupFailure(e);
            }
        });
        startupTask.setOnFailed(event -> handleStartupFailure(startupTask.getException()));
        Thread startupThread = new Thread(startupTask, "sm-startup");
        // The app must stay alive until the first stage is shown.
        startupThread.setDaemon(false);
        startupThread.start();
    }

    private void showMainStage(Stage primaryStage) {
        AppShell shell = new AppShell();

        EncounterModule encounterModule = new EncounterModule(
                shell::refreshToolbar,
                shell::refreshPanels,
                shell.getDetailsNavigator(),
                shell.getSceneRegistry()
        );
        AppView encounterView = encounterModule.view();

        PartyModule partyModule = new PartyModule(
                encounterModule::refreshPartyState,
                encounterModule.partyCacheRefreshPort());
        shell.addPersistentToolbarItem(partyModule.toolbarItem());

        WorldModule worldModule = new WorldModule(shell.getDetailsNavigator());
        worldModule.registerScenes(shell.getSceneRegistry());
        AppView overworldView = worldModule.overworldView();
        AppView mapEditorView = worldModule.mapEditorView();
        AppView dungeonView = worldModule.dungeonView();
        AppView dungeonEditorView = worldModule.dungeonEditorView();

        TablesModule tablesModule = new TablesModule(shell.getDetailsNavigator());
        AppView tableEditorView = tablesModule.view();
        SpellCatalogModule spellCatalogModule = new SpellCatalogModule();
        spellCatalogModule.start(shell.getDetailsNavigator());
        AppView spellCatalogView = spellCatalogModule.view();

        // Register session views first, then editors (sidebar separator auto-inserts between categories)
        shell.registerView(ViewId.ENCOUNTER, encounterView);
        shell.registerView(ViewId.OVERWORLD, overworldView);
        shell.registerView(ViewId.DUNGEON, dungeonView);
        shell.registerView(ViewId.MAP_EDITOR, mapEditorView);
        shell.registerView(ViewId.DUNGEON_EDITOR, dungeonEditorView);
        shell.registerView(ViewId.TABLE_EDITOR, tableEditorView);
        shell.registerView(ViewId.SPELLS, spellCatalogView);

        Scene scene = new Scene(shell, 1150, 700);
        scene.getStylesheets().add(
                getClass().getResource("/salt-marcher.css").toExternalForm());

        shell.navigateTo(ViewId.ENCOUNTER);

        primaryStage.setTitle("Salt Marcher");
        primaryStage.setScene(scene);
        primaryStage.setMinWidth(900);
        primaryStage.setMinHeight(500);
        primaryStage.show();
        Platform.setImplicitExit(true);
        notifyPreloader(new SaltMarcherPreloader.AppReadyNotification());

        // Filter data requires a DB query (creature types/biomes), so it is loaded asynchronously.
        // setFilterData() wires the filter-changed callback internally (see EncounterControls.setFilterData).
        // All other encounter feature callbacks above are wired synchronously.
        Task<CreatureCatalogService.ServiceResult<CreatureCatalogService.FilterOptions>> filterTask = new Task<>() {
            @Override protected CreatureCatalogService.ServiceResult<CreatureCatalogService.FilterOptions> call() {
                return CreatureCatalogService.loadFilterOptions();
            }
        };
        UiAsyncTasks.submit(
                filterTask,
                result -> {
                    if (!result.isOk()) {
                        UiErrorReporter.reportBackgroundFailure(
                                "SaltMarcherApp.start() loadFilterOptions failed",
                                new IllegalStateException("CreatureCatalogService status: " + result.status()));
                    }
                    CreatureCatalogService.FilterOptions filterData = result.value();
                    if (filterData == null) {
                        UiErrorReporter.reportBackgroundFailure(
                                "SaltMarcherApp.start() loadFilterOptions returned null value",
                                null);
                        return;
                    }
                    encounterModule.setFilterData(filterData);
                    tablesModule.setCreatureFilterData(filterData);
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("SaltMarcherApp.start()", throwable));
    }

    private void handleStartupFailure(Throwable throwable) {
        UiErrorReporter.reportBackgroundFailure("SaltMarcherApp.start()", throwable);
        notifyPreloader(new Preloader.StateChangeNotification(
                Preloader.StateChangeNotification.Type.BEFORE_START));

        Alert alert = new Alert(Alert.AlertType.ERROR);
        alert.setTitle(STARTUP_ERROR_TITLE);
        alert.setHeaderText(STARTUP_ERROR_TEXT);
        alert.setContentText(throwable == null ? "Unbekannter Fehler beim Start." : throwable.getMessage());
        alert.showAndWait();

        Platform.exit();
    }

    private static void logDatabaseState() {
        // Startup diagnostic: show creature count so newcomers know if the DB is populated.
        CreatureCatalogService.ServiceResult<Integer> countResult = CreatureCatalogService.countAll();
        if (!countResult.isOk()) {
            LOGGER.log(Level.INFO, "Database check unavailable (DB access failed).");
        } else if (countResult.value() == 0) {
            LOGGER.log(Level.INFO, "Database is empty. Run ./scripts/crawl.sh to populate monster data.");
        } else {
            LOGGER.log(Level.INFO, "Database ready: {0} creatures loaded.", countResult.value());
        }
    }

    public static void main(String[] args) {
        launch(args);
    }
}
