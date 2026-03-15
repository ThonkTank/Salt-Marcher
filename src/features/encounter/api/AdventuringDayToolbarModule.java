package features.encounter.api;

import features.encounter.ui.toolbar.AdventuringDayToolbarPopup;
import features.encounter.ui.toolbar.workflow.AdventuringDayToolbarController;
import features.encounter.ui.toolbar.workflow.AdventuringDayToolbarWorkflowService;
import javafx.scene.Node;

public final class AdventuringDayToolbarModule {

    private final AdventuringDayToolbarPopup popup;

    public AdventuringDayToolbarModule() {
        AdventuringDayToolbarWorkflowService workflowService = new AdventuringDayToolbarWorkflowService();
        AdventuringDayToolbarController controller = new AdventuringDayToolbarController(workflowService);
        this.popup = new AdventuringDayToolbarPopup(controller);
    }

    public Node toolbarItem() {
        return popup.getTriggerButton();
    }

    public void refreshActivePartyState() {
        popup.refreshActivePartyState();
    }
}
