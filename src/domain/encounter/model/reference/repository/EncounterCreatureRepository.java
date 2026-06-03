package src.domain.encounter.model.reference.repository;

import src.domain.encounter.model.reference.EncounterCreatureCandidateCriteria;

public interface EncounterCreatureRepository {

    void requestCreature(long creatureId);

    void requestCandidates(EncounterCreatureCandidateCriteria criteria);
}
