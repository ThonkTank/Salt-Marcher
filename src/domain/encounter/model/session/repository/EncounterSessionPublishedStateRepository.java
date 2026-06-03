package src.domain.encounter.model.session.repository;

import src.domain.encounter.model.session.EncounterSessionPublicationData;

public interface EncounterSessionPublishedStateRepository {

    void publishCurrentSession(EncounterSessionPublicationData publication);
}
