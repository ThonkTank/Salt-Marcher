package ui.encounter;

import entities.Combatant;
import entities.Creature;
import entities.MonsterCombatant;
import entities.PlayerCharacter;
import ui.AppView;
import ui.SceneHandle;
import javafx.concurrent.Task;
import javafx.event.EventHandler;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.control.Label;
import javafx.scene.control.TextInputControl;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import services.CreatureService;
import services.PartyService;
import services.CombatSetup;
import services.RoleClassifier;
import services.XpCalculator;
import services.EncounterGenerator;
import entities.Encounter;
import entities.EncounterSlot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

/**
 * Encounter workflow view: orchestrates builder and combat modes.
 * Builder mode shows the monster browser + roster; combat mode shows the turn tracker.
 */
public class EncounterView implements AppView {

    enum Mode { BUILDER, COMBAT }

    /** Mid-d20 placeholder for PC initiative at combat start — editable inline in the tracker. */
    private static final int DEFAULT_PC_INITIATIVE = 10;

    private final Runnable onRefreshToolbar;
    private final Runnable onRefreshPanels;
    private final Consumer<Long> onRequestStatBlock;
    private Consumer<Long> onEnsureStatBlock;
    private final SceneHandle encounterScene;
    private final MonsterListPane monsterList;

    private final EncounterControls encounterControls;
    private final EncounterRosterPane rosterPane;
    // Null until startCombat() is called; destroyed by onEndCombat(). All access must be null-checked.
    private CombatTrackerPane trackerPane;

    // All mutable fields below are accessed exclusively on the FX Application Thread.
    // partyCache is written in Task.setOnSucceeded (FX thread) and must never be read from a background task.
    private List<PlayerCharacter> partyCache = new ArrayList<>();
    private int cachedAvgLevel = 1;
    private Mode currentMode = Mode.BUILDER;
    private Scene scene;
    private Task<?> partyLoadTask;
    private final EventHandler<KeyEvent> combatKeyHandler = this::handleSceneCombatKey;
    private boolean initialLoadDone = false;

    public EncounterView(EncounterViewCallbacks callbacks) {
        this.onRefreshToolbar = callbacks.onRefreshToolbar();
        this.onRefreshPanels = callbacks.onRefreshPanels();
        this.onRequestStatBlock = callbacks.onRequestStatBlock();
        monsterList = new MonsterListPane();
        encounterControls = new EncounterControls();
        rosterPane = new EncounterRosterPane();
        this.encounterScene = callbacks.sceneRegistry().registerScene("⚔ Encounter", rosterPane);

        // Track scene availability automatically — eliminates the need for setScene(Scene).
        monsterList.sceneProperty().addListener((obs, oldScene, newScene) -> {
            if (newScene == null && oldScene != null && currentMode == Mode.COMBAT) {
                oldScene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
            }
            scene = newScene;
        });

        // Wiring (filter callback wired in setFilterData when FilterPane is ready)
        monsterList.setOnAddCreature(this::onAddCreature);
        monsterList.setOnRequestStatBlock(onRequestStatBlock);
        rosterPane.setOnGenerate(this::onGenerate);
        rosterPane.setOnStartCombat(this::onRequestCombat);
        rosterPane.setOnRosterChanged(this::onRosterChanged);
        rosterPane.setOnRequestStatBlock(onRequestStatBlock);
    }

    // ---- Optional callback setter (wired by SaltMarcherApp after construction) ----
    // Required cross-view callbacks are passed via EncounterViewCallbacks in the constructor.
    // Only the optional callback is injected here.

    /** Optional: omitting disables auto-show (without toggle) for stat blocks during combat. */
    public void setOnEnsureStatBlock(Consumer<Long> callback) { this.onEnsureStatBlock = callback; }

    public void setFilterData(CreatureService.FilterOptions data) {
        encounterControls.setFilterData(data);
        encounterControls.setOnFilterChanged(monsterList::applyFilters);
    }

    // ---- AppView interface ----

    @Override public Node getRoot() { return monsterList; }

    @Override public String getTitle() {
        return currentMode == Mode.COMBAT ? "Encounter Runner" : "Encounter Builder";
    }

    @Override public String getIconText() { return "\u2694"; }

    @Override
    public Node getControlPanel() { return encounterControls; }

