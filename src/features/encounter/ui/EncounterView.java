package features.encounter.ui;

import features.encounter.model.Combatant;
import features.creaturecatalog.model.Creature;
import features.encountertable.model.EncounterTable;
import features.party.model.PlayerCharacter;
import ui.AppView;
import ui.UiAsyncExecutor;
import ui.UiErrorReporter;
import ui.SceneHandle;
import javafx.concurrent.Task;
import javafx.event.EventHandler;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.control.TextInputControl;
import javafx.scene.input.KeyEvent;
import features.creaturecatalog.service.CreatureService;
import ui.components.creature.MonsterListPane;
import features.encounter.ui.builder.EncounterControls;
import features.encounter.ui.builder.EncounterRosterPane;
import features.encounter.ui.combat.CombatResultsPane;
import features.encounter.ui.combat.CombatTrackerPane;
import features.encounter.ui.combat.InitiativePane;
import features.encounter.service.EncounterService;
import features.gamerules.service.XpCalculator;
import features.encounter.service.combat.CombatSession;
import features.encounter.service.generation.EncounterGenerator;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterSlot;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Encounter workflow view: orchestrates builder and combat modes.
 * Builder mode shows the monster browser + roster; combat mode shows the turn tracker.
 */
public class EncounterView implements AppView {

    enum Mode { BUILDER, COMBAT }

    private final Runnable onRefreshToolbar;
    private final Runnable onRefreshPanels;
    private final Consumer<Long> onRequestStatBlock;
    private Consumer<Long> onEnsureStatBlock;
    private final SceneHandle encounterScene;
    private final MonsterListPane monsterList;
    private final EncounterService encounterService;

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
    private Task<EncounterService.TableCatalogResult> tableLoadTask;
    private Task<EncounterGenerator.GenerationResult> generationTask;
    private Task<List<Combatant>> combatPreparationTask;
    private final EventHandler<KeyEvent> combatKeyHandler = this::handleSceneCombatKey;
    private boolean initialLoadDone = false;

