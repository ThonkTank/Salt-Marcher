package features.sessiongeneration.domain.generation;

import java.util.Optional;

public interface GenerationRunRepository {

    GeneratedRun save(GeneratedRun run);

    Optional<GeneratedRun> load(String runId);
}
