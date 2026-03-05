package ui;

import javafx.application.Application;
import javafx.concurrent.Task;
import javafx.scene.Scene;
import javafx.stage.Stage;
import services.CreatureService;
import ui.encounter.EncounterView;
import ui.encounter.EncounterViewCallbacks;
import ui.encounter.PartyPopup;
import ui.overworld.OverworldView;

/**
 * Bootstrap class and cross-view wiring hub.
 * Constructs the AppShell and all views, then injects callbacks that cross view boundaries.
 * Internal wiring (between a view and its own sub-panes) is done inside view constructors.
 * Cross-view wiring (e.g. EncounterView updating InspectorPane via AppShell) is done here
 * because the bootstrap is the only place that holds references to both ends.
 */
public class SaltMarcherApp extends Application {

    @Override
    public void start(Stage primaryStage) {
        AppShell shell = new AppShell();

        EncounterView encounterView = new EncounterView(new EncounterViewCallbacks(
                shell::refreshToolbar,
                shell::refreshPanels,
                shell.getShowStatBlockHandler(),
                shell.getSceneRegistry()
        ));
        encounterView.setOnEnsureStatBlock(shell.getEnsureStatBlockHandler());

        PartyPopup partyPopup = new PartyPopup();
        partyPopup.setOnPartyChanged(encounterView::refreshPartyState);
        shell.addPersistentToolbarItem(partyPopup.getTriggerButton());

        OverworldView overworldView = new OverworldView();

        shell.registerView(ViewId.ENCOUNTER, encounterView);
        shell.registerView(ViewId.OVERWORLD, overworldView);

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
        Task<CreatureService.FilterOptions> filterTask = new Task<>() {
            @Override protected CreatureService.FilterOptions call() {
                return CreatureService.loadFilterOptions();
            }
        };
        filterTask.setOnSucceeded(e -> encounterView.setFilterData(filterTask.getValue()));
        filterTask.setOnFailed(e ->
                System.err.println("SaltMarcherApp.start(): filter load failed: " + filterTask.getException().getMessage()));
        Thread t = new Thread(filterTask, "sm-filter-load");
        t.setDaemon(true);
        t.start();
    }

    public static void main(String[] args) {
        try {
            CreatureService.initSchema();
        } catch (Exception e) {
            System.err.println("SaltMarcherApp.main(): database init failed: " + e.getMessage());
            System.exit(1);
        }
        // Startup diagnostic: show creature count so newcomers know if the DB is populated
        int count = CreatureService.countAll();
        if (count == 0) {
            System.out.println("INFO: Database is empty. Run ./crawl.sh to populate monster data.");
        } else {
            System.out.println("INFO: Database ready: " + count + " creatures loaded.");
        }
        launch(args);
    }
}
