package features.party.ui;

import features.party.service.PartyService;
import features.partyanalysis.api.PartyCacheRefreshPort;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * UI-naher Application-Service fuer Party-Workflows.
 * Kapselt Hintergrund-Tasks und delegiert Persistenzlogik an den PartyService.
 */
public final class PartyWorkflowApplicationService {

    private final Runnable onPartyMutationSucceeded;
    private final PartyCacheRefreshPort partyCacheRefreshPort;

    public PartyWorkflowApplicationService(
            Runnable onPartyMutationSucceeded,
            PartyCacheRefreshPort partyCacheRefreshPort
    ) {
        this.onPartyMutationSucceeded = Objects.requireNonNull(onPartyMutationSucceeded, "onPartyMutationSucceeded");
        this.partyCacheRefreshPort = Objects.requireNonNull(partyCacheRefreshPort, "partyCacheRefreshPort");
    }

    public void loadPartySnapshot(Consumer<PartyService.PartySnapshotResult> onComplete) {
        submitTask(
                PartyService::loadPartySnapshot,
                "PartyWorkflowApplicationService.loadPartySnapshot()",
                onComplete);
    }

    public void mutateAndReload(
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
                result -> {
                    onComplete.accept(result);
                    if (result.mutationStatus() == PartyService.MutationStatus.SUCCESS) {
                        onPartyMutationSucceeded.run();
                        partyCacheRefreshPort.refreshCurrentPartyCacheAsyncBestEffort();
                    }
                });
    }

    public void createAndAddCharacterAndReload(
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
                "PartyWorkflowApplicationService.createAndAddCharacterAndReload()",
                result -> {
                    onComplete.accept(result);
                    if (result.mutationStatus() == PartyService.MutationStatus.SUCCESS) {
                        onPartyMutationSucceeded.run();
                        partyCacheRefreshPort.refreshCurrentPartyCacheAsyncBestEffort();
                    }
                });
    }

    public record MutationAndReloadResult(
            PartyService.MutationStatus mutationStatus,
            PartyService.PartySnapshotResult snapshotResult
    ) {}

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
        UiAsyncTasks.submit(
                task,
                onComplete,
                throwable -> UiErrorReporter.reportBackgroundFailure(failureContext, throwable));
    }
}
