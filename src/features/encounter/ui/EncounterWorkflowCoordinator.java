package features.encounter.ui;

import features.creaturecatalog.model.Creature;
import features.creaturecatalog.service.CreatureService;
import features.encounter.model.Combatant;
import features.encounter.model.Encounter;
import features.encounter.model.EncounterSlot;
import features.encounter.service.EncounterService;
import features.encounter.service.combat.CombatSession;
import features.encounter.service.generation.EncounterGenerator;
import features.encounter.ui.builder.EncounterControls;
import features.encounter.ui.builder.EncounterRosterPane;
import features.encounter.ui.combat.CombatResultsPane;
import features.encounter.ui.combat.CombatTrackerPane;
import features.encounter.ui.combat.InitiativePane;
import features.encountertable.model.EncounterTable;
import features.gamerules.service.XpCalculator;
import features.party.model.PlayerCharacter;
import javafx.concurrent.Task;
import javafx.event.EventHandler;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;
import javafx.scene.control.TextInputControl;
import javafx.scene.input.KeyEvent;
import ui.shell.SceneHandle;
import ui.components.statblock.StatBlockRequest;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;
import features.creaturepicker.ui.MonsterListPane;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

final class EncounterWorkflowCoordinator {

    enum Mode { BUILDER, COMBAT }

    private final Runnable onRefreshToolbar;
    private final Runnable onRefreshPanels;
    private final Consumer<StatBlockRequest> onRequestStatBlock;
    private Consumer<StatBlockRequest> onEnsureStatBlock;

    private final SceneHandle encounterScene;
    private final MonsterListPane monsterList;
    private final EncounterService encounterService;
    private final EncounterControls encounterControls;
    private final EncounterRosterPane rosterPane;

    private CombatTrackerPane trackerPane;

    private List<PlayerCharacter> partyCache = new ArrayList<>();
    private int cachedAvgLevel = 1;
    private Mode currentMode = Mode.BUILDER;
    private Scene scene;
    private Task<?> partyLoadTask;
    private Task<EncounterService.TableCatalogResult> tableLoadTask;
    private Task<EncounterGenerator.GenerationResult> generationTask;
    private Task<EncounterService.CombatStartResult> combatPreparationTask;
    private final EventHandler<KeyEvent> combatKeyHandler = this::handleSceneCombatKey;
    private boolean initialLoadDone = false;

    EncounterWorkflowCoordinator(
            EncounterViewCallbacks callbacks,
            SceneHandle encounterScene,
            MonsterListPane monsterList,
            EncounterControls encounterControls,
            EncounterRosterPane rosterPane
    ) {
        this.onRefreshToolbar = callbacks.onRefreshToolbar();
        this.onRefreshPanels = callbacks.onRefreshPanels();
        this.onRequestStatBlock = callbacks.onRequestStatBlock();
        this.encounterService = Objects.requireNonNull(callbacks.encounterService(), "encounterService");
        this.encounterScene = Objects.requireNonNull(encounterScene, "encounterScene");
        this.monsterList = Objects.requireNonNull(monsterList, "monsterList");
        this.encounterControls = Objects.requireNonNull(encounterControls, "encounterControls");
        this.rosterPane = Objects.requireNonNull(rosterPane, "rosterPane");
    }

    void setOnEnsureStatBlock(Consumer<StatBlockRequest> callback) {
        this.onEnsureStatBlock = callback;
    }

    String getTitle() {
        return currentMode == Mode.COMBAT ? "Encounter Runner" : "Encounter Builder";
    }

    void setFilterData(CreatureService.FilterOptions data) {
        encounterControls.setFilterData(data);
        encounterControls.setOnFilterChanged(monsterList::applyFilters);
        encounterControls.setOnTableChanged(monsterList::setTableIds);
    }

    void setTableList(List<EncounterTable> tables) {
        encounterControls.setTableList(tables);
    }

    void onSceneChanged(Scene oldScene, Scene newScene) {
        if (newScene == null && oldScene != null && currentMode == Mode.COMBAT) {
            oldScene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
        }
        scene = newScene;
        if (scene != null) {
            syncCombatKeyHandler();
        }
    }

    void onShow() {
        refreshPartyState();
        refreshTableState();
        if (!initialLoadDone) {
            monsterList.loadInitial();
            initialLoadDone = true;
        }
        syncCombatKeyHandler();
        encounterScene.setContent(currentMode == Mode.COMBAT && trackerPane != null ? trackerPane : rosterPane);
        encounterScene.activate();
    }

    void onHide() {
        if (scene != null) {
            scene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
        }
        cancelPendingTasks();
    }

    void onAddCreature(Creature creature) {
        if (currentMode == Mode.COMBAT && trackerPane != null) {
            trackerPane.addReinforcement(creature);
            updateCombatStatus();
        } else {
            rosterPane.addCreature(creature, encounterService.classifyRole(creature));
        }
    }

