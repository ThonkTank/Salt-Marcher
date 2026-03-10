package features.encounter.ui;

import features.creaturecatalog.model.Creature;
import features.creaturecatalog.service.CreatureService;
import features.encounter.application.EncounterApplicationService;
import features.encounter.ui.builder.EncounterControls;
import features.encounter.ui.builder.EncounterRosterPane;
import features.encountertable.model.EncounterTable;
import javafx.scene.Scene;
import ui.shell.SceneHandle;
import ui.components.statblock.StatBlockRequest;
import features.creaturepicker.ui.MonsterListPane;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

final class EncounterWorkflowCoordinator {

    enum Mode { BUILDER, COMBAT }

    private final Runnable onRefreshToolbar;
    private final Runnable onRefreshPanels;
    private final Consumer<StatBlockRequest> onRequestStatBlock;

    private final EncounterApplicationService encounterService;
    private final SceneHandle encounterScene;
    private final MonsterListPane monsterList;
    private final EncounterControls encounterControls;
    private final EncounterRosterPane rosterPane;
    private final BuilderWorkflowController builderWorkflowController;
    private final CombatWorkflowController combatWorkflowController;
    private Mode currentMode = Mode.BUILDER;
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
        CombatWorkflowController combatWorkflowController = new CombatWorkflowController(
                encounterService,
                encounterScene,
                rosterPane,
                () -> switchMode(Mode.COMBAT),
                () -> switchMode(Mode.BUILDER),
                onRequestStatBlock
        );
        this.combatWorkflowController = combatWorkflowController;
        this.builderWorkflowController = new BuilderWorkflowController(
                encounterService,
                encounterControls,
                rosterPane,
                encounterScene,
                encounterControls::buildCriteria,
                encounterScene::setContent,
                combatWorkflowController
        );
    }

    void setOnEnsureStatBlock(Consumer<StatBlockRequest> callback) {
        combatWorkflowController.setOnEnsureStatBlock(callback);
    }

    String getTitle() {
        return currentMode == Mode.COMBAT ? "Encounter Runner" : "Encounter Builder";
    }

    void setFilterData(CreatureService.FilterOptions data) {
        builderWorkflowController.setFilterData(data);
        monsterList.applyFilters(encounterControls.buildCriteria());
    }

    void setTableList(List<EncounterTable> tables) {
        builderWorkflowController.setTableList(tables);
    }

    void onSceneChanged(Scene oldScene, Scene newScene) {
        combatWorkflowController.onSceneChanged(oldScene, newScene, currentMode == Mode.COMBAT);
    }

    void onShow() {
        builderWorkflowController.refreshState();
        if (!initialLoadDone) {
            monsterList.loadInitial();
            initialLoadDone = true;
        }
        combatWorkflowController.syncCombatKeyHandler(currentMode == Mode.COMBAT);
        encounterScene.setContent(currentMode == Mode.COMBAT && combatWorkflowController.getTrackerPane() != null
                ? combatWorkflowController.getTrackerPane()
                : rosterPane);
        encounterScene.activate();
    }

    void onHide() {
        combatWorkflowController.onHide();
        builderWorkflowController.cancelPendingTasks();
    }

    void onAddCreature(Creature creature) {
        if (currentMode == Mode.COMBAT && combatWorkflowController.getTrackerPane() != null) {
            combatWorkflowController.addReinforcement(creature);
        } else {
            builderWorkflowController.addCreature(creature, encounterService.classifyRole(creature));
        }
    }

    void onGenerate() {
        builderWorkflowController.onGenerate();
    }

    void onRequestCombat() {
        builderWorkflowController.onRequestCombat();
    }

    void onRosterChanged() {
        builderWorkflowController.onRosterChanged();
    }

    void refreshPartyStateFromExternal() {
        builderWorkflowController.refreshState();
    }

    private void switchMode(Mode mode) {
        Mode oldMode = currentMode;
        currentMode = mode;
        monsterList.setCombatMode(mode == Mode.COMBAT);
        encounterControls.setCombatMode(mode == Mode.COMBAT);

        if (mode != oldMode) {
            combatWorkflowController.syncCombatKeyHandler(mode == Mode.COMBAT);
        }

        encounterScene.setContent(mode == Mode.COMBAT ? combatWorkflowController.getTrackerPane() : rosterPane);
        onRefreshToolbar.run();
        onRefreshPanels.run();
    }
}
