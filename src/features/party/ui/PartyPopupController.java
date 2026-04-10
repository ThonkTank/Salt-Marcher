package features.party.ui;

import features.party.input.CreateCharacterAndAddToPartyInput;
import features.party.input.LoadPartySnapshotInput;
import features.party.input.UpdateCharacterInput;

import java.util.function.Consumer;

@SuppressWarnings("unused")
public final class PartyPopupController {

    private final PartyWorkflowApplicationService workflowApplicationService;

    public PartyPopupController(PartyWorkflowApplicationService workflowApplicationService) {
        this.workflowApplicationService = workflowApplicationService;
    }

    void loadPartySnapshot(Consumer<LoadPartySnapshotInput.LoadedPartySnapshotInput> onComplete) {
        workflowApplicationService.loadPartySnapshot(onComplete);
    }

    void addToPartyAndReload(
            Long id,
            Consumer<PartyWorkflowApplicationService.MutationAndReloadResult> onComplete
    ) {
        workflowApplicationService.addToPartyAndReload(id, onComplete);
    }

    void removeFromPartyAndReload(
            Long id,
            Consumer<PartyWorkflowApplicationService.MutationAndReloadResult> onComplete
    ) {
        workflowApplicationService.removeFromPartyAndReload(id, onComplete);
    }

    void updateCharacterAndReload(
            UpdateCharacterInput input,
            Consumer<PartyWorkflowApplicationService.MutationAndReloadResult> onComplete
    ) {
        workflowApplicationService.updateCharacterAndReload(input, onComplete);
    }

    void deleteCharacterAndReload(
            Long id,
            Consumer<PartyWorkflowApplicationService.MutationAndReloadResult> onComplete
    ) {
        workflowApplicationService.deleteCharacterAndReload(id, onComplete);
    }

    void createAndAddCharacterAndReload(
            CreateCharacterAndAddToPartyInput input,
            Consumer<PartyWorkflowApplicationService.MutationAndReloadResult> onComplete
    ) {
        workflowApplicationService.createAndAddCharacterAndReload(input, onComplete);
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
