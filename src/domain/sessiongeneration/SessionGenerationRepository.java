package src.domain.sessiongeneration;

import java.util.Optional;

public interface SessionGenerationRepository {
    long nextGenerationId();
    GenerationResult save(GenerationResult result);
    Optional<GenerationResult> load(long generationId);
}
