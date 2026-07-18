package features.sessiongeneration.api;

import java.util.concurrent.CompletionStage;

public interface SessionGenerationApi {

    CompletionStage<GenerationDraftResponse> draft(GenerationRequest request);

    CompletionStage<GenerationRunResponse> commit(CommitGenerationRunCommand command);

    // M1 cannot overload the deprecated load method by return type. M3 removes that delegate and
    // promotes this canonical operation to the owner-contract name `load`.
    CompletionStage<GenerationRunResponse> loadRun(GenerationRunId runId);

    CompletionStage<GenerationRewardBatchResponse> loadRewards(GenerationRewardBatchQuery query);

    /** @deprecated M3 replaces the preview workflow that needs generate-and-commit transport. */
    @Deprecated(forRemoval = true)
    CompletionStage<GenerationResponse> generate(GenerationRequest request);

    /** @deprecated M3 replaces the Apply continuation that reloads the just-generated run. */
    @Deprecated(forRemoval = true)
    CompletionStage<GenerationResponse> load(GenerationRunId runId);
}
