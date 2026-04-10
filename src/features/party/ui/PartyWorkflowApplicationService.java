package features.party.ui;

import features.party.PartyObject;
import features.party.input.AddToPartyInput;
import features.party.input.AwardXpToCharacterInput;
import features.party.input.CreateCharacterAndAddToPartyInput;
import features.party.input.DeleteCharacterInput;
import features.party.input.LoadPartySnapshotInput;
import features.party.input.PerformLongRestInput;
import features.party.input.PerformShortRestInput;
import features.party.input.RemoveFromPartyInput;
import features.party.input.UpdateCharacterInput;
import features.partyanalysis.api.PartyCacheRefreshPort;
import javafx.concurrent.Task;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * UI-naher Application-Service fuer Party-Workflows.
 * Kapselt Hintergrund-Tasks und delegiert Persistenzlogik an den PartyObject-Root.
 */
@SuppressWarnings("unused")
public final class PartyWorkflowApplicationService {
    private static final PartyObject PARTY_OBJECT = new PartyObject();

    private final Runnable onPartyMutationSucceeded;
    private final PartyCacheRefreshPort partyCacheRefreshPort;

    public PartyWorkflowApplicationService(
            Runnable onPartyMutationSucceeded,
            PartyCacheRefreshPort partyCacheRefreshPort
    ) {
        this.onPartyMutationSucceeded = Objects.requireNonNull(onPartyMutationSucceeded, "onPartyMutationSucceeded");
        this.partyCacheRefreshPort = Objects.requireNonNull(partyCacheRefreshPort, "partyCacheRefreshPort");
    }

    public enum MutationStatus {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public void loadPartySnapshot(Consumer<LoadPartySnapshotInput.LoadedPartySnapshotInput> onComplete) {
        submitTask(
                () -> PARTY_OBJECT.loadPartySnapshot(new LoadPartySnapshotInput()),
                "PartyWorkflowApplicationService.loadPartySnapshot()",
                onComplete);
    }

    public void addToPartyAndReload(
            Long id,
            Consumer<MutationAndReloadResult> onComplete
    ) {
        mutateAndReload(
                () -> mapStatus(PARTY_OBJECT.addToParty(new AddToPartyInput(id)).status()),
                "PartyWorkflowApplicationService.addToPartyAndReload()",
                onComplete);
    }

    public void removeFromPartyAndReload(
            Long id,
            Consumer<MutationAndReloadResult> onComplete
    ) {
        mutateAndReload(
                () -> mapStatus(PARTY_OBJECT.removeFromParty(new RemoveFromPartyInput(id)).status()),
                "PartyWorkflowApplicationService.removeFromPartyAndReload()",
                onComplete);
    }

    public void updateCharacterAndReload(
            UpdateCharacterInput input,
            Consumer<MutationAndReloadResult> onComplete
    ) {
        mutateAndReload(
                () -> mapStatus(PARTY_OBJECT.updateCharacter(input).status()),
                "PartyWorkflowApplicationService.updateCharacterAndReload()",
                onComplete);
    }

    public void deleteCharacterAndReload(
            Long id,
            Consumer<MutationAndReloadResult> onComplete
    ) {
        mutateAndReload(
                () -> mapStatus(PARTY_OBJECT.deleteCharacter(new DeleteCharacterInput(id)).status()),
                "PartyWorkflowApplicationService.deleteCharacterAndReload()",
                onComplete);
    }

    public void createAndAddCharacterAndReload(
            CreateCharacterAndAddToPartyInput input,
            Consumer<MutationAndReloadResult> onComplete
    ) {
        submitTask(
                () -> {
                    MutationStatus mutationStatus =
                            mapStatus(PARTY_OBJECT.createCharacterAndAddToParty(input).status());
                    if (mutationStatus != MutationStatus.SUCCESS) {
                        return new MutationAndReloadResult(mutationStatus, null);
                    }
                    return new MutationAndReloadResult(
                            MutationStatus.SUCCESS,
                            PARTY_OBJECT.loadPartySnapshot(new LoadPartySnapshotInput()));
                },
                "PartyWorkflowApplicationService.createAndAddCharacterAndReload()",
                result -> {
                    onComplete.accept(result);
                    if (result.mutationStatus() == MutationStatus.SUCCESS) {
                        onPartyMutationSucceeded.run();
                        partyCacheRefreshPort.refreshCurrentPartyCacheAsyncBestEffort();
                    }
                });
    }