    void onGenerate() {
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
            @Override
            protected EncounterGenerator.GenerationResult call() {
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
                case SUCCESS -> {
                    rosterPane.setEncounter(result.encounter());
                    showGenerationAdvisory(result.advisory());
                }
                case BLOCKED_BY_USER_INPUT, NO_SOLUTION, TIMEOUT ->
                        rosterPane.showGenerationFailed(mapGenerationFailure(result.failureReason()));
            }
        }, () -> {
            rosterPane.setGenerateEnabled(true);
            rosterPane.showGenerationFailed();
        }, () -> generationTask == task);
    }

    void onRequestCombat() {
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
            Task<EncounterService.CombatStartResult> task = new Task<>() {
                @Override
                protected EncounterService.CombatStartResult call() {
                    return encounterService.prepareCombatants(new EncounterService.CombatStartRequest(
                            partyCopy,
                            pcInitiatives,
                            encounter,
                            monsterInitiatives
                    ));
                }
            };
            combatPreparationTask = task;
            submitTask(task, "EncounterView.onRequestCombat()", this::handleCombatStartResult,
                    () -> combatPreparationTask == task);
        });
        encounterScene.setContent(initiativePane);
    }

    void onRosterChanged() {
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

    void refreshPartyStateFromExternal() {
        refreshPartyState();
    }

    private void refreshPartyState() {
        cancelTask(partyLoadTask);
        rosterPane.setGenerateEnabled(false);
        rosterPane.setStartCombatEnabled(false);
        Task<EncounterService.PartySnapshot> task = new Task<>() {
            @Override
            protected EncounterService.PartySnapshot call() {
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
            rosterPane.setStartCombatEnabled(rosterPane.hasSlots());
        }, () -> {
            rosterPane.setGenerateEnabled(true);
            rosterPane.setStartCombatEnabled(rosterPane.hasSlots());
        }, () -> partyLoadTask == task);
    }

    private void refreshTableState() {
        cancelTask(tableLoadTask);
        Task<EncounterService.TableCatalogResult> task = new Task<>() {
            @Override
            protected EncounterService.TableCatalogResult call() {
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
        }, () -> tableLoadTask == task);
    }

    private void startCombat(List<Combatant> combatants) {
        trackerPane = new CombatTrackerPane();
        trackerPane.setOnRequestStatBlock(onRequestStatBlock);
        trackerPane.setOnEnsureStatBlock(onEnsureStatBlock);
        trackerPane.setOnCombatStateChanged(this::updateCombatStatus);
        trackerPane.setOnEndCombat(this::onEndCombat);
        trackerPane.startCombat(combatants);

        switchMode(Mode.COMBAT);
        updateCombatStatus();
    }

    private void handleCombatStartResult(EncounterService.CombatStartResult result) {
        if (result == null) {
            Alert alert = new Alert(Alert.AlertType.ERROR, "Kampfstart fehlgeschlagen.");
            alert.setTitle("Encounter Builder");
            alert.setHeaderText("Ung\u00fcltige Kampfdaten");
            alert.showAndWait();
            return;
        }
        if (result.status() == EncounterService.CombatStartStatus.SUCCESS) {
            startCombat(result.combatants());
            return;
        }
        Alert alert = new Alert(Alert.AlertType.ERROR, mapCombatStartFailure(result.failureReason()));
        alert.setTitle("Encounter Builder");
        alert.setHeaderText("Ung\u00fcltige Kampfdaten");
        alert.showAndWait();
    }

    private void onEndCombat() {
        if (trackerPane == null) {
            return;
        }
        List<CombatSession.EnemyOutcome> outcomes = trackerPane.getEnemyOutcomes();
        trackerPane = null;
        switchMode(Mode.BUILDER);
        CombatResultsPane resultsPane = new CombatResultsPane(encounterService, outcomes, partyCache);
        resultsPane.setOnDone(() -> encounterScene.setContent(rosterPane));
        encounterScene.setContent(resultsPane);
    }

    private void updateCombatStatus() {
        if (trackerPane == null) return;
        CombatSession.EnemyTotals totals = trackerPane.getEnemyTotals();
        XpCalculator.DifficultyStats ds = encounterService.computeLiveDifficultyStats(
                trackerPane.getCombatants(), Math.max(1, partyCache.size()), cachedAvgLevel);
        trackerPane.updateStatusBar(ds, totals.alive(), totals.total(), trackerPane.getRound());
        trackerPane.signalAllEnemiesDead(totals.alive() == 0 && totals.total() > 0);
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

    private void switchMode(Mode mode) {
        Mode oldMode = currentMode;
        currentMode = mode;
        monsterList.setCombatMode(mode == Mode.COMBAT);
        encounterControls.setCombatMode(mode == Mode.COMBAT);

        if (mode != oldMode) {
            syncCombatKeyHandler();
        }

        encounterScene.setContent(mode == Mode.COMBAT ? trackerPane : rosterPane);
        onRefreshToolbar.run();
        onRefreshPanels.run();
    }

    private void handleSceneCombatKey(KeyEvent e) {
        if (currentMode != Mode.COMBAT) return;
        if (e.getTarget() instanceof TextInputControl) return;
        if (e.getTarget() instanceof javafx.scene.control.Button) return;
        if (trackerPane != null && trackerPane.handleCombatKey(e)) {
            e.consume();
        }
    }

    private void syncCombatKeyHandler() {
        if (scene == null) return;
        scene.removeEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
        if (currentMode == Mode.COMBAT) {
            scene.addEventFilter(KeyEvent.KEY_PRESSED, combatKeyHandler);
        }
    }

    private String mapGenerationFailure(EncounterGenerator.GenerationFailureReason reason) {
        if (reason == null) {
            return "Generierung fehlgeschlagen. Nochmal versuchen.";
        }
        return switch (reason) {
            case TABLE_CANDIDATES_STORAGE_ERROR ->
                    "Datenbankfehler: Tabellen-Kandidaten konnten nicht geladen werden.";
            case SETTINGS_COMBINATION_INFEASIBLE ->
                    "Kombination der gesetzten Einstellungen ist nicht machbar. Auto aktivieren oder Werte lockern.";
            case AUTO_CONFIG_NO_SOLUTION ->
                    "Keine machbare Auto-Kombination gefunden.";
            case AMOUNT_GROUPS_CONFLICT ->
                    "Menge und Gruppen passen nicht zusammen (Slots erlauben nur begrenzte Kreaturenzahl).";
            case SLOT_DISTRIBUTION_INVALID ->
                    "Unmögliche Kombination: Gruppen + Kreaturenzahl ergeben mit Mob-Regeln keine gültige Slot-Verteilung.";
            case TIMEOUT ->
                    "Zeitlimit erreicht. Einstellungen lockern oder Auto verwenden.";
        };
    }

    private void showGenerationAdvisory(EncounterGenerator.GenerationAdvisory advisory) {
        if (advisory == null) {
            return;
        }
        Alert alert = new Alert(Alert.AlertType.INFORMATION, mapGenerationAdvisory(advisory), ButtonType.OK);
        alert.setTitle("Encounter Builder");
        alert.setHeaderText("Encounter mit Fallback generiert");
        alert.show();
    }

    private String mapGenerationAdvisory(EncounterGenerator.GenerationAdvisory advisory) {
        return switch (advisory) {
            case PARTY_ROLE_FALLBACK_CACHE_REBUILDING ->
                    "Party-abhängige Rollen waren noch nicht bereit. Das Encounter wurde mit statischen Rollen generiert; der Cache wird im Hintergrund neu aufgebaut.";
            case PARTY_ROLE_FALLBACK_STORAGE_UNAVAILABLE ->
                    "Party-abhängige Rollen konnten wegen eines Speicherproblems nicht geladen werden. Das Encounter wurde mit statischen Rollen generiert.";
        };
    }

    private String mapCombatStartFailure(EncounterService.CombatStartFailureReason reason) {
        if (reason == null) {
            return "Kampfstart fehlgeschlagen. Eingaben pr\u00fcfen und erneut versuchen.";
        }
        return switch (reason) {
            case REQUEST_MISSING ->
                    "Kampfanfrage ist unvollst\u00e4ndig.";
            case PARTY_MISSING ->
                    "Die Party-Daten fehlen. Ansicht neu laden und erneut versuchen.";
            case PC_INITIATIVES_MISSING ->
                    "Initiativewerte der Spieler fehlen.";
            case ENCOUNTER_MISSING ->
                    "Encounter-Daten fehlen.";
            case ENCOUNTER_SLOTS_INVALID ->
                    "Encounter-Slots enthalten ung\u00fcltige Daten.";
            case PARTY_MEMBER_MISSING ->
                    "Mindestens ein Party-Mitglied ist ung\u00fcltig.";
            case PC_INITIATIVE_VALUE_MISSING ->
                    "Mindestens ein Initiativewert der Spieler ist leer.";
            case PC_INITIATIVE_COUNT_MISMATCH ->
                    "Anzahl der Spieler und Initiativewerte passt nicht zusammen.";
        };
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

    private <T> void submitTask(
            Task<T> task,
            String failureContext,
            Consumer<T> onSuccess,
            BooleanSupplier isTaskActive
    ) {
        submitTask(task, failureContext, onSuccess, null, isTaskActive);
    }

    private <T> void submitTask(
            Task<T> task,
            String failureContext,
            Consumer<T> onSuccess,
            Runnable onFailure,
            BooleanSupplier isTaskActive
    ) {
        UiAsyncTasks.submit(
                task,
                result -> {
                    if (task.isCancelled() || !isTaskActive.getAsBoolean()) {
                        return;
                    }
                    onSuccess.accept(result);
                },
                throwable -> {
                    if (!task.isCancelled() && isTaskActive.getAsBoolean()) {
                        UiErrorReporter.reportBackgroundFailure(failureContext, throwable);
                        if (onFailure != null) {
                            onFailure.run();
                        }
                    }
                },
                () -> {
                    if (isTaskActive.getAsBoolean() && onFailure != null) {
                        onFailure.run();
                    }
                });
    }
}
