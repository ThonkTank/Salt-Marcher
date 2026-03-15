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
            PartyService.CharacterDraft draft,
            Consumer<PartyWorkflowApplicationService.MutationAndReloadResult> onComplete
    ) {
        workflowApplicationService.createAndAddCharacterAndReload(draft, onComplete);
    }

    void awardXpToCharacterAndReload(
            Long id,
            int xpAmount,
            Consumer<PartyWorkflowApplicationService.MutationAndReloadResult> onComplete
    ) {
        workflowApplicationService.awardXpToCharacterAndReload(id, xpAmount, onComplete);
    }

    void performShortRestAndReload(Consumer<PartyWorkflowApplicationService.MutationAndReloadResult> onComplete) {
        workflowApplicationService.performShortRestAndReload(onComplete);
    }

    void performLongRestAndReload(Consumer<PartyWorkflowApplicationService.MutationAndReloadResult> onComplete) {
        workflowApplicationService.performLongRestAndReload(onComplete);
    }
}
