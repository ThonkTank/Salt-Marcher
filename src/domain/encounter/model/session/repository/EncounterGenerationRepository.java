package src.domain.encounter.model.session.repository;

import src.domain.encounter.model.generation.model.EncounterGenerationRequest;
import src.domain.encounter.model.generation.model.EncounterGenerationResult;

public interface EncounterGenerationRepository {

    EncounterGenerationResult execute(EncounterGenerationRequest request);
}
