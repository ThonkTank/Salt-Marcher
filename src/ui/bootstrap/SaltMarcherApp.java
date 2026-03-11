package ui.bootstrap;

import javafx.application.Application;
import javafx.concurrent.Task;
import javafx.scene.Scene;
import javafx.stage.Stage;

import java.util.logging.Level;
import java.util.logging.Logger;

import database.DatabaseManager;
import features.creatures.api.CreatureCatalogService;
import features.party.api.PartyModule;
import features.encounter.api.EncounterModule;
import features.encountertable.api.EncounterTableModule;
import features.loottable.api.LootTableModule;
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

    @Override
    public void start(Stage primaryStage) {
        AppShell shell = new AppShell();

        EncounterModule encounterModule = new EncounterModule(
                shell::refreshToolbar,
                shell::refreshPanels,
                shell.getShowStatBlockHandler(),
                shell.getEnsureStatBlockHandler(),
                shell.getSceneRegistry()
        );
        AppView encounterView = encounterModule.view();

        PartyModule partyModule = new PartyModule(
                encounterModule::refreshPartyState,
                encounterModule.partyCacheRefreshPort());
        shell.addPersistentToolbarItem(partyModule.toolbarItem());

        WorldModule worldModule = new WorldModule();
        worldModule.registerScenes(shell.getSceneRegistry());
        AppView overworldView = worldModule.overworldView();
        AppView mapEditorView = worldModule.mapEditorView();
        AppView dungeonView = worldModule.dungeonView();
        AppView dungeonEditorView = worldModule.dungeonEditorView();

        EncounterTableModule encounterTableModule = new EncounterTableModule();
        AppView tableEditorView = encounterTableModule.view();
        LootTableModule lootTableModule = new LootTableModule();
        lootTableModule.start(shell.getShowContentHandler());
        AppView lootTableEditorView = lootTableModule.view();

        // Register session views first, then editors (sidebar separator auto-inserts between categories)
        shell.registerView(ViewId.ENCOUNTER, encounterView);
        shell.registerView(ViewId.OVERWORLD, overworldView);
        shell.registerView(ViewId.DUNGEON, dungeonView);
        shell.registerView(ViewId.MAP_EDITOR, mapEditorView);
        shell.registerView(ViewId.DUNGEON_EDITOR, dungeonEditorView);
        shell.registerView(ViewId.TABLE_EDITOR, tableEditorView);
        shell.registerView(ViewId.LOOT_TABLE_EDITOR, lootTableEditorView);

        Scene scene = new Scene(shell, 1150, 700);
        scene.getStylesheets().add(
                getClass().getResource("/salt-marcher.css").toExternalForm());

        shell.navigateTo(ViewId.ENCOUNTER);

        primaryStage.setTitle("Salt Marcher");
        primaryStage.setScene(scene);
        primaryStage.setMinWidth(900);
        primaryStage.setMinHeight(500);
        primaryStage.show();

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
                    encounterTableModule.setFilterData(filterData);
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("SaltMarcherApp.start()", throwable));

    }

    public static void main(String[] args) {
        try {
            DatabaseManager.setupDatabase();
        } catch (RuntimeException e) {
            UiErrorReporter.reportBackgroundFailure("SaltMarcherApp.main()", e);
            System.exit(1);
        }
        // Startup diagnostic: show creature count so newcomers know if the DB is populated
        CreatureCatalogService.ServiceResult<Integer> countResult = CreatureCatalogService.countAll();
        if (!countResult.isOk()) {
            LOGGER.log(Level.INFO, "Database check unavailable (DB access failed).");
        } else if (countResult.value() == 0) {
            LOGGER.log(Level.INFO, "Database is empty. Run ./scripts/crawl.sh to populate monster data.");
        } else {
            LOGGER.log(Level.INFO, "Database ready: {0} creatures loaded.", countResult.value());
        }
        launch(args);
    }
}
