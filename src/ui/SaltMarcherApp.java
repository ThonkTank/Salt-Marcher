package ui;

import database.DatabaseManager;
import entities.CombatantState;
import entities.PlayerCharacter;
import javafx.application.Application;
import javafx.concurrent.Task;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.stage.Stage;
import repositories.CreatureRepository;
import repositories.PlayerCharacterRepository;
import services.CombatSetup;
import services.EncounterGenerator;
import services.EncounterGenerator.Encounter;
import ui.components.InitiativeDialog;

import java.util.ArrayList;
import java.util.List;

public class SaltMarcherApp extends Application {

    private static FilterPane.FilterData filterData;

    private FilterPane filterPane;
    private MonsterListPane monsterList;
    private EncounterSummaryPane encounterPane;

    private Label partySummaryLabel;
    private List<PlayerCharacter> partyCache = new ArrayList<>();
    private int cachedAvgLevel = 1;

    @Override
    public void start(Stage primaryStage) {
        BorderPane root = new BorderPane();

        // ---- TOOLBAR ----
        HBox toolbar = new HBox(8);
        toolbar.getStyleClass().add("toolbar");
        toolbar.setAlignment(Pos.CENTER_LEFT);

        Label titleLabel = new Label("D&D Encounter Builder");
        titleLabel.getStyleClass().add("large");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        partySummaryLabel = new Label("Keine Party-Mitglieder");
        partySummaryLabel.getStyleClass().add("text-secondary");
        Button managePartyButton = new Button("Party");
        managePartyButton.getStyleClass().add("accent");
        managePartyButton.setOnAction(e -> {
            PartyDialog dlg = new PartyDialog(primaryStage, this::refreshPartyState);
            dlg.showAndWait();
        });

        toolbar.getChildren().addAll(titleLabel, spacer, partySummaryLabel, managePartyButton);
        root.setTop(toolbar);

        // ---- 3-COLUMN CONTENT ----
        filterPane = new FilterPane(filterData);
        monsterList = new MonsterListPane();
        encounterPane = new EncounterSummaryPane();

        filterPane.setOnFilterChanged(monsterList::applyFilters);
        monsterList.setOnAddCreature(encounterPane::addCreature);
        encounterPane.setOnGenerate(this::onGenerate);
        encounterPane.setOnStartCombat(enc -> onStartCombat(enc, primaryStage));

        root.setLeft(filterPane);
        root.setCenter(monsterList);
        root.setRight(encounterPane);

        refreshPartyState();
        monsterList.loadInitial();

        Scene scene = new Scene(root, 1100, 700);
        scene.getStylesheets().add(
                getClass().getResource("/salt-marcher.css").toExternalForm());

        primaryStage.setTitle("D&D Encounter Builder");
        primaryStage.setScene(scene);
        primaryStage.setMinWidth(900);
        primaryStage.setMinHeight(500);
        primaryStage.show();
    }

    // ---- Party ----

    private void refreshPartyState() {
        partyCache = PlayerCharacterRepository.getAllCharacters();
        int size = partyCache.size();
        if (size > 0) {
            cachedAvgLevel = (int) Math.round(
                    partyCache.stream().mapToInt(pc -> pc.Level).average().orElse(1));
            partySummaryLabel.setText("Party: " + size + " Chars, \u00D8 Lv " + cachedAvgLevel);
            encounterPane.setPartyInfo(size, cachedAvgLevel);
        } else {
            partySummaryLabel.setText("Keine Party-Mitglieder");
            encounterPane.setPartyInfo(0, 1);
        }
    }

    // ---- Helpers ----

    private boolean ensurePartyExists() {
        if (partyCache.isEmpty()) {
            new Alert(Alert.AlertType.WARNING,
                    "Die Party hat keine Mitglieder.\nBitte zuerst Charaktere hinzufuegen.")
                    .showAndWait();
            return false;
        }
        return true;
    }

    // ---- Encounter Generation ----

    private void onGenerate() {
        if (!ensurePartyExists()) return;

        int partySize = partyCache.size();
        int avgLevel = cachedAvgLevel;

        FilterPane.FilterCriteria criteria = filterPane.buildCriteria();
        List<String> types = criteria.types.isEmpty() ? null : new ArrayList<>(criteria.types);
        List<String> subtypes = criteria.subtypes.isEmpty() ? null : new ArrayList<>(criteria.subtypes);
        List<String> biomes = criteria.biomes.isEmpty() ? null : new ArrayList<>(criteria.biomes);

        double difficulty = encounterPane.getSelectedDifficulty();
        int groupCount = encounterPane.getSelectedGroupCount();
        double balance = encounterPane.getSelectedBalance();
        double strength = encounterPane.getSelectedStrength();

        encounterPane.setGenerating();

        Task<Encounter> task = new Task<>() {
            @Override protected Encounter call() {
                return EncounterGenerator.generateEncounter(
                        partySize, avgLevel, types, subtypes, biomes,
                        difficulty, groupCount, balance, strength);
            }
        };
        task.setOnSucceeded(e -> encounterPane.setEncounter(task.getValue()));
        task.setOnFailed(e -> {
            System.err.println("Fehler bei Encounter-Generierung: " + task.getException().getMessage());
            encounterPane.setEncounter(null);
        });
        Thread t = new Thread(task, "sm-encounter-gen");
        t.setDaemon(true);
        t.start();
    }

    // ---- Combat ----

    private void onStartCombat(Encounter encounter, Stage owner) {
        if (encounter == null || encounter.slots.isEmpty()) return;

        if (!ensurePartyExists()) return;

        List<Integer> initiatives = InitiativeDialog.show(owner, partyCache);
        if (initiatives == null) return;

        List<CombatantState> combatants = CombatSetup.buildCombatants(
                partyCache, initiatives, encounter);

        // Open EncounterRunner in new Stage (Phase 5)
        EncounterRunnerView runner = new EncounterRunnerView(combatants);
        Stage runnerStage = new Stage();
        runnerStage.initOwner(owner);
        runnerStage.setTitle("Encounter Runner \u2014 " + encounter.difficulty);
        Scene scene = new Scene(runner, 700, 520);
        scene.getStylesheets().add(
                getClass().getResource("/salt-marcher.css").toExternalForm());
        runnerStage.setScene(scene);
        runnerStage.show();
    }

    public static void main(String[] args) {
        DatabaseManager.setupDatabase();
        filterData = new FilterPane.FilterData(
                CreatureRepository.getDistinctSizes(),
                CreatureRepository.getDistinctTypes(),
                CreatureRepository.getDistinctSubtypes(),
                CreatureRepository.getDistinctBiomes(),
                CreatureRepository.getDistinctAlignments(),
                CreatureRepository.getCrValues()
        );
        launch(args);
    }
}
