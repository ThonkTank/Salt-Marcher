package features.sessiongeneration.application;

import features.sessiongeneration.api.CommitGenerationRunCommand;
import features.sessiongeneration.api.GenerationDraftResponse;
import features.sessiongeneration.api.GenerationRequest;
import features.sessiongeneration.api.GenerationRewardBatchQuery;
import features.sessiongeneration.api.GenerationRewardBatchResponse;
import features.sessiongeneration.api.GenerationRunId;
import features.sessiongeneration.api.GenerationRunResponse;
import features.sessiongeneration.api.GenerationStatus;
import features.sessiongeneration.api.SessionGenerationApi;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

/** Payload-free failure adapter used when the optional generation store is unavailable. */
public final class UnavailableSessionGenerationApi implements SessionGenerationApi {

    private static final String MECHANISM_FAILURE = "session generation store unavailable";

    @Override
    public boolean available() {
        return false;
    }

    @Override
    public CompletionStage<GenerationDraftResponse> draft(GenerationRequest request) {
        return CompletableFuture.completedFuture(
                GenerationDraftResponse.failure(GenerationStatus.STORAGE_FAILURE, MECHANISM_FAILURE));
    }

    @Override
    public CompletionStage<GenerationRunResponse> commit(CommitGenerationRunCommand command) {
        return unavailableRun();
    }

    @Override
    public CompletionStage<GenerationRunResponse> load(GenerationRunId runId) {
        return unavailableRun();
    }

    @Override
    public CompletionStage<GenerationRewardBatchResponse> loadRewards(GenerationRewardBatchQuery query) {
        return CompletableFuture.completedFuture(
                GenerationRewardBatchResponse.failure(GenerationStatus.STORAGE_FAILURE, MECHANISM_FAILURE));
    }

    private static CompletionStage<GenerationRunResponse> unavailableRun() {
        return CompletableFuture.completedFuture(
                GenerationRunResponse.failure(GenerationStatus.STORAGE_FAILURE, MECHANISM_FAILURE));
    }
}
