package ui;

import database.DatabaseManager;
import javafx.application.Application;
import javafx.concurrent.Task;
import javafx.scene.Scene;
import javafx.stage.Stage;
import repositories.CreatureRepository;

public class SaltMarcherApp extends Application {

    @Override
    public void start(Stage primaryStage) {
        AppShell shell = new AppShell();

        EncounterView encounterView = new EncounterView();
        encounterView.setOnRefreshToolbar(shell::refreshToolbar);
        encounterView.setOnRefreshPanels(shell::refreshPanels);
        encounterView.setOnRequestStatBlock(shell.getInspectorPane()::showStatBlock);
        encounterView.setOnEnsureStatBlock(shell.getInspectorPane()::ensureStatBlock);
        encounterView.setOnUpdateSceneContent(shell.getScenePane()::setContent);

        PartyPanel partyPanel = new PartyPanel();
        partyPanel.setOnPartyChanged(encounterView::refreshPartyState);
        shell.addPersistentToolbarItem(partyPanel.getTriggerButton());

        OverworldView overworldView = new OverworldView();

        shell.registerView(ViewId.ENCOUNTER, encounterView);
        shell.registerView(ViewId.OVERWORLD, overworldView);
        shell.navigateTo(ViewId.ENCOUNTER);

        Scene scene = new Scene(shell, 1150, 700);
        scene.getStylesheets().add(
                getClass().getResource("/salt-marcher.css").toExternalForm());
        encounterView.setScene(scene);

        primaryStage.setTitle("Salt Marcher");
        primaryStage.setScene(scene);
        primaryStage.setMinWidth(900);
        primaryStage.setMinHeight(500);
        primaryStage.show();

        // Load filter data asynchronously after window is visible
        Task<FilterPane.FilterData> filterTask = new Task<>() {
            @Override protected FilterPane.FilterData call() {
                return new FilterPane.FilterData(
                        CreatureRepository.getDistinctSizes(),
                        CreatureRepository.getDistinctTypes(),
                        CreatureRepository.getDistinctSubtypes(),
                        CreatureRepository.getDistinctBiomes(),
                        CreatureRepository.getDistinctAlignments(),
                        CreatureRepository.getCrValues()
                );
            }
        };
        filterTask.setOnSucceeded(e -> encounterView.setFilterData(filterTask.getValue()));
        filterTask.setOnFailed(e ->
                System.err.println("Filter laden fehlgeschlagen: " + filterTask.getException().getMessage()));
        Thread t = new Thread(filterTask, "sm-filter-load");
        t.setDaemon(true);
        t.start();
    }

    public static void main(String[] args) {
        DatabaseManager.setupDatabase();
        launch(args);
    }
}
