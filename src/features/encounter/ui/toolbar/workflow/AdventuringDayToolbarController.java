package features.encounter.ui.toolbar.workflow;

import features.party.api.PartyApi;

import java.util.function.Consumer;

public final class AdventuringDayToolbarController {

    private final AdventuringDayToolbarWorkflowService workflowService;

    public AdventuringDayToolbarController(AdventuringDayToolbarWorkflowService workflowService) {
        this.workflowService = workflowService;
    }

    public void loadActiveParty(Consumer<PartyApi.ActivePartyResult> onComplete) {
        workflowService.loadActiveParty(onComplete);
    }
}
