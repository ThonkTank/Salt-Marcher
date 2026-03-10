package ui.bootstrap;

import javafx.application.Application;
import javafx.concurrent.Task;
import javafx.scene.Scene;
import javafx.stage.Stage;

import java.util.logging.Level;
import java.util.logging.Logger;

import database.DatabaseManager;
import features.creatures.api.CreatureCatalogService;
import features.creatures.api.CreatureMaintenanceService;
import features.party.api.PartyModule;
import features.encounter.api.EncounterModule;
import features.encountertable.api.EncounterTableModule;
import features.world.hexmap.api.HexMapModule;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;
import ui.shell.AppShell;
import ui.shell.AppView;
import ui.shell.ViewId;

/**
 * Bootstrap class and cross-view wiring hub.
 * Constructs the AppShell and all views, then injects callbacks that cross view boundaries.
 * Internal wiring (between a view and its own sub-panes) is done inside view constructors.
 * Cross-view wiring (e.g. EncounterView updating InspectorPane via AppShell) is done here
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

        HexMapModule hexMapModule = new HexMapModule();
        hexMapModule.registerScenes(shell.getSceneRegistry());
        AppView overworldView = hexMapModule.overworldView();
        AppView mapEditorView = hexMapModule.mapEditorView();

        EncounterTableModule encounterTableModule = new EncounterTableModule();
        AppView tableEditorView = encounterTableModule.view();

        // Register session views first, then editors (sidebar separator auto-inserts between categories)
        shell.registerView(ViewId.ENCOUNTER, encounterView);
        shell.registerView(ViewId.OVERWORLD, overworldView);
        shell.registerView(ViewId.MAP_EDITOR, mapEditorView);
        shell.registerView(ViewId.TABLE_EDITOR, tableEditorView);

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
        // All other EncounterView callbacks above are wired synchronously.
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
        CreatureMaintenanceService.BackfillSummary roleBackfill =
                CreatureMaintenanceService.backfillMissingRoles();
        if (roleBackfill.checked() > 0 || roleBackfill.failed() > 0) {
            LOGGER.log(
                    Level.INFO,
                    "Role backfill checked={0}, updated={1}, failed={2}",
                    new Object[] { roleBackfill.checked(), roleBackfill.updated(), roleBackfill.failed() }
            );
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
