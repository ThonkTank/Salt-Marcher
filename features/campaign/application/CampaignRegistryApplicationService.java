package features.campaign.application;

import features.campaign.api.CampaignActiveResult;
import features.campaign.api.CampaignId;
import features.campaign.api.CampaignListResult;
import features.campaign.api.CampaignPointerCommitResult;
import features.campaign.api.CampaignReadResult;
import features.campaign.api.CampaignRegistryApi;
import features.campaign.domain.CampaignName;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;

/** Serializes all registry persistence work through its installation-owned execution lane. */
public final class CampaignRegistryApplicationService implements CampaignRegistryApi {

    private static final DiagnosticId STORAGE_FAILURE =
            new DiagnosticId("campaign.registry.storage-failure");
    private static final DiagnosticId EXECUTION_REJECTED =
            new DiagnosticId("campaign.registry.execution-rejected");

    private final Diagnostics diagnostics;
    private final ExecutionLane executionLane;
    private final CampaignRegistryStore store;
    private final java.util.Set<PendingOperation<?>> pending = ConcurrentHashMap.newKeySet();
    private final Object admission = new Object();
    private volatile boolean stopping;

    public CampaignRegistryApplicationService(
            Diagnostics diagnostics,
            ExecutionLane executionLane,
            CampaignRegistryStore store) {
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.store = Objects.requireNonNull(store, "store");
    }

    @Override
    public CompletionStage<CampaignPointerCommitResult> registerAndCommitActivePointer(
            CampaignId campaignId,
            String name,
            long expectedGeneration) {
        CampaignId safeCampaignId = Objects.requireNonNull(campaignId, "campaignId");
        CampaignName campaignName;
        try {
            campaignName = new CampaignName(name);
        } catch (NullPointerException | IllegalArgumentException invalidName) {
            return CompletableFuture.completedFuture(new CampaignPointerCommitResult(
                    CampaignPointerCommitResult.Status.INVALID_NAME,
                    Optional.empty()));
        }
        if (!validExpectedGeneration(expectedGeneration)) {
            return invalidGeneration();
        }
        return submit(
                () -> toApiResult(store.registerAndCommitActivePointer(
                        safeCampaignId,
                        campaignName,
                        expectedGeneration)),
                () -> new CampaignPointerCommitResult(
                        CampaignPointerCommitResult.Status.STORAGE_ERROR,
                        Optional.empty()));
    }

    @Override
    public CompletionStage<CampaignListResult> list() {
        return submit(
                () -> new CampaignListResult(CampaignListResult.Status.SUCCESS, store.list()),
                () -> new CampaignListResult(CampaignListResult.Status.STORAGE_ERROR, List.of()));
    }

    @Override
    public CompletionStage<CampaignReadResult> read(CampaignId campaignId) {
        CampaignId safeCampaignId = Objects.requireNonNull(campaignId, "campaignId");
        return submit(
                () -> store.read(safeCampaignId)
                        .map(campaign -> new CampaignReadResult(
                                CampaignReadResult.Status.FOUND,
                                Optional.of(campaign)))
                        .orElseGet(() -> new CampaignReadResult(
                                CampaignReadResult.Status.NOT_FOUND,
                                Optional.empty())),
                () -> new CampaignReadResult(
                        CampaignReadResult.Status.STORAGE_ERROR,
                        Optional.empty()));
    }

    @Override
    public CompletionStage<CampaignActiveResult> active() {
        return submit(
                () -> new CampaignActiveResult(
                        CampaignActiveResult.Status.SUCCESS,
                        Optional.of(store.active())),
                () -> new CampaignActiveResult(
                        CampaignActiveResult.Status.STORAGE_ERROR,
                        Optional.empty()));
    }

    @Override
    public CompletionStage<CampaignPointerCommitResult> commitActivePointer(
            CampaignId campaignId,
            long expectedGeneration) {
        CampaignId safeCampaignId = Objects.requireNonNull(campaignId, "campaignId");
        if (!validExpectedGeneration(expectedGeneration)) {
            return invalidGeneration();
        }
        return submit(
                () -> toApiResult(store.commitActivePointer(
                        safeCampaignId,
                        expectedGeneration)),
                () -> new CampaignPointerCommitResult(
                        CampaignPointerCommitResult.Status.STORAGE_ERROR,
                        Optional.empty()));
    }

    private static CampaignPointerCommitResult toApiResult(
            CampaignRegistryStore.PointerCommitAttempt attempt) {
        CampaignPointerCommitResult.Status status = switch (attempt.status()) {
            case COMMITTED -> CampaignPointerCommitResult.Status.COMMITTED;
            case STALE_GENERATION -> CampaignPointerCommitResult.Status.STALE_GENERATION;
            case CAMPAIGN_NOT_FOUND -> CampaignPointerCommitResult.Status.CAMPAIGN_NOT_FOUND;
        };
        return new CampaignPointerCommitResult(status, Optional.of(attempt.activation()));
    }

    private static boolean validExpectedGeneration(long expectedGeneration) {
        return expectedGeneration >= 0L && expectedGeneration < Long.MAX_VALUE;
    }

    private static CompletionStage<CampaignPointerCommitResult> invalidGeneration() {
        return CompletableFuture.completedFuture(new CampaignPointerCommitResult(
                CampaignPointerCommitResult.Status.INVALID_GENERATION,
                Optional.empty()));
    }

    private <T> CompletionStage<T> submit(
            StoreSupplier<T> operation,
            Supplier<T> failureResult) {
        PendingOperation<T> pendingOperation = new PendingOperation<>(failureResult);
        synchronized (admission) {
            if (stopping) {
                return CompletableFuture.completedFuture(failureResult.get());
            }
            pending.add(pendingOperation);
            try {
                executionLane.execute(() -> runPending(pendingOperation, operation));
            } catch (RejectedExecutionException rejected) {
                diagnostics.failure(EXECUTION_REJECTED, rejected.getClass());
                pending.remove(pendingOperation);
                pendingOperation.started.set(true);
                pendingOperation.result.complete(failureResult.get());
            }
        }
        return pendingOperation.result;
    }

    private <T> void runPending(PendingOperation<T> pendingOperation, StoreSupplier<T> operation) {
        synchronized (admission) {
            if (!pendingOperation.started.compareAndSet(false, true)) {
                return;
            }
        }
        try {
            pendingOperation.result.complete(operation.get());
        } catch (CampaignRegistryStoreFailure failure) {
            diagnostics.failure(STORAGE_FAILURE, failure.getClass());
            pendingOperation.result.complete(pendingOperation.failureResult.get());
        } catch (RuntimeException | Error unexpectedFailure) {
            pendingOperation.result.completeExceptionally(unexpectedFailure);
            throw unexpectedFailure;
        } finally {
            pending.remove(pendingOperation);
        }
    }

    public void requestTerminalShutdown() {
        synchronized (admission) {
            stopping = true;
            for (PendingOperation<?> operation : pending) {
                operation.cancelIfQueued();
            }
        }
        store.requestTerminalShutdown();
    }

    public boolean operationActive() {
        return store.operationActive();
    }

    private final class PendingOperation<T> {
        private final CompletableFuture<T> result = new CompletableFuture<>();
        private final AtomicBoolean started = new AtomicBoolean();
        private final Supplier<T> failureResult;

        private PendingOperation(Supplier<T> failureResult) {
            this.failureResult = failureResult;
        }

        private void cancelIfQueued() {
            if (started.compareAndSet(false, true)) {
                pending.remove(this);
                result.complete(failureResult.get());
            }
        }
    }

    @FunctionalInterface
    private interface StoreSupplier<T> {
        T get();
    }
}
