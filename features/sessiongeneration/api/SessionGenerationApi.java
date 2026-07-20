package features.sessiongeneration.api;

import java.util.concurrent.CompletionStage;

public interface SessionGenerationApi {

    CompletionStage<GenerationDraftResponse> draft(GenerationRequest request);

    CompletionStage<GenerationRunResponse> commit(CommitGenerationRunCommand command);

    CompletionStage<GenerationRunResponse> load(GenerationRunId runId);

    CompletionStage<GenerationRewardBatchResponse> loadRewards(GenerationRewardBatchQuery query);

}
