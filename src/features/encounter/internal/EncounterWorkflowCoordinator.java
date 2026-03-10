package features.encounter.internal;

import features.encounter.ui.EncounterViewCallbacks;
import features.encounter.builder.application.EncounterBuilderService;
import features.encounter.builder.ui.BuilderWorkflowController;
import features.encounter.builder.ui.EncounterControls;
import features.encounter.builder.ui.EncounterRosterPane;
import features.encounter.combat.ui.CombatWorkflowController;
import features.creatures.api.CreatureCatalogService;
import features.creatures.model.Creature;
import features.encountertable.model.EncounterTable;
import javafx.scene.Scene;
import features.creatures.api.CreatureBrowserPane;
import features.creatures.api.StatBlockRequest;
import ui.shell.SceneHandle;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public final class EncounterWorkflowCoordinator {

    enum Mode { BUILDER, COMBAT }

    private final Runnable onRefreshToolbar;
    private final Runnable onRefreshPanels;
    private final Consumer<StatBlockRequest> onRequestStatBlock;

    private final EncounterBuilderService builderService;
    private final SceneHandle encounterScene;
    private final CreatureBrowserPane monsterList;
    private final EncounterControls encounterControls;
    private final EncounterRosterPane rosterPane;
    private final BuilderWorkflowController builderWorkflowController;
    private final CombatWorkflowController combatWorkflowController;
    private Mode currentMode = Mode.BUILDER;
    private boolean initialLoadDone = false;

    public EncounterWorkflowCoordinator(
            EncounterViewCallbacks callbacks,
            SceneHandle encounterScene,
            CreatureBrowserPane monsterList,
            EncounterControls encounterControls,
            EncounterRosterPane rosterPane
    ) {
        this.onRefreshToolbar = callbacks.onRefreshToolbar();
        this.onRefreshPanels = callbacks.onRefreshPanels();
        this.onRequestStatBlock = callbacks.onRequestStatBlock();
        this.builderService = Objects.requireNonNull(callbacks.builderService(), "builderService");
        this.encounterScene = Objects.requireNonNull(encounterScene, "encounterScene");
        this.monsterList = Objects.requireNonNull(monsterList, "monsterList");
        this.encounterControls = Objects.requireNonNull(encounterControls, "encounterControls");
        this.rosterPane = Objects.requireNonNull(rosterPane, "rosterPane");
        CombatWorkflowController combatWorkflowController = new CombatWorkflowController(
                callbacks.combatService(),
                encounterScene,
                rosterPane,
                () -> switchMode(Mode.COMBAT),
                () -> switchMode(Mode.BUILDER),
                onRequestStatBlock
        );
        this.combatWorkflowController = combatWorkflowController;
        this.builderWorkflowController = new BuilderWorkflowController(
                builderService,
                encounterControls,
                rosterPane,
                encounterScene,
                encounterControls::buildCriteria,
                encounterScene::setContent,
                combatWorkflowController
        );
    }

    public void setOnEnsureStatBlock(Consumer<StatBlockRequest> callback) {
        combatWorkflowController.setOnEnsureStatBlock(callback);
    }

    public String getTitle() {
        return currentMode == Mode.COMBAT ? "Encounter Runner" : "Encounter Builder";
    }

    public void setFilterData(CreatureCatalogService.FilterOptions data) {
        builderWorkflowController.setFilterData(data);
        monsterList.applyFilters(encounterControls.buildCriteria());
    }

    public void setTableList(List<EncounterTable> tables) {
        builderWorkflowController.setTableList(tables);
    }

    public void onSceneChanged(Scene oldScene, Scene newScene) {
        combatWorkflowController.onSceneChanged(oldScene, newScene, currentMode == Mode.COMBAT);
    }

    public void onShow() {
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

    public void onHide() {
        combatWorkflowController.onHide();
        builderWorkflowController.cancelPendingTasks();
    }

    public void onAddCreature(Creature creature) {
        if (currentMode == Mode.COMBAT && combatWorkflowController.getTrackerPane() != null) {
            combatWorkflowController.addReinforcement(creature);
        } else {
            builderWorkflowController.addCreature(creature, builderService.classifyRoleProfile(creature));
        }
    }

    public void onGenerate() {
        builderWorkflowController.onGenerate();
    }

    public void onRequestCombat() {
        builderWorkflowController.onRequestCombat();
    }

    public void onRosterChanged() {
        builderWorkflowController.onRosterChanged();
    }

    public void refreshPartyStateFromExternal() {
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
