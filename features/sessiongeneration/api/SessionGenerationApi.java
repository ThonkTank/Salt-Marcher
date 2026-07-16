package features.sessiongeneration.api;

import java.util.concurrent.CompletionStage;

public interface SessionGenerationApi {

    CompletionStage<GenerationResponse> generate(GenerationRequest request);

    CompletionStage<GenerationResponse> load(GenerationRunId runId);
}