    public EncounterView(EncounterViewCallbacks callbacks) {
        this.onRefreshToolbar = callbacks.onRefreshToolbar();
        this.onRefreshPanels = callbacks.onRefreshPanels();
        this.onRequestStatBlock = callbacks.onRequestStatBlock();
        monsterList = new MonsterListPane();
        encounterService = new EncounterService();
        encounterControls = new EncounterControls(encounterService);
        rosterPane = new EncounterRosterPane(encounterService);
        this.encounterScene = callbacks.sceneRegistry().registerScene("⚔ Encounter", rosterPane);

        // Track scene availability automatically — eliminates the need for setScene(Scene).
        monsterList.sceneProperty().addListener((obs, oldScene, newScene) -> {
            if (newScene == null && oldScene != null && currentMode == Mode.COMBAT) {
                oldScene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
            }
            scene = newScene;
            if (scene != null) {
                syncCombatKeyHandler();
            }
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
        encounterControls.setOnTableChanged(monsterList::setTableIds);
    }

    /** Populates the encounter table selector in the controls panel. */
    public void setTableList(List<EncounterTable> tables) {
        encounterControls.setTableList(tables);
    }

    // ---- AppView interface ----

    @Override public Node getMainContent() { return monsterList; }

    @Override public String getTitle() {
        return currentMode == Mode.COMBAT ? "Encounter Runner" : "Encounter Builder";
    }

    @Override public String getIconText() { return "\u2694"; }

    @Override
    public Node getControlsContent() { return encounterControls; }

    @Override
    public void onShow() {
        refreshPartyState();
        refreshTableState();
        if (!initialLoadDone) {
            monsterList.loadInitial();
            initialLoadDone = true;
        }
        syncCombatKeyHandler();
        // Ensure the encounter tab shows the right content and is active
        encounterScene.setContent(currentMode == Mode.COMBAT && trackerPane != null ? trackerPane : rosterPane);
        encounterScene.activate();
    }

    @Override
    public void onHide() {
        if (scene != null) {
            scene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
        }
        cancelPendingTasks();
    }

    // ---- Mode switching ----

    private void switchMode(Mode mode) {
        Mode oldMode = currentMode;
        currentMode = mode;
        monsterList.setCombatMode(mode == Mode.COMBAT);
        encounterControls.setCombatMode(mode == Mode.COMBAT);

        if (mode != oldMode) {
            syncCombatKeyHandler();
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
        cancelTask(partyLoadTask);
        rosterPane.setGenerateEnabled(false);
        rosterPane.setStartCombatEnabled(false);
        Task<EncounterService.PartySnapshot> task = new Task<>() {
            @Override protected EncounterService.PartySnapshot call() {
                return encounterService.loadPartySnapshot();
            }
        };
        partyLoadTask = task;
        submitTask(task, "EncounterView.refreshPartyState()", snapshot -> {
            partyCache = snapshot.party();
            int size = partyCache.size();
            if (size > 0) {
                cachedAvgLevel = snapshot.avgLevel();
                rosterPane.setPartyInfo(size, cachedAvgLevel);
                encounterControls.setPartyContext(size, cachedAvgLevel);
            } else {
                cachedAvgLevel = 1;
                rosterPane.setPartyInfo(0, 1);
                encounterControls.setPartyContext(1, 1);
            }
            rosterPane.setGenerateEnabled(true);
            // "Kampf starten" stays disabled until roster has slots
            rosterPane.setStartCombatEnabled(rosterPane.hasSlots());
        });
    }

    private void refreshTableState() {
        cancelTask(tableLoadTask);
        Task<EncounterService.TableCatalogResult> task = new Task<>() {
            @Override protected EncounterService.TableCatalogResult call() {
                return encounterService.loadEncounterTables();
            }
        };
        tableLoadTask = task;
        submitTask(task, "EncounterView.refreshTableState()", result -> {
            if (result.status() == EncounterService.TableLoadStatus.SUCCESS) {
                encounterControls.setTableList(result.tables());
            } else {
                encounterControls.setTableList(List.of());
                Alert alert = new Alert(Alert.AlertType.ERROR,
                        "Encounter-Tabellen konnten nicht geladen werden.");
                alert.setTitle("Encounter Builder");
                alert.setHeaderText("Datenbankzugriff fehlgeschlagen");
                alert.showAndWait();
            }
        });
    }

    // ---- Actions ----

    private void onAddCreature(Creature creature) {
        if (currentMode == Mode.COMBAT && trackerPane != null) {
            trackerPane.addReinforcement(creature);
            updateCombatStatus();
        } else {
            rosterPane.addCreature(creature, encounterService.classifyRole(creature));
        }
    }

    // ---- Encounter Generation ----

    private void onGenerate() {
        if (!ensurePartyExists()) return;
        cancelTask(generationTask);

        int partySize = partyCache.size();
        int avgLevel = cachedAvgLevel;

        CreatureService.FilterCriteria criteria = encounterControls.buildCriteria();

        double difficulty = encounterControls.getSelectedDifficulty();
        int groupsLevel = encounterControls.getSelectedGroupsLevel();
        int balanceLevel = encounterControls.getSelectedBalanceLevel();
        double amountValue = encounterControls.getSelectedAmountValue();

        rosterPane.showGenerating();
        rosterPane.setGenerateEnabled(false);

        List<Long> tableIds = encounterControls.getSelectedTableIds();

        Task<EncounterGenerator.GenerationResult> task = new Task<>() {
            @Override protected EncounterGenerator.GenerationResult call() {
                return encounterService.generateEncounter(new EncounterService.GenerationRequest(
                        partySize,
                        avgLevel,
                        new EncounterService.EncounterFilter(
                                criteria.types(),
                                criteria.subtypes(),
                                criteria.biomes()
                        ),
                        difficulty,
                        groupsLevel,
                        balanceLevel,
                        amountValue,
                        tableIds
                ));
            }
        };
        generationTask = task;
        submitTask(task, "EncounterView.onGenerate()", result -> {
            rosterPane.setGenerateEnabled(true);
            if (result == null) {
                rosterPane.showGenerationFailed();
                return;
            }
            switch (result.status()) {
                case SUCCESS -> rosterPane.setEncounter(result.encounter());
                case BLOCKED_BY_USER_INPUT, NO_SOLUTION, TIMEOUT -> rosterPane.showGenerationFailed(result.message());
            }
        }, () -> {
            rosterPane.setGenerateEnabled(true);
            rosterPane.showGenerationFailed();
        });
    }

    // ---- Combat start ----

    private void onRequestCombat() {
        if (!rosterPane.hasSlots()) return;
        if (!ensurePartyExists()) return;

        Encounter encounter = rosterPane.buildEncounter();
        List<PlayerCharacter> partyCopy = List.copyOf(partyCache);

        InitiativePane initiativePane = new InitiativePane(partyCopy, encounter.slots());
        initiativePane.setOnCancel(() -> encounterScene.setContent(rosterPane));
        initiativePane.setOnConfirm(result -> {
            List<Integer> pcInitiatives = result.pcInitiatives();
            List<Integer> monsterInitiatives = result.monsterInitiatives();
            cancelTask(combatPreparationTask);
            Task<List<Combatant>> task = new Task<>() {
                @Override
                protected List<Combatant> call() {
                    return encounterService.prepareCombatants(new EncounterService.CombatStartRequest(
                            partyCopy,
                            pcInitiatives,
                            encounter,
                            monsterInitiatives
                    ));
                }
            };
            combatPreparationTask = task;
            submitTask(task, "EncounterView.onRequestCombat()", this::startCombat);
        });
        encounterScene.setContent(initiativePane);
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
        List<CombatSession.EnemyOutcome> outcomes = trackerPane.getEnemyOutcomes();
        trackerPane = null;
        switchMode(Mode.BUILDER);  // removes keyboard handler, resets toolbar/panels
        CombatResultsPane resultsPane = new CombatResultsPane(encounterService, outcomes, partyCache);
        resultsPane.setOnDone(() -> encounterScene.setContent(rosterPane));
        encounterScene.setContent(resultsPane);  // override rosterPane until GM dismisses
    }

    private void updateCombatStatus() {
        if (trackerPane == null) return;
        CombatSession.EnemyTotals totals = trackerPane.getEnemyTotals();
        XpCalculator.DifficultyStats ds = encounterService.computeLiveDifficultyStats(
                trackerPane.getCombatants(), Math.max(1, partyCache.size()), cachedAvgLevel);
        trackerPane.updateStatusBar(ds, totals.alive(), totals.total(), trackerPane.getRound());
        trackerPane.signalAllEnemiesDead(totals.alive() == 0 && totals.total() > 0);
    }

    // ---- Helpers ----

    private void onRosterChanged() {
        List<EncounterSlot> slots = rosterPane.getSlots();
        boolean hasData = !slots.isEmpty() && !partyCache.isEmpty();
        if (hasData) {
            rosterPane.updateSummary(encounterService.computeRosterDifficultyStats(
                    slots, partyCache.size(), cachedAvgLevel));
        } else {
            rosterPane.updateSummary(null);
        }
        rosterPane.setStartCombatEnabled(rosterPane.hasSlots());
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

    private void syncCombatKeyHandler() {
        if (scene == null) return;
        scene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
        if (currentMode == Mode.COMBAT) {
            scene.addEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
        }
    }

    private void cancelPendingTasks() {
        cancelTask(partyLoadTask);
        cancelTask(tableLoadTask);
        cancelTask(generationTask);
        cancelTask(combatPreparationTask);
    }

    private void cancelTask(Task<?> task) {
        if (task != null && task.isRunning()) {
            task.cancel();
        }
    }

    private <T> void submitTask(Task<T> task, String failureContext, Consumer<T> onSuccess) {
        submitTask(task, failureContext, onSuccess, null);
    }

    private <T> void submitTask(
            Task<T> task,
            String failureContext,
            Consumer<T> onSuccess,
            Runnable onFailure
    ) {
        task.setOnSucceeded(e -> onSuccess.accept(task.getValue()));
        task.setOnFailed(e -> {
            if (!task.isCancelled()) {
                UiErrorReporter.reportBackgroundFailure(failureContext, task.getException());
                if (onFailure != null) {
                    onFailure.run();
                }
            }
        });
        UiAsyncExecutor.submit(task);
    }
}
