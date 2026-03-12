package features.encounter.ui;

import features.encounter.builder.ui.EncounterControls;
import features.encounter.builder.ui.EncounterRosterPane;
import features.encounter.internal.EncounterWorkflowCoordinator;
import features.encountertable.model.EncounterTable;
import features.creatures.api.CreatureBrowserPane;
import features.creatures.api.CreatureCatalogService;
import features.creatures.api.StatBlockRequest;
import javafx.scene.Node;
import ui.shell.AppView;
import ui.shell.SceneHandle;

import java.util.List;

/**
 * Encounter workflow view: orchestrates builder and combat modes.
 * Builder mode shows the creature browser + roster; combat mode shows the turn tracker.
 */
public class EncounterView implements AppView {

    private final CreatureBrowserPane monsterList;
    private final EncounterControls encounterControls;
    private final EncounterWorkflowCoordinator workflow;

    public EncounterView(EncounterViewCallbacks callbacks) {
        monsterList = new CreatureBrowserPane();
        encounterControls = new EncounterControls(callbacks.builderService());
        EncounterRosterPane rosterPane = new EncounterRosterPane(callbacks.builderService());
        SceneHandle encounterScene = callbacks.sceneRegistry().registerScene("⚔ Encounter", rosterPane);

        workflow = new EncounterWorkflowCoordinator(
                callbacks,
                encounterScene,
                monsterList,
                encounterControls,
                rosterPane
        );

        monsterList.sceneProperty().addListener((obs, oldScene, newScene) ->
                workflow.onSceneChanged(oldScene, newScene));

        monsterList.setOnAddCreature(workflow::onAddCreature);
        monsterList.setOnRequestStatBlock(id -> callbacks.detailsNavigator().showStatBlock(StatBlockRequest.forCreature(id)));

        rosterPane.setOnGenerate(workflow::onGenerate);
        rosterPane.setOnStartCombat(workflow::onRequestCombat);
        rosterPane.setOnRosterChanged(workflow::onRosterChanged);
        rosterPane.setOnRequestStatBlock(id -> callbacks.detailsNavigator().showStatBlock(StatBlockRequest.forCreature(id)));
    }

    public void setFilterData(CreatureCatalogService.FilterOptions data) {
        workflow.setFilterData(data);
    }

    /** Populates the encounter table selector in the controls panel. */
    public void setTableList(List<EncounterTable> tables) {
        workflow.setTableList(tables);
    }

    public void refreshPartyState() {
        workflow.refreshPartyStateFromExternal();
    }

    @Override
    public Node getMainContent() {
        return monsterList;
    }

    @Override
    public String getTitle() {
        return workflow.getTitle();
    }

    @Override
    public String getIconText() {
        return "\u2694";
    }

    @Override
    public Node getControlsContent() {
        return encounterControls;
    }

    @Override
    public void onShow() {
        workflow.onShow();
    }

    @Override
    public void onHide() {
        workflow.onHide();
    }
}
