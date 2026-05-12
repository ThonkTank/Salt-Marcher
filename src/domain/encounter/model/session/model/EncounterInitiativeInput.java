package src.domain.encounter.model.session.model;

public record EncounterInitiativeInput(String id, int initiative) {

    public EncounterInitiativeInput {
        id = id == null ? "" : id;
    }
}
