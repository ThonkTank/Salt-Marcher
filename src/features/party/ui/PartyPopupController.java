package features.party.ui;

import features.party.service.PartyService;
import javafx.concurrent.Task;
import ui.UiAsyncExecutor;
import ui.UiErrorReporter;

import java.util.function.Consumer;
import java.util.function.Supplier;

final class PartyPopupController {

    void loadPartySnapshot(Consumer<PartyService.PartySnapshotResult> onComplete) {
        submitTask(
                PartyService::loadPartySnapshot,
                "PartyPopupController.loadPartySnapshot()",
                onComplete);
    }

    void mutateAndReload(
            Supplier<PartyService.MutationResult> mutation,
            String failureContext,
            Consumer<MutationAndReloadResult> onComplete
    ) {
        submitTask(
                () -> {
                    PartyService.MutationResult mutationResult = mutation.get();
                    if (mutationResult.status() != PartyService.MutationStatus.SUCCESS) {
                        return new MutationAndReloadResult(mutationResult.status(), null);
                    }
                    return new MutationAndReloadResult(
                            PartyService.MutationStatus.SUCCESS,
                            PartyService.loadPartySnapshot());
                },
                failureContext,
                onComplete);
    }

    void createAndAddCharacterAndReload(
            String name,
            int level,
            Consumer<MutationAndReloadResult> onComplete
    ) {
        submitTask(
                () -> {
                    PartyService.CreateResult createResult = PartyService.createCharacterAndAddToParty(name, level);
                    if (createResult.status() != PartyService.MutationStatus.SUCCESS) {
                        return new MutationAndReloadResult(createResult.status(), null);
                    }
                    return new MutationAndReloadResult(
                            PartyService.MutationStatus.SUCCESS,
                            PartyService.loadPartySnapshot());
                },
                "PartyPopupController.createAndAddCharacterAndReload()",
                onComplete);
    }

    private <TResult> void submitTask(
            Supplier<TResult> operation,
            String failureContext,
            Consumer<TResult> onComplete
    ) {
        Task<TResult> task = new Task<>() {
            @Override
            protected TResult call() {
                return operation.get();
            }
        };
        task.setOnSucceeded(e -> onComplete.accept(task.getValue()));
        task.setOnFailed(e -> UiErrorReporter.reportBackgroundFailure(failureContext, task.getException()));
        UiAsyncExecutor.submit(task);
    }

    record MutationAndReloadResult(
            PartyService.MutationStatus mutationStatus,
            PartyService.PartySnapshotResult snapshotResult
    ) {}
}