    public void awardXpToCharacterAndReload(
            Long id,
            int xpAmount,
            Consumer<MutationAndReloadResult> onComplete
    ) {
        mutateAndReload(
                () -> mapStatus(PARTY_OBJECT.awardXpToCharacter(new AwardXpToCharacterInput(id, xpAmount)).status()),
                "PartyWorkflowApplicationService.awardXpToCharacterAndReload()",
                onComplete);
    }

    public void performShortRestAndReload(Consumer<MutationAndReloadResult> onComplete) {
        mutateAndReload(
                () -> mapStatus(PARTY_OBJECT.performShortRest(new PerformShortRestInput()).status()),
                "PartyWorkflowApplicationService.performShortRestAndReload()",
                onComplete);
    }

    public void performLongRestAndReload(Consumer<MutationAndReloadResult> onComplete) {
        mutateAndReload(
                () -> mapStatus(PARTY_OBJECT.performLongRest(new PerformLongRestInput()).status()),
                "PartyWorkflowApplicationService.performLongRestAndReload()",
                onComplete);
    }

    public record MutationAndReloadResult(
            MutationStatus mutationStatus,
            LoadPartySnapshotInput.LoadedPartySnapshotInput snapshotResult
    ) {}

    private void mutateAndReload(
            Supplier<MutationStatus> mutation,
            String failureContext,
            Consumer<MutationAndReloadResult> onComplete
    ) {
        submitTask(
                () -> {
                    MutationStatus mutationStatus = mutation.get();
                    if (mutationStatus != MutationStatus.SUCCESS) {
                        return new MutationAndReloadResult(mutationStatus, null);
                    }
                    return new MutationAndReloadResult(
                            MutationStatus.SUCCESS,
                            PARTY_OBJECT.loadPartySnapshot(new LoadPartySnapshotInput()));
                },
                failureContext,
                result -> {
                    onComplete.accept(result);
                    if (result.mutationStatus() == MutationStatus.SUCCESS) {
                        onPartyMutationSucceeded.run();
                        partyCacheRefreshPort.refreshCurrentPartyCacheAsyncBestEffort();
                    }
                });
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
        UiAsyncTasks.submit(
                task,
                onComplete,
                throwable -> UiErrorReporter.reportBackgroundFailure(failureContext, throwable));
    }

    private static MutationStatus mapStatus(AddToPartyInput.Status status) {
        return switch (status) {
            case SUCCESS -> MutationStatus.SUCCESS;
            case NOT_FOUND -> MutationStatus.NOT_FOUND;
            case STORAGE_ERROR -> MutationStatus.STORAGE_ERROR;
        };
    }

    private static MutationStatus mapStatus(RemoveFromPartyInput.Status status) {
        return switch (status) {
            case SUCCESS -> MutationStatus.SUCCESS;
            case NOT_FOUND -> MutationStatus.NOT_FOUND;
            case STORAGE_ERROR -> MutationStatus.STORAGE_ERROR;
        };
    }

    private static MutationStatus mapStatus(UpdateCharacterInput.Status status) {
        return switch (status) {
            case SUCCESS -> MutationStatus.SUCCESS;
            case NOT_FOUND -> MutationStatus.NOT_FOUND;
            case STORAGE_ERROR -> MutationStatus.STORAGE_ERROR;
        };
    }

    private static MutationStatus mapStatus(DeleteCharacterInput.Status status) {
        return switch (status) {
            case SUCCESS -> MutationStatus.SUCCESS;
            case NOT_FOUND -> MutationStatus.NOT_FOUND;
            case STORAGE_ERROR -> MutationStatus.STORAGE_ERROR;
        };
    }

    private static MutationStatus mapStatus(CreateCharacterAndAddToPartyInput.Status status) {
        return status == CreateCharacterAndAddToPartyInput.Status.SUCCESS
                ? MutationStatus.SUCCESS
                : MutationStatus.STORAGE_ERROR;
    }

    private static MutationStatus mapStatus(AwardXpToCharacterInput.Status status) {
        return switch (status) {
            case SUCCESS -> MutationStatus.SUCCESS;
            case NOT_FOUND -> MutationStatus.NOT_FOUND;
            case STORAGE_ERROR -> MutationStatus.STORAGE_ERROR;
        };
    }

    private static MutationStatus mapStatus(PerformShortRestInput.Status status) {
        return status == PerformShortRestInput.Status.SUCCESS
                ? MutationStatus.SUCCESS
                : MutationStatus.STORAGE_ERROR;
    }

    private static MutationStatus mapStatus(PerformLongRestInput.Status status) {
        return status == PerformLongRestInput.Status.SUCCESS
                ? MutationStatus.SUCCESS
                : MutationStatus.STORAGE_ERROR;
    }
}
