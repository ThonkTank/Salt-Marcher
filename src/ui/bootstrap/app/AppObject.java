package ui.bootstrap.app;

import database.DatabaseManager;
import features.creatures.api.CreatureCatalogService;
import features.encounter.api.AdventuringDayToolbarModule;
import features.encounter.api.EncounterModule;
import features.party.api.PartyModule;
import features.spells.api.SpellCatalogModule;
import features.tables.api.TablesModule;
import features.world.api.ApiObject;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.application.Preloader;
import javafx.concurrent.Task;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.stage.Stage;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;
import ui.bootstrap.preloader.PreloaderObject;
import ui.shell.AppShell;
import ui.shell.AppView;
import ui.shell.ViewId;

import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Application entry owner for the shared shell bootstrap and feature registration.
 */
public final class AppObject extends Application {

    private static final Logger LOGGER = Logger.getLogger(AppObject.class.getName());
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

        AdventuringDayToolbarModule adventuringDayToolbarModule = new AdventuringDayToolbarModule();
        Runnable refreshPartyConsumers = () -> {
            encounterModule.refreshPartyState();
            adventuringDayToolbarModule.refreshActivePartyState();
        };
        PartyModule partyModule = new PartyModule(
                refreshPartyConsumers,
                encounterModule.partyCacheRefreshPort());
        shell.addPersistentToolbarItem(adventuringDayToolbarModule.toolbarItem());
        shell.addPersistentToolbarItem(partyModule.toolbarItem());
        adventuringDayToolbarModule.refreshActivePartyState();

        ApiObject worldApi = new ApiObject(shell.getDetailsNavigator());
        worldApi.registerScenes(new features.world.api.input.RegisterScenesInput(shell.getSceneRegistry()));
        var worldViews = worldApi.views();
        AppView overworldView = worldViews.overworldView();
        AppView mapEditorView = worldViews.mapEditorView();
        AppView dungeonView = worldViews.dungeonView();
        AppView dungeonEditorView = worldViews.dungeonEditorView();

        TablesModule tablesModule = new TablesModule(shell.getDetailsNavigator());
        AppView tableEditorView = tablesModule.view();
        SpellCatalogModule spellCatalogModule = new SpellCatalogModule();
        spellCatalogModule.start(shell.getDetailsNavigator());
        AppView spellCatalogView = spellCatalogModule.view();

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
        notifyPreloader(new PreloaderObject.AppReadyNotification());

        Task<CreatureCatalogService.ServiceResult<CreatureCatalogService.FilterOptions>> filterTask = new Task<>() {
            @Override
            protected CreatureCatalogService.ServiceResult<CreatureCatalogService.FilterOptions> call() {
                return CreatureCatalogService.loadFilterOptions();
            }
        };
        UiAsyncTasks.submit(
                filterTask,
                result -> {
                    if (!result.isOk()) {
                        UiErrorReporter.reportBackgroundFailure(
                                "AppObject.start() loadFilterOptions failed",
                                new IllegalStateException("CreatureCatalogService status: " + result.status()));
                    }
                    CreatureCatalogService.FilterOptions filterData = result.value();
                    if (filterData == null) {
                        UiErrorReporter.reportBackgroundFailure(
                                "AppObject.start() loadFilterOptions returned null value",
                                null);
                        return;
                    }
                    encounterModule.setFilterData(filterData);
                    tablesModule.setCreatureFilterData(filterData);
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("AppObject.start()", throwable));
    }

    private void handleStartupFailure(Throwable throwable) {
        UiErrorReporter.reportBackgroundFailure("AppObject.start()", throwable);
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
