package src.domain.encounter.model.session.model;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;
import src.domain.encounter.model.generation.model.EncounterGenerationRequest;

final class EncounterSessionGenerationRequest {

    private static final int DEFAULT_GENERATION_ALTERNATIVE_COUNT = 5;

    private EncounterSessionGenerationRequest() {
    }

    static EncounterGenerationRequest create(EncounterGenerationInputs builderInputs) {
        return new EncounterGenerationRequest(
                builderInputs,
                DEFAULT_GENERATION_ALTERNATIVE_COUNT,
                Math.max(0L, System.nanoTime()),
                List.of(),
                List.of());
    }
}
