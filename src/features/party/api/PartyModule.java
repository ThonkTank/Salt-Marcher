package features.party.api;

import features.party.ui.PartyPopup;
import features.party.ui.PartyPopupController;
import features.party.ui.PartyWorkflowApplicationService;
import features.partyanalysis.api.PartyCacheRefreshPort;
import javafx.scene.Node;

import java.util.Objects;

/**
 * Shell-facing facade for the party toolbar workflow.
 */
public final class PartyModule {

    private final PartyPopup partyPopup;

    public PartyModule(
            Runnable onPartyMutationSucceeded,
            PartyCacheRefreshPort partyCacheRefreshPort
    ) {
        Objects.requireNonNull(onPartyMutationSucceeded, "onPartyMutationSucceeded");
        Objects.requireNonNull(partyCacheRefreshPort, "partyCacheRefreshPort");
        PartyWorkflowApplicationService workflowApplicationService =
                new PartyWorkflowApplicationService(onPartyMutationSucceeded, partyCacheRefreshPort);
        this.partyPopup = new PartyPopup(new PartyPopupController(workflowApplicationService));
    }

    public Node toolbarItem() {
        return partyPopup.getTriggerButton();
    }
}
