package features.encounter.combat.ui;

import features.creatures.model.Creature;
import features.encounter.builder.ui.EncounterRosterPane;
import features.encounter.combat.application.EncounterCombatService;
import features.encounter.combat.model.Combatant;
import features.encounter.combat.service.CombatSession;
import features.encounter.model.Encounter;
import features.encounter.internal.EncounterAsyncTaskSupport;
import features.party.api.PartyApi;
import shared.rules.service.XpCalculator;
import javafx.concurrent.Task;
import javafx.event.EventHandler;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.control.TextInputControl;
import javafx.scene.input.KeyEvent;
import ui.shell.SceneHandle;
import features.creatures.api.StatBlockRequest;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.IntSupplier;
import java.util.function.Supplier;

public final class CombatWorkflowController {

    private final EncounterCombatService encounterService;
    private final SceneHandle encounterScene;
    private final EncounterRosterPane rosterPane;
    private final Runnable onEnterCombatMode;
    private final Runnable onExitCombatMode;
    private final Consumer<StatBlockRequest> onRequestStatBlock;

    private Consumer<StatBlockRequest> onEnsureStatBlock;
    private CombatTrackerPane trackerPane;
    private Scene scene;
    private Task<EncounterCombatService.CombatStartResult> combatPreparationTask;
    private final EventHandler<KeyEvent> combatKeyHandler = this::handleSceneCombatKey;
    private Supplier<List<PartyApi.PartyMember>> partySupplier = List::of;
    private IntSupplier avgLevelSupplier = () -> 1;

    public CombatWorkflowController(
            EncounterCombatService encounterService,
            SceneHandle encounterScene,
            EncounterRosterPane rosterPane,
            Runnable onEnterCombatMode,
            Runnable onExitCombatMode,
            Consumer<StatBlockRequest> onRequestStatBlock
    ) {
        this.encounterService = Objects.requireNonNull(encounterService, "encounterService");
        this.encounterScene = Objects.requireNonNull(encounterScene, "encounterScene");
        this.rosterPane = Objects.requireNonNull(rosterPane, "rosterPane");
        this.onEnterCombatMode = Objects.requireNonNull(onEnterCombatMode, "onEnterCombatMode");
        this.onExitCombatMode = Objects.requireNonNull(onExitCombatMode, "onExitCombatMode");
        this.onRequestStatBlock = Objects.requireNonNull(onRequestStatBlock, "onRequestStatBlock");
    }

    public void setOnEnsureStatBlock(Consumer<StatBlockRequest> callback) {
        this.onEnsureStatBlock = callback;
    }

    public void onSceneChanged(Scene oldScene, Scene newScene, boolean combatModeActive) {
        if (newScene == null && oldScene != null && combatModeActive) {
            oldScene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
        }
        scene = newScene;
        syncCombatKeyHandler(combatModeActive);
    }

    public void onHide() {
        if (scene != null) {
            scene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
        }
        EncounterAsyncTaskSupport.cancel(combatPreparationTask);
    }

    public void syncCombatKeyHandler(boolean combatModeActive) {
        if (scene == null) {
            return;
        }
        scene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
        if (combatModeActive) {
            scene.addEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
        }
    }

    public void addReinforcement(Creature creature) {
        if (trackerPane == null) {
            return;
        }
        trackerPane.addReinforcement(creature);
        updateCombatStatus();
    }

    public CombatTrackerPane getTrackerPane() {
        return trackerPane;
    }

    public void prepareCombat(
            List<PartyApi.PartyMember> party,
            List<Integer> pcInitiatives,
            Encounter encounter,
            List<Integer> monsterInitiatives,
            List<Long> encounterTableIds,
            Supplier<List<PartyApi.PartyMember>> partySupplier,
            IntSupplier avgLevelSupplier
    ) {
        this.partySupplier = Objects.requireNonNull(partySupplier, "partySupplier");
        this.avgLevelSupplier = Objects.requireNonNull(avgLevelSupplier, "avgLevelSupplier");
        EncounterAsyncTaskSupport.cancel(combatPreparationTask);
        Task<EncounterCombatService.CombatStartResult> task = new Task<>() {
            @Override
            protected EncounterCombatService.CombatStartResult call() {
                return encounterService.prepareCombatants(new EncounterCombatService.CombatStartRequest(
                        party,
                        pcInitiatives,
                        encounter,
                        monsterInitiatives,
                        encounterTableIds
                ));
            }
        };
        combatPreparationTask = task;
        EncounterAsyncTaskSupport.submit(task, "EncounterView.onRequestCombat()",
                this::handleCombatStartResult, () -> combatPreparationTask == task);
    }