    @Override
    public void onShow() {
        refreshPartyState();
        if (!initialLoadDone) {
            monsterList.loadInitial();
            initialLoadDone = true;
        }
        // Ensure the encounter tab shows the right content and is active
        encounterScene.setContent(currentMode == Mode.COMBAT && trackerPane != null ? trackerPane : rosterPane);
        encounterScene.activate();
    }

    // ---- Mode switching ----

    private void switchMode(Mode mode) {
        Mode oldMode = currentMode;
        currentMode = mode;
        monsterList.setCombatMode(mode == Mode.COMBAT);
        encounterControls.setCombatMode(mode == Mode.COMBAT);

        // Install/remove scene-level combat shortcuts
        if (scene != null) {
            if (mode == Mode.COMBAT && oldMode != Mode.COMBAT) {
                scene.addEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
            } else if (mode != Mode.COMBAT && oldMode == Mode.COMBAT) {
                scene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
            }
        }

        // Update encounter tab content (Roster ↔ Tracker)
        encounterScene.setContent(mode == Mode.COMBAT ? trackerPane : rosterPane);
        onRefreshToolbar.run();
        onRefreshPanels.run();
    }

    private void handleSceneCombatKey(KeyEvent e) {
        if (currentMode != Mode.COMBAT) return;
        if (e.getTarget() instanceof TextInputControl) return;
        // Let buttons handle their own Space key to avoid double-firing nextTurn
        if (e.getTarget() instanceof javafx.scene.control.Button) return;
        if (trackerPane != null && trackerPane.handleCombatKey(e)) {
            e.consume();
        }
    }

    // ---- Party ----

    public void refreshPartyState() {
        if (partyLoadTask != null && partyLoadTask.isRunning()) partyLoadTask.cancel();
        rosterPane.setGenerateEnabled(false);
        rosterPane.setStartCombatEnabled(false);
        Task<List<PlayerCharacter>> task = new Task<>() {
            @Override protected List<PlayerCharacter> call() {
                return PartyService.getActiveParty();
            }
        };
        task.setOnSucceeded(e -> {
            partyCache = task.getValue();
            int size = partyCache.size();
            if (size > 0) {
                cachedAvgLevel = PartyService.averageLevel(partyCache);
                rosterPane.setPartyInfo(size, cachedAvgLevel);
            } else {
                cachedAvgLevel = 1;
                rosterPane.setPartyInfo(0, 1);
            }
            rosterPane.setGenerateEnabled(true);
            // "Kampf starten" stays disabled until roster has slots
            rosterPane.setStartCombatEnabled(rosterPane.hasSlots());
        });
        task.setOnFailed(e ->
                System.err.println("EncounterView.refreshPartyState(): " + task.getException().getMessage()));
        partyLoadTask = task;
        Thread t = new Thread(task, "sm-party-load");
        t.setDaemon(true);
        t.start();
    }

    // ---- Actions ----

    private void onAddCreature(Creature creature) {
        if (currentMode == Mode.COMBAT && trackerPane != null) {
            trackerPane.addReinforcement(creature);
            updateCombatStatus();
        } else {
            rosterPane.addCreature(creature, RoleClassifier.classify(creature));
        }
    }

    // ---- Encounter Generation ----

    private void onGenerate() {
        if (!ensurePartyExists()) return;

        int partySize = partyCache.size();
        int avgLevel = cachedAvgLevel;

        CreatureService.FilterCriteria criteria = encounterControls.buildCriteria();
        List<String> types    = nullIfEmpty(criteria.types());
        List<String> subtypes = nullIfEmpty(criteria.subtypes());
        List<String> biomes   = nullIfEmpty(criteria.biomes());

        double difficulty = encounterControls.getSelectedDifficulty();
        int groupCount = encounterControls.getSelectedGroupCount();
        double balance = encounterControls.getSelectedBalance();
        double strength = encounterControls.getSelectedStrength();

        rosterPane.showGenerating();
        rosterPane.setGenerateEnabled(false);

        Task<Encounter> task = new Task<>() {
            @Override protected Encounter call() {
                int xpCeiling = EncounterGenerator.computeXpCeiling(avgLevel, difficulty, partySize);
                List<Creature> candidates = CreatureService.getCreaturesForEncounter(
                        types, 1, xpCeiling, biomes, subtypes);
                return EncounterGenerator.generateEncounter(
                        new EncounterGenerator.EncounterRequest(
                            partySize, avgLevel, types, subtypes, biomes,
                            difficulty, groupCount, balance, strength),
                        candidates);
            }
        };
        task.setOnSucceeded(e -> {
            rosterPane.setGenerateEnabled(true);
            rosterPane.setEncounter(task.getValue());
        });
        task.setOnFailed(e -> {
            System.err.println("EncounterView.onGenerate(): " + task.getException().getMessage());
            rosterPane.setGenerateEnabled(true);
            rosterPane.showGenerationFailed();
        });
        Thread t = new Thread(task, "sm-encounter-gen");
        t.setDaemon(true);
        t.start();
    }

