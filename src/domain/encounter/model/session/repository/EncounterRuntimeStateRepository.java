package src.domain.encounter.model.session.repository;

import java.util.Map;
import src.domain.encounter.model.session.EncounterSessionMemento;

public interface EncounterRuntimeStateRepository {
    Map<String, EncounterSessionMemento> loadAll();
    void saveAll(Map<String, EncounterSessionMemento> sessions);
}
