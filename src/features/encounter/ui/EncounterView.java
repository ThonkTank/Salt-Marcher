package features.encounter.ui;

import features.creaturecatalog.service.CreatureService;
import features.creaturepicker.ui.MonsterListPane;
import features.encountertable.model.EncounterTable;
import ui.AppView;
import ui.SceneHandle;
import javafx.scene.Node;
import features.encounter.ui.builder.EncounterControls;
import features.encounter.ui.builder.EncounterRosterPane;

import java.util.List;
import java.util.function.Consumer;

/**
 * Encounter workflow view: orchestrates builder and combat modes.
 * Builder mode shows the monster browser + roster; combat mode shows the turn tracker.
 */
public class EncounterView implements AppView {

    private final MonsterListPane monsterList;
    private final EncounterControls encounterControls;
    private final EncounterWorkflowCoordinator workflow;

    public EncounterView(EncounterViewCallbacks callbacks) {
        monsterList = new MonsterListPane();
        encounterControls = new EncounterControls(callbacks.encounterService());
        EncounterRosterPane rosterPane = new EncounterRosterPane(callbacks.encounterService());
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
        monsterList.setOnRequestStatBlock(callbacks.onRequestStatBlock());

        rosterPane.setOnGenerate(workflow::onGenerate);
        rosterPane.setOnStartCombat(workflow::onRequestCombat);
        rosterPane.setOnRosterChanged(workflow::onRosterChanged);
        rosterPane.setOnRequestStatBlock(callbacks.onRequestStatBlock());
    }

    /** Optional: omitting disables auto-show (without toggle) for stat blocks during combat. */
    public void setOnEnsureStatBlock(Consumer<Long> callback) {
        workflow.setOnEnsureStatBlock(callback);
    }

    public void setFilterData(CreatureService.FilterOptions data) {
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
