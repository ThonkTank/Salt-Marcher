package src.domain.encounter.model.session.repository;

import src.domain.encounter.model.generation.EncounterGenerationRequest;
import src.domain.encounter.model.generation.EncounterGenerationResult;

public interface EncounterGenerationRepository {

    EncounterGenerationResult execute(EncounterGenerationRequest request);
}
