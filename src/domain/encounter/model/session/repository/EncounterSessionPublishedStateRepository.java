package src.domain.encounter.model.session.repository;

import src.domain.encounter.model.session.model.EncounterSessionPublicationData;

public interface EncounterSessionPublishedStateRepository {

    void publishCurrentSession(EncounterSessionPublicationData publication);
}
