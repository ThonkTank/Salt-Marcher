package src.domain.encounter.model.session.repository;

import java.util.LinkedHashMap;
import java.util.Map;
import src.domain.encounter.model.session.EncounterSessionMemento;

public final class InMemoryEncounterRuntimeStateRepository implements EncounterRuntimeStateRepository {
    private Map<String, EncounterSessionMemento> state = Map.of();
    @Override public Map<String, EncounterSessionMemento> loadAll() { return state; }
    @Override public void saveAll(Map<String, EncounterSessionMemento> sessions) {
        state = Map.copyOf(new LinkedHashMap<>(sessions == null ? Map.of() : sessions));
    }
}