    // ---- Combat start ----

    private void onRequestCombat() {
        if (!rosterPane.hasSlots()) return;
        if (!ensurePartyExists()) return;

        Encounter encounter = rosterPane.buildEncounter();
        List<PlayerCharacter> partyCopy = List.copyOf(partyCache);
        List<Integer> defaultInitiatives = Collections.nCopies(partyCopy.size(), DEFAULT_PC_INITIATIVE);
        Task<List<Combatant>> task = new Task<>() {
            @Override
            protected List<Combatant> call() {
                return CombatSetup.buildCombatants(partyCopy, defaultInitiatives, encounter);
            }
        };
        task.setOnSucceeded(e -> startCombat(task.getValue()));
        task.setOnFailed(e -> System.err.println("EncounterView.onRequestCombat(): " + task.getException().getMessage()));
        Thread t = new Thread(task, "sm-combat-setup");
        t.setDaemon(true);
        t.start();
    }

    private void startCombat(List<Combatant> combatants) {
        trackerPane = new CombatTrackerPane();
        // Cross-view callbacks: injected by SaltMarcherApp, may be null — null-guard required
        trackerPane.setOnRequestStatBlock(id -> { if (onRequestStatBlock != null) onRequestStatBlock.accept(id); });
        trackerPane.setOnEnsureStatBlock(id -> { if (onEnsureStatBlock != null) onEnsureStatBlock.accept(id); });
        // Internal callbacks: always set before combat starts — direct method reference
        trackerPane.setOnCombatStateChanged(this::updateCombatStatus);
        trackerPane.setOnEndCombat(this::onEndCombat);
        trackerPane.startCombat(combatants);

        switchMode(Mode.COMBAT);
        updateCombatStatus();
    }

    private void onEndCombat() {
        trackerPane = null;
        switchMode(Mode.BUILDER);
    }

    private void updateCombatStatus() {
        if (trackerPane == null) return;
        int alive = 0, total = 0;
        for (Combatant cs : trackerPane.getCombatants()) {
            if (cs instanceof MonsterCombatant) { total++; if (cs.isAlive()) alive++; }
        }
        XpCalculator.DifficultyStats ds = CombatSetup.computeLiveStats(
                trackerPane.getCombatants(), Math.max(1, partyCache.size()), cachedAvgLevel);
        trackerPane.updateStatusBar(ds, alive, total, trackerPane.getRound());
        trackerPane.signalAllEnemiesDead(alive == 0 && total > 0);
    }

    // ---- Helpers ----

    private void onRosterChanged() {
        List<EncounterSlot> slots = rosterPane.getSlots();
        boolean hasData = !slots.isEmpty() && !partyCache.isEmpty();
        if (hasData) {
            rosterPane.updateSummary(XpCalculator.computeStatsFromSlots(slots, partyCache.size(), cachedAvgLevel));
        } else {
            rosterPane.updateSummary(null);
        }
        rosterPane.setStartCombatEnabled(rosterPane.hasSlots());
    }

    private static <T> List<T> nullIfEmpty(List<T> list) {
        return list.isEmpty() ? null : list;
    }

    private boolean ensurePartyExists() {
        if (partyCache.isEmpty()) {
            new Alert(Alert.AlertType.WARNING,
                    "Die Party hat keine Mitglieder.\nBitte zuerst Charaktere hinzuf\u00fcgen.")
                    .showAndWait();
            return false;
        }
        return true;
    }
}
