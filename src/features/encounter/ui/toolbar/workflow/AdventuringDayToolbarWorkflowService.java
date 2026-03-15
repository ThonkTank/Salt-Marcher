package features.encounter.ui.toolbar.workflow;

import features.party.api.PartyApi;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.function.Consumer;

public final class AdventuringDayToolbarWorkflowService {

    public void loadActiveParty(Consumer<PartyApi.ActivePartyResult> onComplete) {
        Task<PartyApi.ActivePartyResult> task = new Task<>() {
            @Override
            protected PartyApi.ActivePartyResult call() {
                return PartyApi.loadActiveParty();
            }
        };
        UiAsyncTasks.submit(
                task,
                onComplete,
                throwable -> UiErrorReporter.reportBackgroundFailure(
                        "AdventuringDayToolbarWorkflowService.loadActiveParty()",
                        throwable));
    }
}