    private void startCombat(List<Combatant> combatants) {
        trackerPane = new CombatTrackerPane();
        trackerPane.setOnRequestStatBlock(onRequestStatBlock);
        trackerPane.setOnEnsureStatBlock(onEnsureStatBlock);
        trackerPane.setOnCombatStateChanged(this::updateCombatStatus);
        trackerPane.setOnEndCombat(this::onEndCombat);
        trackerPane.startCombat(combatants);

        onEnterCombatMode.run();
        updateCombatStatus();
    }

    private void handleCombatStartResult(EncounterCombatService.CombatStartResult result) {
        if (result == null) {
            Alert alert = new Alert(Alert.AlertType.ERROR, "Kampfstart fehlgeschlagen.");
            alert.setTitle("Encounter Builder");
            alert.setHeaderText("Ungültige Kampfdaten");
            alert.showAndWait();
            return;
        }
        if (result.status() == EncounterCombatService.CombatStartStatus.SUCCESS) {
            startCombat(result.combatants());
            return;
        }
        Alert alert = new Alert(Alert.AlertType.ERROR, mapCombatStartFailure(result.failureReason()));
        alert.setTitle("Encounter Builder");
        alert.setHeaderText("Ungültige Kampfdaten");
        alert.showAndWait();
    }

    private void onEndCombat() {
        if (trackerPane == null) {
            return;
        }
        List<CombatSession.EnemyOutcome> outcomes = trackerPane.getEnemyOutcomes();
        trackerPane = null;
        onExitCombatMode.run();
        CombatResultsPane resultsPane = new CombatResultsPane(encounterService, outcomes, partySupplier.get());
        resultsPane.setOnDone(() -> encounterScene.setContent(rosterPane));
        encounterScene.setContent(resultsPane);
    }

    private void updateCombatStatus() {
        if (trackerPane == null) {
            return;
        }
        List<PartyApi.PartyMember> party = partySupplier.get();
        CombatSession.EnemyTotals totals = trackerPane.getEnemyTotals();
        XpCalculator.DifficultyStats difficultyStats = encounterService.computeLiveDifficultyStats(
                trackerPane.getCombatants(),
                Math.max(1, party.size()),
                avgLevelSupplier.getAsInt());
        trackerPane.updateStatusBar(difficultyStats, totals.alive(), totals.total(), trackerPane.getRound());
        trackerPane.signalAllEnemiesDead(totals.alive() == 0 && totals.total() > 0);
    }

    private void handleSceneCombatKey(KeyEvent event) {
        if (event.getTarget() instanceof TextInputControl) {
            return;
        }
        if (event.getTarget() instanceof javafx.scene.control.Button) {
            return;
        }
        if (trackerPane != null && trackerPane.handleCombatKey(event)) {
            event.consume();
        }
    }

    private String mapCombatStartFailure(EncounterCombatService.CombatStartFailureReason reason) {
        if (reason == null) {
            return "Kampfstart fehlgeschlagen. Eingaben prüfen und erneut versuchen.";
        }
        return switch (reason) {
            case REQUEST_MISSING ->
                    "Kampfanfrage ist unvollständig.";
            case PARTY_MISSING ->
                    "Die Party-Daten fehlen. Ansicht neu laden und erneut versuchen.";
            case PC_INITIATIVES_MISSING ->
                    "Initiativewerte der Spieler fehlen.";
            case ENCOUNTER_MISSING ->
                    "Encounter-Daten fehlen.";
            case ENCOUNTER_SLOTS_INVALID ->
                    "Encounter-Slots enthalten ungültige Daten.";
            case PARTY_MEMBER_MISSING ->
                    "Mindestens ein Party-Mitglied ist ungültig.";
            case PC_INITIATIVE_VALUE_MISSING ->
                    "Mindestens ein Initiativewert der Spieler ist leer.";
            case PC_INITIATIVE_COUNT_MISMATCH ->
                    "Anzahl der Spieler und Initiativewerte passt nicht zusammen.";
            case LOOT_CONFIGURATION_AMBIGUOUS ->
                    "Die ausgewählten Encounter-Tabellen verweisen auf unterschiedliche Loot-Tabellen. Für Kampfbeute darf höchstens eine verknüpfte Loot-Tabelle aktiv sein.";
            case LOOT_DATA_UNAVAILABLE ->
                    "Loot-Daten konnten nicht geladen werden. Erneut versuchen oder Loot-Verknüpfungen prüfen.";
        };
    }
}
