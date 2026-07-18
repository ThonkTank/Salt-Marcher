package features.sessiongeneration.domain.generation;

import java.util.Optional;
import java.util.List;

public interface GenerationRunRepository {

    GenerationRunCommitResult commit(GeneratedRunDraft draft);

    Optional<GeneratedRunDraft> load(String runId);

    GenerationRewardBatch loadRewards(List<GenerationRewardReference> references);
}
