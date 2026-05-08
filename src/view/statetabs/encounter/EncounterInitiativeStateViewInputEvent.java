package src.view.statetabs.encounter;

import java.util.List;

public record EncounterInitiativeStateViewInputEvent(
        boolean backToBuilder,
        List<InitiativeEntry> initiatives
) {

    public EncounterInitiativeStateViewInputEvent {
        initiatives = initiatives == null ? List.of() : List.copyOf(initiatives);
    }

    public record InitiativeEntry(String id, int initiative) {
        public InitiativeEntry {
            id = id == null ? "" : id;
        }
    }
}
