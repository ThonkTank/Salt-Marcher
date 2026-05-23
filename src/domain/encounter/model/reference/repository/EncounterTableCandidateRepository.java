package src.domain.encounter.model.reference.repository;

import src.domain.encounter.model.reference.model.EncounterTableCandidateCriteria;

public interface EncounterTableCandidateRepository {

    void requestCandidates(EncounterTableCandidateCriteria criteria);
}
