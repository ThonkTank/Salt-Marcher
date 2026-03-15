package features.encounter.ui.toolbar.workflow;

import features.party.api.PartyApi;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.function.Consumer;

public final class AdventuringDayToolbarWorkflowService {

    public void loadAdventuringDayParty(Consumer<PartyApi.AdventuringDayPartyResult> onComplete) {
        Task<PartyApi.AdventuringDayPartyResult> task = new Task<>() {
            @Override
            protected PartyApi.AdventuringDayPartyResult call() {
                return PartyApi.loadAdventuringDayParty();
            }
        };
        UiAsyncTasks.submit(
                task,
                onComplete,
                throwable -> UiErrorReporter.reportBackgroundFailure(
                        "AdventuringDayToolbarWorkflowService.loadAdventuringDayParty()",
                        throwable));
    }
}
