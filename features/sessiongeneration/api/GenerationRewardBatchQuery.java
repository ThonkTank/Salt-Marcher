package features.sessiongeneration.api;

import java.util.List;

public record GenerationRewardBatchQuery(List<GenerationRewardReference> references) {

    public GenerationRewardBatchQuery {
        references = List.copyOf(references);
    }
}
