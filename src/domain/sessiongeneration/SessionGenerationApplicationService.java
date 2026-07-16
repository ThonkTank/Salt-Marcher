package src.domain.sessiongeneration;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

public final class SessionGenerationApplicationService {

    private final SheetV1GenerationEngine engine;
    private final SessionGenerationRepository repository;
    private final Map<Long, GenerationResult> generatedRuns = new LinkedHashMap<>();

    public SessionGenerationApplicationService(SheetV1GenerationEngine engine) {
        this(engine, null);
    }

    public SessionGenerationApplicationService(
            SheetV1GenerationEngine engine,
            SessionGenerationRepository repository
    ) {
        this.engine = java.util.Objects.requireNonNull(engine, "engine");
        this.repository = repository;
    }

    public synchronized GenerationResult generate(GenerationRequest request) {
        GenerationResult result = repository == null
                ? engine.generate(request)
                : engine.generate(request, repository.nextGenerationId());
        if (repository != null) repository.save(result);
        generatedRuns.put(result.generationId(), result);
        return result;
    }

    public synchronized Optional<GenerationResult> load(long generationId) {
        GenerationResult cached = generatedRuns.get(generationId);
        return cached == null && repository != null ? repository.load(generationId) : Optional.ofNullable(cached);
    }
}
