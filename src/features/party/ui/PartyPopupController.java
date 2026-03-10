package features.party.ui;

import features.party.service.PartyService;

import java.util.function.Consumer;
import java.util.function.Supplier;

public final class PartyPopupController {

    private final PartyWorkflowApplicationService workflowApplicationService;

    public PartyPopupController(PartyWorkflowApplicationService workflowApplicationService) {
        this.workflowApplicationService = workflowApplicationService;
    }

    void loadPartySnapshot(Consumer<PartyService.PartySnapshotResult> onComplete) {
        workflowApplicationService.loadPartySnapshot(onComplete);
    }

    void mutateAndReload(
            Supplier<PartyService.MutationResult> mutation,
            String failureContext,
            Consumer<PartyWorkflowApplicationService.MutationAndReloadResult> onComplete
    ) {
        workflowApplicationService.mutateAndReload(mutation, failureContext, onComplete);
    }

    void createAndAddCharacterAndReload(
            String name,
            int level,
            Consumer<PartyWorkflowApplicationService.MutationAndReloadResult> onComplete
    ) {
        workflowApplicationService.createAndAddCharacterAndReload(name, level, onComplete);
    }
}
